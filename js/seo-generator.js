/**
 * seo-generator.js
 *
 * Architecture:
 *  - generate()            Full generation (all fields at once)
 *  - regenerateSection()   Single-field AI call - only that field is replaced
 *  - improveFailedItems()  Detects failed checks, regenerates only those fields
 *  - After any change: score is recomputed from local data (never trusted from AI)
 *  - Auto-save fires only when score >= 98
 */

import { callAI, friendlyError, validateKey } from './ai.js';
import { getUser, getUserDoc, getApiKey, isAccessRestricted, getAccessMessage } from './auth.js';
import { FB } from './firebase.js';
import { uploadImage, getResponsive, getThumbnail, isFirebaseStorageUrl } from './cloudinary.js';
import { normalizeModelNumber, checkModelNumberExists } from './product-model.js';
import {
  safeStr, generateSlug, validateSlug, computeSeoScore,
  compressImage, compressDataUrl, parseJsonSafe, formatDate, escapeHtml
} from './utils.js';
import {
  showAlert, hideAlert, showLoading, setLoadingProgress,
  completeStep, hideLoading, showToast, switchResultTab,
  animateScoreRing, charPill, copyText
} from './ui.js';

// ── MODULE STATE ─────────────────────────────────────────────
let _imageBase64   = null;   // base64 of the compressed product image
let _imageMime     = 'image/jpeg';
let _productId     = null;   // Products document ID used by SEO_History
let _currentResult = null;   // live working copy of the SEO result
let _busy          = false;  // prevents concurrent AI calls
let _existingProductImageUrl = null;
let _imageSourceIsFile = false;
let _productContext = null;
let _lastImproveScoreBefore = null;
let _lastImproveScoreAfter = null;
let _lastImproveScoreDifference = null;
let _lastImprovedField = null;

// _imageBase64 persists across the full session for this product.
// It is only cleared by startNewProduct(). If the user accidentally
// dismisses the preview, we still have the image for Improve calls.

function _hasImageAvailable() {
  return !!(_imageBase64 || _existingProductImageUrl);
}

function _setPreviewImage(imageSrc) {
  const preview = document.getElementById('img-preview');
  const ph = document.getElementById('upload-placeholder');
  const box = document.getElementById('upload-box');

  if (!imageSrc) {
    if (preview) { preview.src = ''; preview.style.display = 'none'; }
    if (ph) ph.style.display = '';
    if (box) box.classList.remove('has-image');
    return;
  }

  if (preview) {
    preview.src = imageSrc;
    preview.style.display = 'block';
  }
  if (ph) ph.style.display = 'none';
  if (box) box.classList.add('has-image');
}

async function _ensureImageReady() {
  if (_imageBase64) return true;
  if (!_existingProductImageUrl) return false;

  try {
    let source = _existingProductImageUrl;
    let compressedDataUrl = source;

    if (!source.startsWith('data:')) {
      const response = await fetch(source);
      if (!response.ok) throw new Error(`Unable to load image (${response.status})`);
      const blob = await response.blob();
      const file = new File([blob], 'product-image', { type: blob.type || 'image/jpeg' });
      const result = await compressImage(file, 800, 0.75);
      compressedDataUrl = result.dataUrl;
    } else {
      compressedDataUrl = await compressDataUrl(source, 800, 0.75);
    }

    _imageBase64 = compressedDataUrl.split(',')[1];
    _imageMime = 'image/jpeg';
    _setPreviewImage(compressedDataUrl);
    return true;
  } catch (error) {
    console.error('Failed to load existing product image:', error);
    return false;
  }
}

const SEO_STYLES = [
  'Luxury','Premium','Trendy','Professional',
  'Minimalist','Gift-focused','Fashion-forward','Budget-friendly'
];

// ── SECTION DEFINITIONS ───────────────────────────────────────
// Maps a section key to its prompt requirement and response field(s).
// This is the single source of truth for section-level regeneration.
const SECTIONS = {
  meta_title: {
    label:       'Meta Title',
    requirement: '50-70 characters, include the main keyword, compelling and click-worthy.',
    responseKey: 'meta_title',
    domId:       'r-title',
    render:      (r, val) => { r.meta_title = val; }
  },
  meta_description: {
    label:       'Meta Description',
    requirement: '140-160 characters, include primary keyword, end with a clear CTA.',
    responseKey: 'meta_description',
    domId:       'r-desc',
    render:      (r, val) => { r.meta_description = val; }
  },
  focus_keywords: {
    label:       'Focus Keywords',
    requirement: 'Array of 5-7 SEO keywords relevant to the product. Return as JSON array.',
    responseKey: 'focus_keywords',
    domId:       'r-kw',
    isArray:     true,
    render:      (r, val) => { r.focus_keywords = val; }
  },
  alt_text: {
    label:       'Image Alt Text',
    requirement: 'Under 100 characters, descriptive, includes primary keyword.',
    responseKey: 'alt_text',
    domId:       'r-alt',
    render:      (r, val) => { r.alt_text = val; }
  },
  seo_slug: {
    label:       'SEO URL Slug',
    requirement: 'Lowercase, hyphen-separated, no stop words, under 60 characters, relevant to product name.',
    responseKey: 'seo_slug',
    domId:       'r-slug',
    render:      (r, val) => { r.seo_slug = generateSlug(val); }
  },
  product_tags: {
    label:       'Product Tags',
    requirement: 'Array of 5-8 short product tags for OpenCart. Return as JSON array.',
    responseKey: 'product_tags',
    domId:       'r-tags',
    isArray:     true,
    render:      (r, val) => { r.product_tags = val; }
  },
  product_description: {
    label:       'Product Description',
    requirement: '250+ words, 3+ sentences, SEO-rich, no template phrases like "masterpiece of" or "perfect blend".',
    responseKey: 'product_description',
    domId:       'r-prodesc',
    render:      (r, val) => { r.product_description = val; }
  },
  social: {
    label:       'Social Media Content',
    requirement: 'JSON with keys: instagram (80+ words, emojis, hashtags), facebook (80+ words), twitter (under 280 chars), youtube (150-300 words).',
    responseKey: 'socialMedia',
    isObject:    true,
    render:      (r, val) => { r.socialMedia = val; }
  }
};

// ── FILE UPLOAD ───────────────────────────────────────────────
export async function onFileSelect(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    showAlert('gen-alert', 'Image too large. Maximum 10MB.'); return;
  }
  hideAlert('gen-alert');
  try {
    const { dataUrl } = await compressImage(file, 800, 0.75);
    _imageBase64 = dataUrl.split(',')[1];
    _imageMime   = 'image/jpeg';
    _existingProductImageUrl = null;
    _imageSourceIsFile = true;
    _setPreviewImage(dataUrl);
    _updateButtonState();
  } catch {
    showAlert('gen-alert', 'Could not process image. Please try another file.');
  }
}

// ── PRICING CALCULATION ──────────────────────────────────────

/**
 * Calculate discount percentage and savings amount
 */
export function calculateDiscount() {
  const mrp = parseFloat(document.getElementById('prod-mrp')?.value || '0');
  const sellingPrice = parseFloat(document.getElementById('prod-selling-price')?.value || '0');
  const discountEl = document.getElementById('prod-discount');
  const youSaveEl = document.getElementById('prod-you-save');

  if (mrp > 0 && sellingPrice > 0 && sellingPrice <= mrp) {
    const discount = Math.round(((mrp - sellingPrice) / mrp) * 100);
    const youSave = mrp - sellingPrice;
    if (discountEl) discountEl.value = `${discount}%`;
    if (youSaveEl) youSaveEl.value = `₹${youSave.toFixed(2)}`;
  } else {
    if (discountEl) discountEl.value = '';
    if (youSaveEl) youSaveEl.value = '';
  }
}

export function initDragDrop() {
  const box = document.getElementById('upload-box');
  if (!box) return;
  box.addEventListener('dragover', e => { e.preventDefault(); box.classList.add('drag-over'); });
  box.addEventListener('dragleave', () => box.classList.remove('drag-over'));
  box.addEventListener('drop', e => {
    e.preventDefault(); box.classList.remove('drag-over');
    const file = e.dataTransfer.files?.[0];
    if (file) onFileSelect({ target: { files: [file] } });
  });

  // Live validation on name + category changes
  const nameInput = document.getElementById('prod-name');
  const catSelect = document.getElementById('prod-cat');
  if (nameInput) nameInput.addEventListener('input', _updateButtonState);
  if (catSelect) catSelect.addEventListener('change', _updateButtonState);

  // Initial state
  _updateButtonState();
}

// ── START NEW PRODUCT ─────────────────────────────────────────
/**
 * Req 4: Resets all generated SEO, cached AI context, stored image, and score.
 * Call this when the user explicitly starts a new product.
 */
