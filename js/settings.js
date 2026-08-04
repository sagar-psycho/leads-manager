/**
 * settings.js - Settings page rendering and save logic
 */

import { FB } from './firebase.js';
import { getUser, getUserDoc, updateUserField, getApiKey, isAdmin } from './auth.js';
import { verifyGeminiKey } from './ai.js';
import { safeStr, formatDate } from './utils.js';
import { showToast, applyTheme } from './ui.js';
import { getPageSpeedApiKey, savePageSpeedApiKey, validateApiKey } from './pagespeed.js';

// ── RENDER SETTINGS PAGE ──────────────────────────────────────
export async function render() {
  const container = document.getElementById('settings-container');
  if (!container) return;
  const ud = getUserDoc() || {};
  
  // Fetch PageSpeed API key for admin users
  let pageSpeedKey = '';
  let lastUpdated = '';
  if (isAdmin()) {
    try {
      const docRef = FB.docRef('settings', 'global');
      const snap = await FB.getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        pageSpeedKey = data.pageSpeedApiKey || '';
        lastUpdated = data.updatedAt ? formatDate(data.updatedAt.toMillis ? data.updatedAt.toMillis() : data.updatedAt) : '';
      }
    } catch (e) {
      console.warn('[Settings] Failed to fetch PageSpeed key:', e.message);
    }
  }

  container.innerHTML = `
    ${_sectionGroq(ud)}
    ${_sectionGemini(ud)}
    ${_sectionOpenRouter(ud)}
    ${isAdmin() ? _sectionGoogleApis(pageSpeedKey, lastUpdated) : ''}
    ${_sectionPreferences(ud)}
    ${_sectionProfile(ud)}
    ${_sectionFirebase()}
    ${_sectionData()}
  `;
}

// ── GROQ ─────────────────────────────────────────────────────
function _sectionGroq(ud) {
  return `
  <div class="settings-section">
    <div class="settings-head">
      <h3>Groq API Key <span class="badge-free">FREE</span></h3>
      <p>14,400 requests/day - no credit card needed. Get yours at console.groq.com/keys</p>
    </div>
    <div class="settings-body">
      <div class="info-box info-box-green">
        <strong>How to get your free Groq key (2 min):</strong>
        1. Go to <a href="https://console.groq.com/keys" target="_blank" style="color:#065f46;font-weight:700">console.groq.com/keys</a><br/>
        2. Sign up with Google (no credit card)<br/>
        3. Click "Create New Key" and copy it (starts with gsk_)<br/>
        4. Paste below and click Save
      </div>
      <div id="groq-alert" class="alert alert-danger" style="display:none"></div>
      <div id="groq-ok"    class="alert alert-success" style="display:none"></div>
      <div class="form-row">
        <label>Groq API Key</label>
        <div class="api-row">
          <input type="password" id="s-groq-key" placeholder="gsk_..." value="${safeStr(ud.apiKey)}"/>
          <button class="btn btn-outline btn-sm" onclick="window.Settings.toggleKey('s-groq-key', this)">Show</button>
        </div>
      </div>
      <button class="btn btn-primary" onclick="window.Settings.saveKey('groq')">Save Groq Key</button>
    </div>
  </div>`;
}

// ── GEMINI ────────────────────────────────────────────────────
function _sectionGemini(ud) {
  return `
  <div class="settings-section">
    <div class="settings-head">
      <h3>Google Gemini API Key</h3>
      <p>Get yours at aistudio.google.com/app/apikey - free tier available</p>
    </div>
    <div class="settings-body">
      <div id="gemini-alert" class="alert alert-danger" style="display:none"></div>
      <div id="gemini-ok"    class="alert alert-success" style="display:none"></div>
      <div class="form-row">
        <label>Gemini API Key</label>
        <div class="api-row">
          <input type="password" id="s-gemini-key" placeholder="Enter Gemini API key" value="${safeStr(ud.geminiKey)}"/>
          <button class="btn btn-outline btn-sm" onclick="window.Settings.toggleKey('s-gemini-key', this)">Show</button>
        </div>
      </div>
      <button class="btn btn-primary" onclick="window.Settings.saveKey('gemini')">Save Gemini Key</button>
    </div>
  </div>`;
}