export function startNewProduct() {
  _imageBase64   = null;
  _imageMime     = 'image/jpeg';
  _productId     = null;
  _currentResult = null;
  _busy          = false;
  _existingProductImageUrl = null;
  _imageSourceIsFile = false;
  _productContext = null;

  // Reset form fields
  const nameEl = document.getElementById('prod-name');
  const catEl  = document.getElementById('prod-cat');
  const langEl = document.getElementById('prod-lang');
  const modelNumberEl = document.getElementById('prod-model-number');
  if (nameEl) nameEl.value = '';
  if (catEl)  catEl.value  = '';
  if (langEl) langEl.value = 'en';
  if (modelNumberEl) modelNumberEl.value = '';

  // Reset pricing fields
  const mrpEl = document.getElementById('prod-mrp');
  const sellingPriceEl = document.getElementById('prod-selling-price');
  const discountEl = document.getElementById('prod-discount');
  const youSaveEl = document.getElementById('prod-you-save');
  if (mrpEl) mrpEl.value = '';
  if (sellingPriceEl) sellingPriceEl.value = '';
  if (discountEl) discountEl.value = '';
  if (youSaveEl) youSaveEl.value = '';

  // Reset file input and preview
  const fileInp = document.getElementById('file-inp');
  if (fileInp) fileInp.value = '';
  _setPreviewImage(null);

  // Hide result panel, show empty state
  const resultContent = document.getElementById('result-content');
  const resultEmpty   = document.getElementById('result-empty');
  if (resultContent) resultContent.style.display = 'none';
  if (resultEmpty)   resultEmpty.style.display   = '';

  hideAlert('gen-alert');
  _updateButtonState();
}

// ── FORM VALIDATION ───────────────────────────────────────────
/**
 * Returns a list of validation errors, or empty array if all required fields are present.
 * Required: image, product name, category.
 */
function _validateForm() {
  const errors = [];
  if (!_hasImageAvailable()) {
    errors.push('Product image is required. Please upload a photo of your product.');
  }
  const name = (document.getElementById('prod-name')?.value || '').trim();
  if (!name) {
    errors.push('Product name is required.');
  }
  const cat = document.getElementById('prod-cat')?.value || '';
  if (!cat) {
    errors.push('Category is required. Please select a product category.');
  }
  return errors;
}

/**
 * Enable/disable the generate button based on whether all required
 * fields are filled. Updates the visual indicator on each required field.
 */
function _updateButtonState() {
  const errors = _validateForm();
  const ready  = errors.length === 0;
  const btn    = document.getElementById('gen-btn');
  if (btn) {
    btn.disabled = ready ? false : true;
    btn.title    = ready ? '' : errors.join(' / ');
  }

  // Visual indicators on the required fields
  const name  = (document.getElementById('prod-name')?.value || '').trim();
  const cat   = document.getElementById('prod-cat')?.value || '';
  _setFieldState('upload-box',    _hasImageAvailable());
  _setFieldState('name-row',      !!name);
  _setFieldState('cat-row',       !!cat);
}

function _setFieldState(id, valid) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('field-ok',      valid);
  el.classList.toggle('field-missing', !valid);
}

// ── FULL GENERATE ─────────────────────────────────────────────
export async function generate() {
  if (_busy) return;
  hideAlert('gen-alert');

  if (!document.getElementById('prod-name') || !document.getElementById('prod-cat')) {
    showAlert('gen-alert', 'The generator form is not ready yet. Please refresh the page and try again.');
    return;
  }

  if (isAccessRestricted()) { showAlert('gen-alert', getAccessMessage()); return; }

  // ── Mandatory field validation ──────────────────────────────
  const validationErrors = _validateForm();
  if (validationErrors.length) {
    showAlert('gen-alert', validationErrors.join('\n'));
    _updateButtonState(); // refresh visual indicators
    return;
  }

  const name     = (document.getElementById('prod-name')?.value || '').trim();
  const cat      = document.getElementById('prod-cat')?.value   || '';
  const lang     = document.getElementById('prod-lang')?.value  || 'en';

  if (!await _ensureImageReady()) {
    showAlert('gen-alert', 'Product image is required. Please upload a photo of your product.');
    return;
  }
  const modelNumber = normalizeModelNumber(document.getElementById('prod-model-number')?.value || '');
  const provider = document.getElementById('prod-provider')?.value || 'groq';
  const apiKey   = getApiKey(provider);

  if (!validateKey(apiKey, provider)) {
    showAlert('gen-alert',
      `No valid ${provider} API key found.\nGo to Settings to add your key.`);
    return;
  }

  _busy = true;
  const btn       = document.getElementById('gen-btn');
  const origLabel = btn?.innerHTML || '';
  if (btn) { btn.disabled = true; btn.textContent = 'Generating...'; }

  showLoading('AI SEO Engine', [
    'Validating inputs...',
    'Processing product data...',
    'Analysing product image...',
    'Generating SEO content...',
    'Computing SEO score...',
    'Saving product...'
  ]);

  try {
    // Step 0 — Handle product creation/selection
    completeStep(0, 10);
    if (!_imageBase64) {
      throw new Error('Product image is required');
    }

    completeStep(1, 25, 'Preparing product image...');
    
    let productId = _productId;
    let imageUrl = '';
    let publicId = '';
    const reuseExistingImage = !_imageSourceIsFile && !!_existingProductImageUrl;
    
    try {
      if (reuseExistingImage) {
        imageUrl = _existingProductImageUrl;
        publicId = _productContext?.publicId || '';
      } else {
        // Convert base64 to file for upload
        const response = await fetch(`data:${_imageMime};base64,${_imageBase64}`);
        const blob = await response.blob();
        const file = new File([blob], `product_${Date.now()}.jpg`, { type: _imageMime });
        const uploadResult = await uploadImage(file, 'products', {
          publicId: `product_${getUser()?.uid}_${Date.now()}`
        });
        
        imageUrl = uploadResult.secure_url;
        publicId = uploadResult.public_id;
      }
      
      // Products contains product data only. SEO_History stores only the
      // generated SEO document and references this product by ID.
      if (modelNumber) {
        const duplicate = await checkModelNumberExists(modelNumber, productId || null);
        if (duplicate) {
          const duplicateName = duplicate.productName || 'Unknown Product';
          throw new Error(`Model number ${modelNumber} is already available for ${duplicateName}. Check your database and update it.`);
        }
      }

      const productData = {
        productName: name,
        imageUrl: imageUrl,
        publicId,
        modelNumber,
        category: cat,
        createdBy: getUser()?.uid,
        createdAt: FB.serverTimestamp(),
        updatedAt: FB.serverTimestamp()
      };
      
      // Get pricing data from form (reference only)
      const mrp = parseFloat(document.getElementById('prod-mrp')?.value || '0');
      const sellingPrice = parseFloat(document.getElementById('prod-selling-price')?.value || '0');
      if (mrp > 0) productData.mrp = mrp;
      if (sellingPrice > 0) productData.sellingPrice = sellingPrice;
      if (mrp > 0 && sellingPrice > 0) {
        productData.discount = Math.round(((mrp - sellingPrice) / mrp) * 100);
        productData.youSave = mrp - sellingPrice;
      }
      
      if (productId) {
        await FB.updateDoc(FB.docRef('products', productId), productData);
      } else {
        const productDoc = await FB.addDoc(FB.col('products'), productData);
        productId = productDoc.id;
      }
      _productId = productId;
      
      showToast(reuseExistingImage ? 'Product saved successfully' : 'Product created and image uploaded successfully');
      
    } catch (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Image upload failed: ${uploadError.message}`);
    }

    // Step 2 — SEO_History is upserted later by product ID + language.
    completeStep(2, 35);

    const style = SEO_STYLES[Math.floor(Math.random() * SEO_STYLES.length)];

    // Step 3 — AI call with image (vision) + prompt
    completeStep(3, 55, 'Analysing image with AI...');
    const text = await callAI(
      [{ role: 'user', content: _buildFullPrompt(name, cat, lang, style) }],
      apiKey, provider,
      {
        temperature:  getUserDoc()?.temperature ?? 0.9,
        maxTokens:    getUserDoc()?.maxTokens   ?? 1800,
        // Pass image so the AI can visually analyse the product
        imageBase64:  _imageBase64,
        imageMime:    _imageMime
      }
    );
    completeStep(4, 75, 'Parsing response...');

    const parsed = parseJsonSafe(text);
    if (!parsed) throw new Error('AI returned an unparseable response. Please try again.');
    console.info('[Generator] AI response:', parsed);

    parsed.seo_slug    = generateSlug(parsed.seo_slug || name);
    parsed.socialMedia = parsed.socialMedia || { instagram: '', facebook: '', twitter: '', youtube: '' };

    _currentResult = {
      ...parsed,
      productId,       // Store product ID for single source of truth
      productName:    name,
      category:       cat,
      lang,
      provider,
      generatedStyle: style,
      imageThumb:     _imageBase64 ? `data:${_imageMime};base64,${_imageBase64}` : null,
      timestamp:      Date.now(),
      uid:            getUser()?.uid,
      versions:       []
    };

    // Step 4 — Score (computed locally, never from AI output)
    completeStep(5, 90, 'Scoring...');
    const sd = computeSeoScore(_currentResult);
    _currentResult._scoreData = sd;

    // Step 5 — auto-save gate
    completeStep(6, 100, 'Done.');
    await new Promise(r => setTimeout(r, 350));
    hideLoading();
    if (btn) { btn.disabled = false; btn.innerHTML = origLabel; }
    _busy = false;

    renderResult(_currentResult, sd);
    await _handleAutoSave(sd.score);

  } catch (err) {
    hideLoading(); _busy = false;
    if (btn) { btn.disabled = false; btn.innerHTML = origLabel; }
    showAlert('gen-alert', friendlyError(err));
  }
}

// ── REGENERATE FULL (saves current as version first) ─────────
export async function regenerate() {
  if (!_currentResult || _busy) return;
  _currentResult.versions = _currentResult.versions || [];
  _currentResult.versions.push({
    ..._currentResult, versions: undefined,
    savedAt: new Date().toISOString()
  });
  await generate();
}

// ── SECTION-LEVEL REGENERATION ────────────────────────────────
/**
 * Regenerates a single SEO section with full requirements:
 *  - Passes image, product name, category, and current field value to AI
 *  - Retries up to 3 times if response is identical to existing content
 *  - Creates a version snapshot before replacing the field
 *  - Animates the updated DOM element so the user sees the change
 *  - Reports old → new score with improvement delta
 *  - Shows a spinner on the clicked button while the request is in flight
 *  - Logs request/response to the browser console for debugging
 *
 * @param {string} sectionKey  - Key from SECTIONS map (e.g. 'meta_title')
 */
export async function regenerateSection(sectionKey) {
  if (!_currentResult) { showToast('Generate SEO content first.'); return; }
  if (_busy) { showToast('Please wait — an AI call is already in progress.'); return; }

  const section = SECTIONS[sectionKey];
  if (!section) { console.warn('[Generator] Unknown section key:', sectionKey); return; }

  // ── Req 1+2: Validate mandatory context before any AI call ──
  // AI Improve needs the same inputs as Generate: image, name, category.
  // Image is kept in memory (_imageBase64), but name/category come from
  // _currentResult (set at generation time), so they are always available
  // once generation has run. Guard against edge cases where context is stale.
  const missingContext = [];
  if (!_imageBase64)               missingContext.push('Product image (upload an image first)');
  if (!_currentResult.productName) missingContext.push('Product name');
  if (!_currentResult.category)    missingContext.push('Category');
  if (missingContext.length) {
    showToast('AI Improve requires: ' + missingContext.join(', ') + '. Please generate content first.');
    return;
  }

  const provider = _currentResult.provider || document.getElementById('prod-provider')?.value || 'groq';
  const apiKey   = getApiKey(provider);

  if (!validateKey(apiKey, provider)) {
    showToast(`No valid ${provider} API key. Go to Settings.`); return;
  }

  // Capture the score BEFORE making any changes (for delta reporting)
  const currentSd = _currentResult._scoreData || computeSeoScore(_currentResult);
  const scoreBefore = currentSd.score;

  // Snapshot current field value so we can detect no-change responses
  const prevValue = _getFieldValue(sectionKey, _currentResult);

  if (sectionKey === 'product_description') {
    const allFailedChecksBefore = currentSd.checks.filter(c => !c.pass);
    const fieldFailedChecksBefore = allFailedChecksBefore.filter(c => c.field === sectionKey);
    console.group('AI IMPROVE DEBUG');
    console.log('FIELD:', sectionKey);
    console.log('ORIGINAL VALUE:', prevValue);
    console.log('OLD SEO SCORE:', scoreBefore);
    console.log('ALL FAILED CHECKS BEFORE:', allFailedChecksBefore.map(c => ({ label: c.label, field: c.field, pass: c.pass })));
    console.log('FIELD FAILED CHECKS BEFORE:', fieldFailedChecksBefore.map(c => ({ label: c.label, field: c.field, pass: c.pass })));
    console.groupEnd();
  }

  _busy = true;
  _setSectionBusy(sectionKey, true);

  const MAX_RETRIES = 3;
  let   attempt     = 0;
  let   newValue    = null;
  let   lastReason  = '';

  try {
    while (attempt < MAX_RETRIES) {
      attempt++;
      const prompt = _buildSectionPrompt(sectionKey, section, _currentResult, attempt, currentSd, lastReason);

      // ── Dev console logging ──────────────────────────────────
      console.group(`[Regenerate] ${section.label} — attempt ${attempt}/${MAX_RETRIES}`);
      console.log('Provider:', provider);
      console.log('Product:', _currentResult.productName, '|', _currentResult.category);
      console.log('Previous value:', prevValue);
      console.log('Prompt:', prompt);

      const text = await callAI(
        [{ role: 'user', content: prompt }],
        apiKey,
        provider,
        {
          temperature:  Math.min(1.4, (getUserDoc()?.temperature ?? 0.9) + (attempt - 1) * 0.15),
          maxTokens:    section.isObject ? 1200 : 700,
          // Pass image so AI has visual context for colour/style/material fields
          imageBase64:  _imageBase64  || null,
          imageMime:    _imageMime    || 'image/jpeg'
        }
      );

      console.log('Raw AI response:', text);

      const parsed = parseJsonSafe(text);
      console.log('Parsed:', parsed);
      console.groupEnd();

      if (!parsed || parsed[section.responseKey] === undefined) {
        if (attempt === MAX_RETRIES) throw new Error(`AI did not return a valid ${section.label} after ${MAX_RETRIES} attempts.`);
        console.warn(`[Regenerate] Attempt ${attempt}: response missing key "${section.responseKey}", retrying...`);
        await new Promise(r => setTimeout(r, 500));
        continue;
      }

      let candidate = parsed[section.responseKey];
      if (sectionKey === 'seo_slug') candidate = generateSlug(candidate || _currentResult.productName);

      // Normalize to string for comparison (arrays → sorted join)
      const normalize = v => Array.isArray(v) ? [...v].sort().join('|') : safeStr(v).trim();
      const isDuplicate = normalize(candidate) === normalize(prevValue);

      if (isDuplicate && attempt < MAX_RETRIES) {
        lastReason = 'The previous result was identical to the current value.';
        console.warn(`[Regenerate] Attempt ${attempt}: response identical to previous, retrying...`);
        await new Promise(r => setTimeout(r, 400));
        continue;
      }

      candidate = _applyDeterministicFallback(sectionKey, candidate, _currentResult, currentSd);
      candidate = _normalizeCandidateForValidation(sectionKey, candidate);
      if (sectionKey === 'product_description') {
        console.log('ATTEMPT:', attempt);
        console.log('AI GENERATED VALUE:', candidate);
      }
      const validation = _validateImprovedValue(sectionKey, candidate, _currentResult, currentSd, attempt);
      if (!validation.ok) {
        lastReason = validation.reason || `Attempt ${attempt} still failed the targeted SEO checks.`;
        console.warn(`[Regenerate] Attempt ${attempt}: ${lastReason}`);
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 400));
          continue;
        }
      } else {
        if (sectionKey === 'product_description') {
          console.log('ACCEPTANCE CONDITION: accepted');
          console.log('NEW GLOBAL SCORE:', computeSeoScore({ ..._currentResult, product_description: candidate }).score);
        }
        newValue = candidate;
        break;
      }
    }

    if (newValue === null) {
      if (sectionKey === 'product_description') {
        console.log('ACCEPTANCE CONDITION: rejected after max attempts');
      }
      throw new Error('Unable to generate a valid improvement after 3 attempts. Your original content has been preserved.');
    }

    // ── Save version snapshot BEFORE replacing ───────────────
    _currentResult.versions = _currentResult.versions || [];
    _currentResult.versions.push({
      ..._currentResult,
      versions:    undefined,
      savedAt:     new Date().toISOString(),
      versionNote: `Before regenerating: ${section.label}`
    });

    // ── Apply only the changed field ─────────────────────────
    section.render(_currentResult, newValue);
    _currentResult.timestamp = Date.now();

    // ── Recompute score (never trust AI) ─────────────────────
    const sd          = computeSeoScore(_currentResult);
    _currentResult._scoreData = sd;
    const scoreAfter  = sd.score;
    const scoreDelta  = scoreAfter - scoreBefore;
    _setImproveState(section.label, scoreBefore, scoreAfter, scoreDelta);

    // ── Patch DOM — only the changed element ─────────────────
    _patchDom(sectionKey, _currentResult);
    _updateScoreUI(sd);
    _animateField(sectionKey);    // flash green so user sees the change

    // ── Score delta feedback ──────────────────────────────────
    const deltaMsg = scoreDelta > 0
      ? `+${scoreDelta} improvement`
      : scoreDelta < 0
        ? `${scoreDelta} (score decreased)`
        : 'Score unchanged — ' + _explainNoImprovement(sectionKey, sd);

    showToast(`${section.label} updated. Score: ${scoreBefore} -> ${scoreAfter} (${deltaMsg})`);
    console.log(`[Regenerate] Done. Score ${scoreBefore} -> ${scoreAfter} (delta: ${scoreDelta})`);

  } catch (err) {
    console.error('[Generator] regenerateSection failed:', err);
    showToast(err?.message || friendlyError(err));
  } finally {
    _busy = false;
    _setSectionBusy(sectionKey, false);
  }
}

// ── IMPROVE FAILED ITEMS ──────────────────────────────────────
/**
 * Detects all failed SEO checks and regenerates only those sections.
 * Makes one AI call per failed section — no wasted tokens for passing fields.
 */
export async function improveFailedItems() {
  if (!_currentResult) { showToast('Generate SEO content first.'); return; }
  if (_busy) { showToast('Please wait — an AI call is in progress.'); return; }

  const sd      = computeSeoScore(_currentResult);
  const failed  = [...new Set(sd.failed)]; // unique field keys

  if (!failed.length) {
    showToast('All SEO checks are already passing!'); return;
  }

  // Map field keys to section keys (seo_slug appears twice in checks)
  const sectionsToFix = [...new Set(
    failed
      .filter(f => SECTIONS[f])
      .map(f => f)
  )];

  if (!sectionsToFix.length) {
    showToast('No auto-fixable sections found.'); return;
  }

  showToast(`Improving ${sectionsToFix.length} section(s)...`);

  // Run sequentially to avoid rate-limiting
  for (const key of sectionsToFix) {
    await regenerateSection(key);
    // Small pause between calls
    await new Promise(r => setTimeout(r, 400));
  }

  const finalSd = computeSeoScore(_currentResult);
  _currentResult._scoreData = finalSd;
  _updateScoreUI(finalSd);
  showToast(`Improvements done. Score: ${finalSd.score}/100`);
}

// ── AUTO-SAVE LOGIC ───────────────────────────────────────────
async function _handleAutoSave(score) {
  // Every completed generation must be persisted. The score only controls
  // the existing banner wording; it must not decide whether SEO exists.
  await _saveToFirestore(_currentResult);
  if (score >= 98) {
    showToast(`Score ${score}/100 reached — Auto-saved to Firebase!`);
    _updateAutoSaveBanner(score, true);
  } else {
    _updateAutoSaveBanner(score, false);
  }
}

function _updateAutoSaveBanner(score, saved) {
  const banner = document.getElementById('autosave-banner');
  if (!banner) return;
  if (saved) {
    banner.className = 'autosave-notice saved';
    banner.textContent = 'Auto-saved to Firebase (Score: ' + score + '/100)';
  } else {
    banner.className = 'autosave-notice pending';
    banner.textContent = 'Score: ' + score + '/100 — Use "Improve Failed Items" or "Save Anyway"';
  }
}

// ── DOM PATCHING (no full re-render needed for section changes) ──
function _patchDom(sectionKey, r) {
  switch (sectionKey) {
    case 'meta_title': {
      const el = document.getElementById('r-title');
      if (el) el.textContent = safeStr(r.meta_title);
      // Update char pill
      const pill = document.getElementById('title-char-pill');
      if (pill) pill.outerHTML = charPill(r.meta_title.length, 50, 70);
      break;
    }
    case 'meta_description': {
      const el = document.getElementById('r-desc');
      if (el) el.textContent = safeStr(r.meta_description);
      const pill = document.getElementById('desc-char-pill');
      if (pill) pill.outerHTML = charPill(r.meta_description.length, 140, 160);
      break;
    }
    case 'focus_keywords': {
      const el = document.getElementById('r-kw');
      if (el) el.innerHTML = (r.focus_keywords || []).map(k => `<span class="kw-tag">${k}</span>`).join('');
      break;
    }
    case 'alt_text': {
      const el = document.getElementById('r-alt');
      if (el) el.textContent = safeStr(r.alt_text);
      break;
    }
    case 'seo_slug': {
      const el = document.getElementById('r-slug');
      if (el) el.textContent = safeStr(r.seo_slug);
      // Re-render slug checklist
      const cl = document.getElementById('slug-checklist');
      if (cl) cl.innerHTML = _buildSlugChecklist(r.seo_slug);
      break;
    }
    case 'product_tags': {
      const el = document.getElementById('r-tags');
      if (el) el.innerHTML = (r.product_tags || []).map(t => `<span class="prod-tag">${t}</span>`).join('');
      break;
    }
    case 'product_description': {
      const el = document.getElementById('r-prodesc');
      if (el) el.textContent = safeStr(r.product_description);
      break;
    }
    case 'social': {
      const sm = r.socialMedia || {};
      const ids = { instagram: 'r-ig', facebook: 'r-fb', twitter: 'r-tw', youtube: 'r-yt' };
      Object.entries(ids).forEach(([key, id]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = safeStr(sm[key]);
      });
      break;
    }
  }
  // Always refresh OpenCart block since it mirrors all fields
  const oc = document.getElementById('r-oc');
  if (oc) oc.textContent = _buildOpenCartText(r);
}

function _updateScoreUI(sd) {
  // Re-animate score ring
  animateScoreRing(sd.score, sd.cat.color, 'score-ring-fill', 'score-val');

  const banner = document.getElementById('autosave-banner');
  if (banner) {
    banner.innerHTML = sd.score >= 98
      ? `✅ Auto-saved to Firebase (Score: ${sd.score}/100)`
      : `Score: ${sd.score}/100 — Improve failed items or save manually.`;
    banner.className = `autosave-notice ${sd.score >= 98 ? 'saved' : 'pending'}`;
  }

  _renderImproveFeedback(sd);

  // Update status label
  const status = document.getElementById('score-status-label');
  if (status) { status.textContent = sd.cat.label + ' SEO'; status.style.color = sd.cat.color; }

  // Re-render checklist
  const cl = document.getElementById('score-checklist');
  if (cl) cl.innerHTML = sd.checks.map(c => {
    const cls  = c.pass ? 'ci-good' : 'ci-bad';
    const icon = c.pass ? '&#x2713;' : '&#x2717;';
    return `<div class="score-check"><div class="check-icon ${cls}">${icon}</div><span>${c.label}</span></div>`;
  }).join('');

  // Update improve button label
  const improveBtn = document.getElementById('improve-btn');
  if (improveBtn) {
    const failCount = sd.failed.length;
    improveBtn.textContent = failCount
      ? `Improve ${failCount} Failed Item${failCount > 1 ? 's' : ''}`
      : 'All Checks Passing';
    improveBtn.disabled = failCount === 0;
  }
}

function _renderImproveFeedback(sd) {
  const feedback = document.getElementById('score-improve-feedback');
  if (!feedback) return;

  if (_lastImproveScoreBefore === null || _lastImproveScoreAfter === null || !_lastImprovedField) {
    feedback.style.display = 'none';
    feedback.innerHTML = '';
    return;
  }

  const diff = _lastImproveScoreDifference;
  const before = _lastImproveScoreBefore;
  const after = _lastImproveScoreAfter;
  const field = _lastImprovedField;

  const message = diff > 0
    ? `${field} successfully improved.`
    : `${field} improved successfully.`;

  const details = diff > 0
    ? `<div class="score-improve-values"><span>${before}</span><span>→</span><span>${after}</span></div>
       <div class="score-improve-change">+${diff} points</div>`
    : `<div class="score-improve-values"><span>${after}</span><span>Overall SEO Score remains</span></div>`;

  feedback.innerHTML = `
    <div class="autosave-notice saved" style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:0.75rem;">
      <div>
        <div style="font-weight:600;">SEO Score ${diff > 0 ? 'Improved 🎉' : 'Update'}</div>
        <div style="margin:.35rem 0;">
          ${diff > 0 ? details : `${message} ${after}/100.`}
        </div>
        <div>${message}</div>
      </div>
      <button class="btn btn-ghost btn-xs" onclick="window.Generator.viewSeoScore()">View SEO Score</button>
    </div>
  `;

  feedback.style.display = 'block';
}

function _setImproveState(field, before, after, diff) {
  _lastImproveScoreBefore = before;
  _lastImproveScoreAfter = after;
  _lastImproveScoreDifference = diff;
  _lastImprovedField = field;
}

function _setSectionBusy(sectionKey, busy) {
  const btn = document.getElementById(`regen-btn-${sectionKey}`);
  if (!btn) return;
  btn.disabled = busy;
  if (busy) {
    btn.dataset.origText = btn.textContent;
    btn.innerHTML = '<span class="regen-spinner"></span>Improving...';
  } else {
    btn.textContent = btn.dataset.origText || '&#x2728; AI Improve';
  }
}

/**
 * Read the current value of a section from _currentResult.
 * Returns the raw value (array for array fields, object for social).
 */
function _getFieldValue(sectionKey, r) {
  switch (sectionKey) {
    case 'meta_title':          return safeStr(r.meta_title);
    case 'meta_description':    return safeStr(r.meta_description);
    case 'alt_text':            return safeStr(r.alt_text);
    case 'seo_slug':            return safeStr(r.seo_slug);
    case 'product_description': return safeStr(r.product_description);
    case 'focus_keywords':      return Array.isArray(r.focus_keywords) ? r.focus_keywords : [];
    case 'product_tags':        return Array.isArray(r.product_tags)   ? r.product_tags   : [];
    case 'social':              return r.socialMedia || {};
    default:                    return '';
  }
}

/**
 * Flash the updated DOM element green so the user can see something changed.
 * Uses a CSS animation class added then removed after the animation completes.
 */
function _animateField(sectionKey) {
  const idMap = {
    meta_title:          'r-title',
    meta_description:    'r-desc',
    alt_text:            'r-alt',
    seo_slug:            'r-slug',
    product_description: 'r-prodesc',
    focus_keywords:      'r-kw',
    product_tags:        'r-tags',
    social:              'r-ig'   // animate the first social field
  };
  const el = document.getElementById(idMap[sectionKey]);
  if (!el) return;
  el.classList.remove('field-updated');   // reset if re-running quickly
  void el.offsetWidth;                    // force reflow to restart animation
  el.classList.add('field-updated');
  setTimeout(() => el.classList.remove('field-updated'), 1800);
}

/**
 * Return a human-readable reason why the score did not improve after
 * regenerating a specific section.
 */
function _explainNoImprovement(sectionKey, sd) {
  // Maps section keys to the check labels in the new scoring engine (utils.js)
  const checkForSection = {
    meta_title:          ['Meta Title length (50-70 chars)', 'Product keyword in Meta Title', 'Meta Title is unique and specific'],
    meta_description:    ['Meta Description length (140-160 chars)', 'Product keyword in Meta Description', 'Call-to-action in Meta Description'],
    seo_slug:            ['Clean SEO URL Slug', 'Product keyword in SEO Slug'],
    alt_text:            ['Image Alt Text present', 'Product keyword in Image Alt Text'],
    product_description: ['Product Description 200+ words', 'Product Description 3+ sentences', 'Brand / Product name mentioned', 'Category context in Description'],
    focus_keywords:      ['Focus Keywords (5+)'],
    product_tags:        ['Product Tags (5+)']
  };
  const relevant = checkForSection[sectionKey] || [];
  const failing  = sd.checks.filter(c => relevant.includes(c.label) && !c.pass);
  if (!failing.length) {
    return `${SECTIONS[sectionKey]?.label || sectionKey} already meets all SEO requirements.`;
  }
  return failing.map(c => c.label + ' still needs improvement.').join(' ');
}

function _buildSlugChecklist(slug) {
  return validateSlug(slug).map(c =>
    `<div class="check-item ${c.pass ? 'pass' : 'fail'}">
       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
         ${c.pass ? '<polyline points="20 6 9 17 4 12"/>' : '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'}
       </svg>${c.label}
     </div>`
  ).join('');
}

function _normalizeCandidateForValidation(sectionKey, candidate) {
  if (candidate === null || candidate === undefined) return candidate;

  if (sectionKey === 'focus_keywords' || sectionKey === 'product_tags') {
    if (!Array.isArray(candidate)) return candidate;
    return candidate
      .map(v => safeStr(v).trim().replace(/^['"]+|['"]+$/g, ''))
      .filter(v => safeStr(v).trim());
  }

  if (sectionKey === 'social') {
    return candidate;
  }

  let value = safeStr(candidate).trim();
  value = value.replace(/^['"]+|['"]+$/g, '');
  value = value.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return value;
}

function _getFieldScopedChecks(sd, sectionKey) {
  return (sd?.checks || []).filter(c => c.field === sectionKey);
}

function _validateImprovedValue(sectionKey, candidate, r, currentSd, attempt = 1) {
  if (candidate === null || candidate === undefined) {
    return { ok: false, reason: 'The generated response was empty.' };
  }

  const normalizeStr = (value) => safeStr(value).trim();
  const normalizeArray = (value) => Array.isArray(value) ? value.filter(v => safeStr(v).trim()).map(v => safeStr(v).trim()) : [];

  candidate = _normalizeCandidateForValidation(sectionKey, candidate);

  switch (sectionKey) {
    case 'meta_title':
    case 'meta_description':
    case 'alt_text':
    case 'seo_slug':
    case 'product_description': {
      const value = normalizeStr(candidate);
      if (!value) return { ok: false, reason: 'The generated content was empty.' };
      if (/^(lorem|placeholder|example|sample|your product|todo|tbd|dummy)/i.test(value)) {
        return { ok: false, reason: 'The generated content looked like placeholder text.' };
      }
      if (value.length < 3) return { ok: false, reason: 'The generated content was too short.' };
      break;
    }
    case 'focus_keywords': {
      const arr = normalizeArray(candidate);
      if (arr.length < 5) return { ok: false, reason: 'The generated keywords did not meet the required count.' };
      break;
    }
    case 'product_tags': {
      const arr = normalizeArray(candidate);
      if (arr.length < 5) return { ok: false, reason: 'The generated tags did not meet the required count.' };
      break;
    }
    case 'social': {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        return { ok: false, reason: 'The social content response was not valid.' };
      }
      const social = candidate;
      const invalidKeys = ['instagram', 'facebook', 'twitter', 'youtube'].filter(key => !safeStr(social[key]).trim());
      if (invalidKeys.length) {
        return { ok: false, reason: 'The generated social content was incomplete.' };
      }
      break;
    }
    default:
      return { ok: false, reason: 'The AI Improve response was not supported for this field.' };
  }

  const tempResult = JSON.parse(JSON.stringify(r));
  const section = SECTIONS[sectionKey];
  if (!section) return { ok: false, reason: 'The field could not be validated.' };
  section.render(tempResult, candidate);
  const tempSd = computeSeoScore(tempResult);

  if (sectionKey === 'product_description') {
    const candidateSeoData = tempResult;
    const allFailedChecksAfter = tempSd.checks.filter(c => !c.pass);
    const fieldFailedChecksBefore = currentSd.checks.filter(c => !c.pass).filter(c => c.field === sectionKey);
    const fieldFailedChecksAfter = allFailedChecksAfter.filter(c => c.field === sectionKey);
    console.group('AI IMPROVE DEBUG');
    console.log('ATTEMPT:', attempt);
    console.log('AI GENERATED VALUE:', candidate);
    console.log('CANDIDATE SEO DATA:', candidateSeoData);
    console.log('CANDIDATE PRODUCT DESCRIPTION:', candidateSeoData.product_description);
    console.log('ALL FAILED CHECKS AFTER:', allFailedChecksAfter.map(c => ({ label: c.label, field: c.field, pass: c.pass })));
    console.log('FIELD FAILED CHECKS AFTER:', fieldFailedChecksAfter.map(c => ({ label: c.label, field: c.field, pass: c.pass })));
    console.log('OLD FIELD FAILURE COUNT:', fieldFailedChecksBefore.length);
    console.log('NEW FIELD FAILURE COUNT:', fieldFailedChecksAfter.length);
    console.log('OLD GLOBAL SCORE:', currentSd.score);
    console.log('NEW GLOBAL SCORE:', tempSd.score);
    console.groupEnd();
  }

  const beforeChecks = _getFieldScopedChecks(currentSd, sectionKey);
  const afterChecks = _getFieldScopedChecks(tempSd, sectionKey);
  const failingChecks = beforeChecks.filter(c => !c.pass);
  const relevantFailuresAfter = afterChecks.filter(c => !c.pass);
  const beforeCheckMap = new Map(beforeChecks.map(c => [c.label, c.pass]));
  const afterCheckMap = new Map(afterChecks.map(c => [c.label, c.pass]));
  const resolved = failingChecks.filter(check => afterCheckMap.get(check.label));
  const stillFailing = failingChecks.filter(check => !afterCheckMap.get(check.label));
  const introduced = relevantFailuresAfter.filter(check => beforeCheckMap.get(check.label) === true);
  const beforePassWeight = beforeChecks.filter(c => c.pass).reduce((sum, c) => sum + (c.weight || 0), 0);
  const afterPassWeight = afterChecks.filter(c => c.pass).reduce((sum, c) => sum + (c.weight || 0), 0);
  const failedCountBefore = failingChecks.length;
  const failedCountAfter = relevantFailuresAfter.length;
  const failureCountImproved = failedCountAfter < failedCountBefore;
  const scoreImproved = afterPassWeight > beforePassWeight;
  const passesAllField = failedCountAfter === 0;
  const currentGlobalScore = currentSd.score;
  const candidateGlobalScore = tempSd.score;
  const acceptable = candidateGlobalScore >= currentGlobalScore && (passesAllField || failureCountImproved || scoreImproved);

  const detail = stillFailing[0]?.label || 'the targeted SEO checks';
  const failureDetail = detail.includes('length') ? `${detail}. Adjust the length to satisfy the existing rule.` : detail;

  const acceptanceCondition = acceptable ? 'accepted' : 'rejected';
  const rejectionReason = acceptable
    ? 'accepted'
    : candidateGlobalScore < currentGlobalScore
      ? `Candidate overall SEO score dropped from ${currentGlobalScore} to ${candidateGlobalScore}.`
      : (failureCountImproved || scoreImproved)
        ? 'accepted'
        : (relevantFailuresAfter.length === failingChecks.length
          ? `Attempt ${attempt} did not improve the targeted SEO checks.`
          : `Attempt ${attempt} still failed: ${failureDetail}`);

  console.groupCollapsed(`[AI Improve] Field: ${sectionKey} | Attempt: ${attempt}/3`);
  console.log('Field:', sectionKey);
  console.log('Original failed checks:', failingChecks.map(c => c.label));
  console.log('Generated value:', candidate);
  console.log('Generated value length:', safeStr(candidate).length);
  console.log('Validation result:', acceptanceCondition);
  console.log('Remaining targeted failures:', relevantFailuresAfter.map(c => c.label));
  console.log('Resolved targeted failures:', resolved.map(c => c.label));
  console.log('OLD FIELD FAILURE COUNT:', failingChecks.length);
  console.log('NEW FIELD FAILURE COUNT:', relevantFailuresAfter.length);
  console.log('OLD GLOBAL SCORE:', currentGlobalScore);
  console.log('NEW GLOBAL SCORE:', candidateGlobalScore);
  console.log('ACCEPTANCE CONDITION:', acceptanceCondition);
  console.log('REJECTION REASON:', rejectionReason);
  console.log('Before field-specific score:', beforePassWeight);
  console.log('After field-specific score:', afterPassWeight);
  console.groupEnd();

  if (!acceptable) {
    return { ok: false, reason: introduced.length
      ? `Attempt ${attempt} introduced new field-specific failures: ${introduced.map(c => c.label).join(', ')}`
      : (relevantFailuresAfter.length === failingChecks.length
        ? `Attempt ${attempt} did not improve the targeted SEO checks.`
        : `Attempt ${attempt} still failed: ${failureDetail}`),
      remainingFailures: relevantFailuresAfter.map(c => c.label),
      resolvedFailures: resolved.map(c => c.label) };
  }

  return { ok: true, tempSd, remainingFailures: relevantFailuresAfter.map(c => c.label), resolvedFailures: resolved.map(c => c.label) };
}

function _applyDeterministicFallback(sectionKey, candidate, r, currentSd) {
  const value = safeStr(candidate).trim();
  if (!value) return candidate;

  const title = safeStr(r.productName).trim();
  const cat = safeStr(r.category).trim();
  const maxLen = sectionKey === 'meta_title' ? 70 : sectionKey === 'meta_description' ? 160 : null;
  const minLen = sectionKey === 'meta_title' ? 50 : sectionKey === 'meta_description' ? 140 : null;

  if (sectionKey === 'meta_title' || sectionKey === 'meta_description') {
    let text = value;
    const words = text.split(/\s+/).filter(Boolean);

    if (sectionKey === 'meta_title') {
      if (text.length > 70) {
        const shortWords = [];
        for (const word of words) {
          shortWords.push(word);
          if (shortWords.join(' ').length >= 60) break;
        }
        text = shortWords.join(' ').replace(/[\s.,;:!?]+$/g, '');
      }
      if (text.length < 50) {
        const extra = `${title}${cat ? ` ${cat}` : ''}`.trim();
        text = `${text} ${extra}`.trim();
        text = text.replace(/\s+/g, ' ');
      }
      return text.length > 70 ? text.slice(0, 70).trim().replace(/\s+[^\s]*$/, '') : text;
    }

    if (sectionKey === 'meta_description') {
      if (text.length > 160) {
        const shortWords = [];
        for (const word of words) {
          shortWords.push(word);
          if (shortWords.join(' ').length >= 150) break;
        }
        text = shortWords.join(' ').replace(/[\s.,;:!?]+$/g, '');
      }
      if (text.length < 140) {
        const suffix = `${title} for ${cat || 'shopping'}`.trim();
        text = `${text} ${suffix}`.trim();
        text = text.replace(/\s+/g, ' ');
      }
      return text.length > 160 ? text.slice(0, 160).trim().replace(/\s+[^\s]*$/, '') : text;
    }
  }

  if (sectionKey === 'product_description') {
    const normalizedCat = cat.split(/[,&]/)[0].trim();
    const wordCount = value.split(/\s+/).filter(Boolean).length;
    const categoryMention = normalizedCat ? new RegExp(`\\b${normalizedCat.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'i').test(value) : false;
    let updated = value;

    if (normalizedCat && !categoryMention) {
      updated += `\n\nAs a standout piece in the ${normalizedCat} category, the ${title} delivers the style and versatility shoppers expect from premium ${normalizedCat.toLowerCase()} accessories.`;
    }

    if (wordCount < 220) {
      updated += `\n\nDesigned to complement every outfit, it balances visible charm with practical comfort, making it ideal for gifting, everyday wear, and special occasions. The necklace brings premium ${normalizedCat.toLowerCase()} design into a lightweight silhouette that's easy to layer with other jewelry. Its detailed finish and elegant shape ensure it fits seamlessly into any curated collection of accessories.`;
    }

    return updated;
  }

  return candidate;
}

// ── RENDER FULL RESULT ────────────────────────────────────────
export function renderResult(r, sd) {
  const empty   = document.getElementById('result-empty');
  const content = document.getElementById('result-content');
  if (empty)   empty.style.display   = 'none';
  if (content) { content.style.display = 'block'; content.innerHTML = _buildResultHTML(r, sd); }

  const ring = document.getElementById('score-ring-fill');
  const valEl = document.getElementById('score-val');
  if (ring && valEl) {
    setTimeout(() => animateScoreRing(sd.score, sd.cat.color, 'score-ring-fill', 'score-val'), 100);
  }

  content?.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchResultTab(btn.dataset.tab, content));
  });
}