// ── OPENROUTER ────────────────────────────────────────────────
function _sectionOpenRouter(ud) {
  return `
  <div class="settings-section">
    <div class="settings-head">
      <h3>OpenRouter API Key</h3>
      <p>Access 200+ AI models via openrouter.ai - free credits available</p>
    </div>
    <div class="settings-body">
      <div id="or-alert" class="alert alert-danger" style="display:none"></div>
      <div id="or-ok"    class="alert alert-success" style="display:none"></div>
      <div class="form-row">
        <label>OpenRouter API Key</label>
        <div class="api-row">
          <input type="password" id="s-or-key" placeholder="sk-or-..." value="${safeStr(ud.openrouterKey)}"/>
          <button class="btn btn-outline btn-sm" onclick="window.Settings.toggleKey('s-or-key', this)">Show</button>
        </div>
      </div>
      <button class="btn btn-primary" onclick="window.Settings.saveKey('openrouter')">Save OpenRouter Key</button>
    </div>
  </div>`;
}

// ── GOOGLE APIS (ADMIN ONLY) ──────────────────────────────────
function _sectionGoogleApis(pageSpeedKey, lastUpdated) {
  const maskedKey = pageSpeedKey 
    ? '*'.repeat(Math.max(0, pageSpeedKey.length - 4)) + pageSpeedKey.slice(-4)
    : '';
  const isConnected = pageSpeedKey.length > 0;
  
  return `
  <div class="settings-section admin-only">
    <div class="settings-head">
      <h3>Google APIs <span class="badge-admin">ADMIN ONLY</span></h3>
      <p>Configure Google services for advanced features</p>
    </div>
    <div class="settings-body">
      <div class="info-box info-box-orange">
        <strong>Administrator Configuration</strong><br/>
        Only administrators can configure these API keys. Regular users can use the features once configured.
      </div>
      
      <h4 style="margin-top:1.5rem;margin-bottom:.75rem">Google PageSpeed Insights API Key</h4>
      <div class="info-box info-box-green">
        <strong>How to get your PageSpeed API key:</strong><br/>
        1. Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" style="color:#065f46;font-weight:700">Google Cloud Console</a><br/>
        2. Create a new project or select an existing one<br/>
        3. Enable the PageSpeed Insights API<br/>
        4. Create credentials (API Key)<br/>
        5. Copy the key and paste below
      </div>
      
      <div id="ps-alert" class="alert alert-danger" style="display:none"></div>
      <div id="ps-ok" class="alert alert-success" style="display:none"></div>
      
      <div class="form-row">
        <label>Google PageSpeed Insights API Key</label>
        <div class="api-row">
          <input type="password" id="s-ps-key" placeholder="AIza..." value="${safeStr(pageSpeedKey)}"/>
          <button class="btn btn-outline btn-sm" onclick="window.Settings.toggleKey('s-ps-key', this)">
            ${pageSpeedKey ? 'Show' : 'Show'}
          </button>
        </div>
      </div>
      
      <div style="display:flex;align-items:center;gap:.75rem;margin-top:.75rem;margin-bottom:.75rem">
        <button class="btn btn-primary" onclick="window.Settings.savePageSpeedKey()">Save API Key</button>
        ${pageSpeedKey ? `<button class="btn btn-outline btn-sm" onclick="window.Settings.testPageSpeedKey()">Test Connection</button>` : ''}
      </div>
      
      <div class="ps-status-row" style="display:flex;align-items:center;gap:.5rem;font-size:.85rem;margin-top:.5rem">
        <span style="font-weight:600">Status:</span>
        <span style="display:flex;align-items:center;gap:.25rem">
          ${isConnected 
            ? '<span style="color:#10b981">●</span> <span style="color:#10b981">Connected</span>' 
            : '<span style="color:#94a3b8">●</span> <span style="color:#94a3b8">Not Configured</span>'}
        </span>
        ${lastUpdated ? `<span style="color:var(--text3)">• Last Updated: ${lastUpdated}</span>` : ''}
      </div>
    </div>
  </div>`;
}