function _buildResultHTML(r, sd) {
  const slug   = safeStr(r.seo_slug);
  const tLen   = safeStr(r.meta_title).length;
  const dLen   = safeStr(r.meta_description).length;
  const kws    = (r.focus_keywords || []).map(k => `<span class="kw-tag">${k}</span>`).join('');
  const tags   = (r.product_tags   || []).map(t => `<span class="prod-tag">${t}</span>`).join('');
  const sm     = r.socialMedia || {};
  const saved  = sd.score >= 98;

  const checks = sd.checks.map(c => {
    const cls  = c.pass ? 'ci-good' : 'ci-bad';
    const icon = c.pass ? '&#x2713;' : '&#x2717;';
    return `<div class="score-check"><div class="check-icon ${cls}">${icon}</div><span>${c.label}</span></div>`;
  }).join('');

  const failCount = sd.failed.length;

  // Helper: section header with Copy + AI Improve buttons
  const sHead = (label, copyFn, sectionKey, extraPill = '') =>
    `<div class="seo-field-head">
       <span class="seo-label">${label}</span>
       <div class="seo-actions">
         ${extraPill}
         <button class="btn btn-ghost btn-xs" onclick="${copyFn}">Copy</button>
         <button class="btn btn-ghost btn-xs regen-section-btn" id="regen-btn-${sectionKey}"
                 onclick="window.Generator.regenerateSection('${sectionKey}')">&#x2728; AI Improve</button>
       </div>
     </div>`;

  return `
    <div class="result-header">
      <span class="result-pname">${safeStr(r.productName)}</span>
      <div class="result-btns">
        <button class="btn btn-ghost btn-sm" onclick="window.Generator.regenerate()">Full Regenerate</button>
        <button class="btn btn-outline btn-sm" onclick="window.Generator.copyAll()">Copy All</button>
        <button class="btn btn-primary btn-sm" onclick="window.Generator.saveAnyway()">Save Anyway</button>
      </div>
    </div>

    <div id="autosave-banner" class="autosave-notice ${saved ? 'saved' : 'pending'}">
      ${saved
        ? '&#x2705; Auto-saved to Firebase (Score: ' + sd.score + '/100)'
        : 'Score: ' + sd.score + '/100 &mdash; Improve failed items or save manually.'}
    </div>
    <div id="score-improve-feedback" class="score-improve-feedback" style="display:none;"></div>

    <div class="tabs">
      <button class="tab-btn active" data-tab="score">SEO Score</button>
      <button class="tab-btn" data-tab="seo">SEO Tags</button>
      <button class="tab-btn" data-tab="desc">Description</button>
      <button class="tab-btn" data-tab="url">URL</button>
      <button class="tab-btn" data-tab="tags">Tags</button>
      <button class="tab-btn" data-tab="social">Social</button>
      <button class="tab-btn" data-tab="opencart">OpenCart</button>
    </div>

    <div class="tab-pane active" id="rtab-score">
      <div class="score-panel">
        <div class="score-card">
          <div class="score-ring-wrap">
            <svg class="score-ring" viewBox="0 0 200 200" width="200" height="200">
              <circle cx="100" cy="100" r="90" class="ring-bg"/>
              <circle cx="100" cy="100" r="90" class="ring-fill" id="score-ring-fill"/>
            </svg>
            <div class="score-center">
              <div class="score-val" id="score-val">0</div>
              <div class="score-max">/100</div>
            </div>
          </div>
          <div class="score-status" id="score-status-label" style="color:${sd.cat.color}">${sd.cat.label} SEO</div>
          <button class="btn btn-accent" id="improve-btn"
                  style="margin-top:.75rem;width:100%"
                  onclick="window.Generator.improveFailedItems()"
                  ${failCount === 0 ? 'disabled' : ''}>
            ${failCount ? 'Improve ' + failCount + ' Failed Item' + (failCount > 1 ? 's' : '') : 'All Checks Passing'}
          </button>
        </div>
        <div>
          <h4 style="margin-bottom:.75rem;font-size:.875rem">SEO Checklist</h4>
          <div class="score-checklist" id="score-checklist">${checks}</div>
        </div>
      </div>
    </div>

    <div class="tab-pane" id="rtab-seo">
      <div class="seo-field">
        ${sHead('Meta Title', "window.Generator.copyField('r-title')", 'meta_title',
          `<span id="title-char-pill">${charPill(tLen, 50, 70)}</span>`)}
        <div class="seo-val" id="r-title">${safeStr(r.meta_title)}</div>
      </div>
      <div class="seo-field">
        ${sHead('Meta Description', "window.Generator.copyField('r-desc')", 'meta_description',
          `<span id="desc-char-pill">${charPill(dLen, 140, 160)}</span>`)}
        <div class="seo-val" id="r-desc">${safeStr(r.meta_description)}</div>
      </div>
      <div class="seo-field">
        ${sHead('Focus Keywords', 'window.Generator.copyKw()', 'focus_keywords')}
        <div class="kw-wrap" id="r-kw">${kws}</div>
      </div>
      <div class="seo-field">
        ${sHead('Image Alt Text', "window.Generator.copyField('r-alt')", 'alt_text')}
        <div class="seo-val" id="r-alt">${safeStr(r.alt_text)}</div>
      </div>
    </div>

    <div class="tab-pane" id="rtab-desc">
      <div class="seo-field">
        ${sHead('Product Description', "window.Generator.copyField('r-prodesc')", 'product_description')}
        <div class="seo-val" id="r-prodesc" style="white-space:pre-wrap;min-height:120px">${safeStr(r.product_description)}</div>
      </div>
      <div class="seo-field">
        <div class="seo-field-head">
          <span class="seo-label">Short Description</span>
          <div class="seo-actions"><button class="btn btn-ghost btn-xs" onclick="window.Generator.copyField('r-shortdesc')">Copy</button></div>
        </div>
        <div class="seo-val" id="r-shortdesc">${safeStr(r.short_description)}</div>
      </div>
    </div>

    <div class="tab-pane" id="rtab-url">
      <div class="seo-field">
        ${sHead('SEO URL Slug', "window.Generator.copyField('r-slug')", 'seo_slug')}
        <div class="seo-val mono" id="r-slug">${slug}</div>
      </div>
      <div style="margin-top:.75rem;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text2);margin-bottom:.4rem">11-Point URL Checklist</div>
      <div class="url-checklist" id="slug-checklist">${_buildSlugChecklist(slug)}</div>
    </div>

    <div class="tab-pane" id="rtab-tags">
      <div class="seo-field">
        ${sHead('Product Tags', 'window.Generator.copyTags()', 'product_tags')}
        <div class="kw-wrap" id="r-tags">${tags}</div>
      </div>
    </div>

    <div class="tab-pane" id="rtab-social">
      <div class="seo-field">
        ${sHead('Social Media Content', "window.Generator.copyField('r-ig')", 'social')}
      </div>
      <div class="seo-field">
        <div class="seo-field-head"><span class="seo-label">Instagram</span><button class="btn btn-ghost btn-xs" onclick="window.Generator.copyField('r-ig')">Copy</button></div>
        <div class="seo-val" id="r-ig" style="white-space:pre-wrap;min-height:100px">${safeStr(sm.instagram)}</div>
      </div>
      <div class="seo-field">
        <div class="seo-field-head"><span class="seo-label">Facebook</span><button class="btn btn-ghost btn-xs" onclick="window.Generator.copyField('r-fb')">Copy</button></div>
        <div class="seo-val" id="r-fb" style="white-space:pre-wrap;min-height:100px">${safeStr(sm.facebook)}</div>
      </div>
      <div class="seo-field">
        <div class="seo-field-head"><span class="seo-label">X (Twitter)</span><button class="btn btn-ghost btn-xs" onclick="window.Generator.copyField('r-tw')">Copy</button></div>
        <div class="seo-val" id="r-tw" style="white-space:pre-wrap">${safeStr(sm.twitter)}</div>
      </div>
      <div class="seo-field">
        <div class="seo-field-head"><span class="seo-label">YouTube</span><button class="btn btn-ghost btn-xs" onclick="window.Generator.copyField('r-yt')">Copy</button></div>
        <div class="seo-val" id="r-yt" style="white-space:pre-wrap;min-height:120px">${safeStr(sm.youtube)}</div>
      </div>
    </div>

    <div class="tab-pane" id="rtab-opencart">
      <p style="font-size:.78rem;color:var(--text2);margin-bottom:.75rem">Copy-paste directly into your OpenCart product editor.</p>
      <div class="seo-field">
        <div class="seo-field-head">
          <span class="seo-label">OpenCart Format</span>
          <button class="btn btn-ghost btn-xs" onclick="window.Generator.copyField('r-oc')">Copy All</button>
        </div>
        <div class="oc-box" id="r-oc">${_buildOpenCartText(r)}</div>
      </div>
    </div>`;
}

// ── PROMPT BUILDERS ───────────────────────────────────────────
/**
 * Full-generation prompt.
 *
 * When an image is attached (via callAI opts.imageBase64), the AI receives
 * the image AND this text together. The prompt explicitly asks the AI to
 * infer product attributes from the visual — but instructs it NOT to
 * fabricate attributes that are not actually visible.
 */
function _buildFullPrompt(name, cat, lang, style) {
  const langInstr = {
    en: 'Write all output in English.',
    hi: 'Write ALL output in Hindi using Devanagari script.',
    te: 'Write ALL output in Telugu using Telugu script.'
  };

  return `You are an expert product SEO copywriter. ${langInstr[lang] || langInstr.en}

INPUTS PROVIDED:
- Product Name: ${name}
- Category: ${cat}
- Marketing Angle: ${style}
- Product Image: attached above — analyse it carefully.

IMAGE ANALYSIS TASK (do this first, internally):
Look at the product image and identify ONLY what is clearly visible. Extract:
- Product type (what is it exactly?)
- Primary colour(s)
- Material or fabric (if visible)
- Pattern or print (e.g. solid, striped, floral)
- Style or silhouette
- Apparent gender or target audience
- Any visible branding, logos, or unique design details
- Unique selling points visible in the image

IMPORTANT RULES:
- Do NOT invent attributes. Only describe what you can genuinely see or confidently infer from the product name and category.
- Do NOT use these banned phrases: "Elevate your", "masterpiece of", "perfect blend of", "crafted with high-quality", "ideal for any occasion", "showcases a beautiful", "exudes a sense of".
- Write like a real copywriter — specific, direct, and product-focused.
- Every field must reflect the actual product, not a generic template.

SEO GENERATION TASK:
Using your image analysis combined with the product name and category, generate complete SEO content.

Respond ONLY with this exact JSON structure, no markdown, no extra text:
{
  "meta_title": "50-70 chars — product name + key attribute + benefit",
  "meta_description": "140-160 chars — keyword-rich, ends with a clear CTA",
  "focus_keywords": ["keyword1","keyword2","keyword3","keyword4","keyword5","keyword6"],
  "seo_slug": "lowercase-hyphen-slug-no-stop-words-max-60-chars",
  "alt_text": "descriptive alt text under 100 chars with primary keyword",
  "product_description": "300+ word description — specific to THIS product, covers type, colour, material, style, use cases, benefits. No filler.",
  "short_description": "under 80 chars — one punchy sentence",
  "product_tags": ["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8"],
  "socialMedia": {
    "instagram": "80+ words, emojis, specific product features, 5-8 hashtags, end with: Like Share Follow Comment LINK - I will DM you.",
    "facebook": "80+ words, features and benefits, end with: Like Share Follow Comment LINK - I will DM you.",
    "twitter": "under 280 chars, strong CTA, 3-5 hashtags",
    "youtube": "150-300 words — overview, key features, benefits, SEO keywords, CTA"
  }
}`;
}