// ── PREFERENCES ───────────────────────────────────────────────
function _sectionPreferences(ud) {
  const themes    = ['light','dark','system'];
  const providers = [
    { val: 'groq',        label: 'Groq' },
    { val: 'gemini',      label: 'Gemini' },
    { val: 'openrouter',  label: 'OpenRouter' }
  ];
  const themeHtml = themes.map(t => `
    <button class="theme-opt ${ud.theme === t ? 'active' : ''}" data-theme="${t}" onclick="window.Settings.setTheme('${t}', this)">
      ${t.charAt(0).toUpperCase() + t.slice(1)}
    </button>`).join('');
  const provHtml = providers.map(p => `
    <button class="provider-opt ${ud.defaultProvider === p.val ? 'active' : ''}" data-prov="${p.val}" onclick="window.Settings.setProvider('${p.val}', this)">
      ${p.label}
    </button>`).join('');

  return `
  <div class="settings-section">
    <div class="settings-head">
      <h3>Preferences</h3>
      <p>Theme, language, default AI provider and generation settings</p>
    </div>
    <div class="settings-body">
      <div class="form-row">
        <label>Theme</label>
        <div class="theme-row">${themeHtml}</div>
      </div>
      <div class="form-row">
        <label>Default AI Provider</label>
        <div class="provider-row" id="prov-row">${provHtml}</div>
      </div>
      <div class="form-row">
        <label>Default Language</label>
        <select id="s-lang" onchange="window.Settings.savePref()">
          <option value="en"  ${ud.language === 'en'  ? 'selected' : ''}>English</option>
          <option value="hi"  ${ud.language === 'hi'  ? 'selected' : ''}>Hindi</option>
          <option value="te"  ${ud.language === 'te'  ? 'selected' : ''}>Telugu</option>
        </select>
      </div>
      <div class="form-row">
        <label>Temperature (creativity) — ${ud.temperature ?? 0.9}</label>
        <input type="range" id="s-temp" min="0.1" max="1.5" step="0.1" value="${ud.temperature ?? 0.9}"
               style="width:100%" oninput="document.querySelector('[for=s-temp]') && (document.querySelector('[for=s-temp]').textContent = 'Temperature: '+this.value)"/>
      </div>
      <div class="form-row">
        <label>Max Tokens</label>
        <select id="s-tokens">
          <option value="800"  ${ud.maxTokens === 800  ? 'selected' : ''}>800 (Fast)</option>
          <option value="1200" ${ud.maxTokens === 1200 ? 'selected' : ''}>1200</option>
          <option value="1600" ${!ud.maxTokens || ud.maxTokens === 1600 ? 'selected' : ''}>1600 (Recommended)</option>
          <option value="2000" ${ud.maxTokens === 2000 ? 'selected' : ''}>2000 (Detailed)</option>
        </select>
      </div>
      <button class="btn btn-primary" onclick="window.Settings.savePref()">Save Preferences</button>
    </div>
  </div>`;
}

// ── PROFILE ───────────────────────────────────────────────────
function _sectionProfile(ud) {
  return `
  <div class="settings-section">
    <div class="settings-head"><h3>Profile</h3><p>Update your display name</p></div>
    <div class="settings-body">
      <div class="form-row"><label>Display Name</label><input type="text" id="s-name" value="${safeStr(ud.name)}"/></div>
      <div class="form-row"><label>Email</label><input type="email" id="s-email" value="${safeStr(ud.email)}" disabled/></div>
      <button class="btn btn-primary" onclick="window.Settings.saveProfile()">Update Profile</button>
    </div>
  </div>`;
}

// ── FIREBASE STATUS ───────────────────────────────────────────
function _sectionFirebase() {
  return `
  <div class="settings-section">
    <div class="settings-head"><h3>Firebase Status</h3><p>Your data syncs to Firebase cloud</p></div>
    <div class="settings-body">
      <div class="info-box info-box-orange">
        <strong>Connected: abra-zylo-seo</strong>
        All SEO generations are saved to Firestore and synced across devices.<br/>
        Manage at <a href="https://console.firebase.google.com/project/abra-zylo-seo" target="_blank" style="color:#9a3412;font-weight:600">console.firebase.google.com</a>
      </div>
      <div id="firebase-status" style="font-size:.83rem;color:var(--text2)">Connected</div>
    </div>
  </div>`;
}

// ── DATA ─────────────────────────────────────────────────────
function _sectionData() {
  return `
  <div class="settings-section">
    <div class="settings-head"><h3>Data Management</h3><p>Export or clear your generation history</p></div>
    <div class="settings-body" style="display:flex;gap:.5rem;flex-wrap:wrap">
      <button class="btn btn-outline btn-sm" onclick="window.History.exportJSON()">Export History (JSON)</button>
      <button class="btn btn-danger btn-sm admin-only" onclick="window.History.clearAll()">Clear All History</button>
    </div>
  </div>`;
}

// ── ACTIONS ───────────────────────────────────────────────────
export function toggleKey(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
  btn.textContent = input.type === 'password' ? 'Show' : 'Hide';
}