/**
 * Build a targeted prompt for a single section.
 *
 * Key improvements over the previous version:
 *  - Always passes the CURRENT field value so AI knows what to improve/replace
 *  - Passes image context (product name + category + visible attributes)
 *  - Explicit "do not repeat" instruction
 *  - attempt > 1 escalates the instruction to force variety
 */
function _buildSectionPrompt(sectionKey, section, r, attempt = 1, currentSd = null, lastReason = '') {
  const langInstr = {
    en: 'Write output in English.',
    hi: 'Write output in Hindi (Devanagari script).',
    te: 'Write output in Telugu script.'
  };

  // Pull the full current field value so AI knows what it must NOT repeat
  const currentValue = _getFieldValue(sectionKey, r);
  const currentValueStr = Array.isArray(currentValue)
    ? currentValue.join(', ')
    : safeStr(currentValue);

  const retryNote = attempt > 1
    ? `IMPORTANT: The previous attempt returned content identical or too similar to the existing value. This is attempt ${attempt}. You MUST produce significantly different wording, structure, and approach. Do not start with the same words.`
    : '';

  const scoreContext = currentSd
    ? (() => {
        const relevant = (currentSd.checks || []).filter(c => c.field === sectionKey && !c.pass);
        const reasons = relevant.length ? relevant.map(c => c.label).join('; ') : 'No obvious scoring issues were detected from the current saved state.';
        const failedList = relevant.length
          ? relevant.map((c, index) => `${index + 1}. ${c.label}`).join('\n')
          : 'None';
        const currentLength = sectionKey === 'meta_title'
          ? safeStr(r.meta_title).length
          : sectionKey === 'meta_description'
            ? safeStr(r.meta_description).length
            : null;
        const lengthHint = currentLength !== null
          ? `Current length: ${currentLength}. Ensure the replacement satisfies the existing length rule.`
          : '';
        return `CURRENT SEO FAILURE REASONS: ${reasons}\nTARGETED FAILED CHECKS:\n${failedList}\n${lengthHint}\nFix these issues specifically in the new value.`;
      })()
    : '';

  const imageNote = _imageBase64
    ? 'A product image is attached. Use it to inform your understanding of the product colour, style, material, and visual attributes.'
    : '';

  let responseShape;
  if (section.isArray) {
    responseShape = `{"${section.responseKey}":["value1","value2","value3","value4","value5"]}`;
  } else if (section.isObject && sectionKey === 'social') {
    responseShape = `{"socialMedia":{"instagram":"...","facebook":"...","twitter":"...","youtube":"..."}}`;
  } else {
    responseShape = `{"${section.responseKey}":"new improved value here"}`;
  }

  return `You are an expert SEO copywriter specialising in product listings.
${langInstr[r.lang] || langInstr.en}
${imageNote}

PRODUCT CONTEXT:
- Product Name: ${safeStr(r.productName)}
- Category: ${safeStr(r.category) || 'N/A'}
- Meta Title (for context): ${safeStr(r.meta_title)}
- SEO Slug (for context): ${safeStr(r.seo_slug)}

TASK: Regenerate ONLY the "${section.label}" field.
${retryNote}
${scoreContext}
${lastReason ? `PREVIOUS ATTEMPT FEEDBACK: ${lastReason}` : ''}

CURRENT VALUE (you must NOT repeat this — generate something NEW and BETTER):
${currentValueStr}

REQUIREMENT for the new ${section.label}:
${section.requirement}

RULES:
- Generate a NEW version. Do not copy or closely paraphrase the current value above.
- Improve SEO quality while preserving the product meaning.
- Be specific to this product — avoid generic filler phrases like "masterpiece of", "perfect blend", "ideal for any occasion".
- Do not fabricate attributes not mentioned in the product name or category.

Respond ONLY with valid JSON, no markdown, no explanation:
${responseShape}`;
}

// ── OPENCART TEXT BUILDER ────────────────────────────────────
function _buildOpenCartText(r) {
  const langNames = { en: 'English', hi: 'Hindi', te: 'Telugu' };
  return `=== GENERAL TAB ===
Product Name:
${safeStr(r.productName)}

=== DATA TAB ===
Meta Tag Title:
${safeStr(r.meta_title)}

Meta Tag Description:
${safeStr(r.meta_description)}

SEO URL (Keyword):
${safeStr(r.seo_slug)}

=== DESCRIPTION TAB ===
Description:
${safeStr(r.product_description)}

Summary:
${safeStr(r.short_description)}

=== IMAGE TAB ===
Alt Text:
${safeStr(r.alt_text)}

=== TAGS ===
${(r.product_tags || []).join(', ')}

=== KEYWORDS ===
${(r.focus_keywords || []).join(', ')}

=== INFO ===
Language: ${langNames[r.lang] || 'English'}
Category: ${safeStr(r.category) || 'N/A'}
Provider: ${safeStr(r.provider)}
SEO Score: ${r._scoreData?.score || 0}/100
Generated: ${formatDate(r.timestamp)}`;
}

// ── FIRESTORE SAVE ────────────────────────────────────────────
async function _saveToFirestore(r) {
  if (!getUser()) return;
  try {
    const productId = r.productId || _productId;
    if (!productId) throw new Error('Cannot save SEO content without a product reference.');
    const language = safeStr(r.lang || 'en');
    const historyId = `seo_${productId}_${language}`;

    // SEO_History contains SEO content and generation metadata only. Product
    // fields are resolved from Products when history is displayed.
    const seoPayload = {
      historyId,
      productId,
      language,
      generatedBy: getUser().uid,
      generatedAt: FB.serverTimestamp(),
      aiModel: safeStr(r.provider),
      seoChecklist: {
        metaTitle: safeStr(r.meta_title),
        metaDescription: safeStr(r.meta_description),
        focusKeywords: Array.isArray(r.focus_keywords) ? r.focus_keywords : [],
        productDescription: safeStr(r.product_description),
        seoSlug: safeStr(r.seo_slug),
        productTags: Array.isArray(r.product_tags) ? r.product_tags : [],
        socialMedia: {
          instagram: safeStr(r.socialMedia?.instagram || ''),
          facebook: safeStr(r.socialMedia?.facebook || ''),
          twitter: safeStr(r.socialMedia?.twitter || ''),
          youtube: safeStr(r.socialMedia?.youtube || '')
        }
      }
    };

    // Deterministic ID makes generation for the same product/language an upsert.
    const historyRef = FB.docRef('SEO_History', historyId);
    // Replace the document so legacy duplicated fields cannot remain on an
    // existing product-language record.
    await FB.setDoc(historyRef, seoPayload);
    const savedHistoryDoc = await FB.getDoc(historyRef);
    if (!savedHistoryDoc.exists()) {
      throw new Error('SEO_History save could not be verified.');
    }
    const savedHistory = savedHistoryDoc.data();
    const requiredHistoryFields = [
      'historyId', 'productId', 'language', 'generatedBy',
      'generatedAt', 'aiModel', 'seoChecklist'
    ];
    const missingHistoryFields = requiredHistoryFields.filter(field =>
      savedHistory[field] === undefined || savedHistory[field] === null
    );
    if (missingHistoryFields.length) {
      throw new Error(`SEO_History is missing: ${missingHistoryFields.join(', ')}`);
    }
    console.info('[Generator] Firestore save result:', savedHistory);
    console.info('[Generator] Saved document ID:', savedHistoryDoc.id);
    console.info('[Generator] Saved productId:', savedHistory.productId);
    if (savedHistory.productId !== productId) {
      throw new Error('Saved SEO_History productId does not match the Product.');
    }
    await FB.updateDoc(FB.docRef('products', productId), {
      generationStatus: 'Completed',
      updatedAt: FB.serverTimestamp()
    });
    const savedProductDoc = await FB.getDoc(FB.docRef('products', productId));
    console.info('[Generator] Reloaded product after SEO save:', {
      id: savedProductDoc.id,
      productId: savedProductDoc.id,
      exists: savedProductDoc.exists()
    });
    
    console.log(`[Generator] SEO content upserted for product ${productId} (${language})`);
    showToast('SEO content generated and saved successfully!');
    
  } catch (e) {
    console.error('[Generator] _saveToFirestore:', e);
    showToast('Save failed: ' + e.message);
    throw e;
  }
}