export async function saveKey(provider) {
  const idMap   = { groq: 's-groq-key', gemini: 's-gemini-key', openrouter: 's-or-key' };
  const alertId = { groq: 'groq-alert', gemini: 'gemini-alert', openrouter: 'or-alert' };
  const okId    = { groq: 'groq-ok',    gemini: 'gemini-ok',    openrouter: 'or-ok' };
  const fieldMap = { groq: 'apiKey', gemini: 'geminiKey', openrouter: 'openrouterKey' };

  const key = (document.getElementById(idMap[provider])?.value || '').trim();
  const aEl = document.getElementById(alertId[provider]);
  const oEl = document.getElementById(okId[provider]);
  if (aEl) aEl.style.display = 'none';
  if (oEl) oEl.style.display = 'none';

  if (!key) {
    if (aEl) { aEl.textContent = provider === 'gemini' ? 'Please enter your Gemini API key.' : 'Please enter an API key.'; aEl.style.display = 'block'; }
    return;
  }
  if (provider === 'groq' && !key.startsWith('gsk_')) {
    if (aEl) { aEl.textContent = 'Groq keys start with gsk_. Check your key.'; aEl.style.display = 'block'; }
    return;
  }

  if (provider === 'gemini') {
    try {
      await verifyGeminiKey(key);
    } catch (err) {
      const message = String(err?.message || err || 'Unable to authenticate with Gemini. Please check your API key.');
      if (aEl) { aEl.textContent = message; aEl.style.display = 'block'; }
      console.error('[Settings] Gemini validation failed:', message);
      return;
    }
  }

  await updateUserField({ [fieldMap[provider]]: key });
  if (oEl) { oEl.textContent = `${provider.charAt(0).toUpperCase() + provider.slice(1)} key saved!`; oEl.style.display = 'block'; }
  showToast(`${provider} API key saved.`);
  setTimeout(() => { if (oEl) oEl.style.display = 'none'; }, 3000);
}

export function setTheme(theme, btn) {
  document.querySelectorAll('.theme-opt').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyTheme(theme);
  updateUserField({ theme });
}

export function setProvider(prov, btn) {
  document.querySelectorAll('.provider-opt').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const sel = document.getElementById('prod-provider');
  if (sel) sel.value = prov;
  updateUserField({ defaultProvider: prov });
  const tag = document.getElementById('sidebar-ai-model');
  if (tag) tag.textContent = prov === 'groq' ? 'Llama 3.3 70B' : prov === 'gemini' ? 'Gemini Flash' : 'OpenRouter';
}

export async function savePref() {
  const lang   = document.getElementById('s-lang')?.value   || 'en';
  const temp   = parseFloat(document.getElementById('s-temp')?.value || '0.9');
  const tokens = parseInt(document.getElementById('s-tokens')?.value || '1600', 10);
  await updateUserField({ language: lang, temperature: temp, maxTokens: tokens });
  // Sync lang switcher
  ['en','hi','te'].forEach(l => {
    const b = document.getElementById(`lang-${l}`);
    if (b) b.classList.toggle('active', l === lang);
  });
  showToast('Preferences saved.');
}

export async function saveProfile() {
  const name = (document.getElementById('s-name')?.value || '').trim();
  if (!name) { showToast('Name cannot be empty.'); return; }
  await updateUserField({ name, displayName: name });
  document.getElementById('sidebar-name').textContent = name;
  document.getElementById('sidebar-av').textContent   = name[0].toUpperCase();
  showToast('Profile updated.');
}

// ── PAGESPEED API KEY (ADMIN ONLY) ───────────────────────────
export async function savePageSpeedKey() {
  if (!isAdmin()) {
    showToast('Only administrators can save the PageSpeed API key.');
    return;
  }

  const key = (document.getElementById('s-ps-key')?.value || '').trim();
  const aEl = document.getElementById('ps-alert');
  const oEl = document.getElementById('ps-ok');
  if (aEl) aEl.style.display = 'none';
  if (oEl) oEl.style.display = 'none';

  if (!key) {
    if (aEl) { aEl.textContent = 'Please enter an API key.'; aEl.style.display = 'block'; }
    return;
  }

  // Validate the key first
  const validation = await validateApiKey(key);
  if (!validation.valid) {
    if (aEl) { aEl.textContent = validation.error; aEl.style.display = 'block'; }
    return;
  }

  // Save to Firestore
  const saved = await savePageSpeedApiKey(key);
  if (saved) {
    if (oEl) { oEl.textContent = 'PageSpeed API key saved and validated!'; oEl.style.display = 'block'; }
    showToast('PageSpeed API key saved successfully.');
    setTimeout(() => { if (oEl) oEl.style.display = 'none'; render(); }, 2000);
  } else {
    if (aEl) { aEl.textContent = 'Failed to save API key.'; aEl.style.display = 'block'; }
  }
}

export async function testPageSpeedKey() {
  const key = await getPageSpeedApiKey();
  if (!key) {
    showToast('No API key configured.');
    return;
  }

  showToast('Testing PageSpeed API key...');
  const validation = await validateApiKey(key);
  
  if (validation.valid) {
    showToast('✓ PageSpeed API key is valid and working!');
  } else {
    showToast('✗ API key test failed: ' + validation.error);
  }
}