// ── COPY HELPERS ─────────────────────────────────────────────
export function viewSeoScore() {
  switchResultTab('score');
}
export function copyField(id)  { copyText(document.getElementById(id)?.textContent || ''); }
export function copyKw()       { copyText(Array.from(document.querySelectorAll('#r-kw .kw-tag')).map(x => x.textContent).join(', ')); }
export function copyTags()     { copyText(Array.from(document.querySelectorAll('#r-tags .prod-tag')).map(x => x.textContent).join(', ')); }
export function copyAll() {
  if (!_currentResult) return;
  const r = _currentResult;
  copyText([
    `Product: ${r.productName}`,
    `Meta Title: ${r.meta_title}`,
    `Meta Description: ${r.meta_description}`,
    `Slug: ${r.seo_slug}`,
    `Alt: ${r.alt_text}`,
    `Keywords: ${(r.focus_keywords || []).join(', ')}`,
    `Tags: ${(r.product_tags || []).join(', ')}`,
    `Description: ${r.product_description}`
  ].join('\n\n'));
}

// ── SAVE ANYWAY ───────────────────────────────────────────────
export async function saveAnyway() {
  if (!_currentResult) return;
  await _saveToFirestore(_currentResult);
  showToast('Saved to Firebase!');
}

// ── PUBLIC ACCESSORS ──────────────────────────────────────────
export function getCurrentResult() { return _currentResult; }
export function setProductContext(product) {
  _productContext = product || null;
  _productId = product?.id || product?.productId || null;
  _existingProductImageUrl = product?.imageUrl || product?.image || null;
  _imageSourceIsFile = false;
  _imageBase64 = null;
  _imageMime = 'image/jpeg';

  const nameEl = document.getElementById('prod-name');
  const catEl = document.getElementById('prod-cat');
  const langEl = document.getElementById('prod-lang');
  const modelEl = document.getElementById('prod-model-number');
  const mrpEl = document.getElementById('prod-mrp');
  const sellingPriceEl = document.getElementById('prod-selling-price');

  if (nameEl) nameEl.value = product?.productName || '';
  if (catEl) catEl.value = product?.category || '';
  if (langEl) langEl.value = product?.language || product?.lang || 'en';
  if (modelEl) modelEl.value = product?.modelNumber || '';
  if (mrpEl) mrpEl.value = product?.mrp || '';
  if (sellingPriceEl) sellingPriceEl.value = product?.sellingPrice || '';

  if (_existingProductImageUrl) {
    _setPreviewImage(_existingProductImageUrl);
  } else {
    _setPreviewImage(null);
  }

  _updateButtonState();
}
export function setCurrentResult(r) {
  _currentResult = r;
  _productId = r?.productId || _productId;
  if (r) {
    const sd = computeSeoScore(r);
    _currentResult._scoreData = sd;
  }
}

/**
 * Public wrapper for _updateButtonState.
 * Called from HTML oninput/onchange attributes and by app.js after tab switch.
 */
export function checkForm() { _updateButtonState(); }

/**
 * Initialize the SEO generator
 */
export async function initSeoGenerator() {
  try {
    _updateButtonState();
  } catch (error) {
    console.error('Error initializing SEO generator:', error);
  }
}
