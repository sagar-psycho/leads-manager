/**
 * ai.js - Multi-provider AI layer
 * Providers: Groq, Google Gemini, OpenRouter
 * Only change model/endpoint here - nothing else needs updating.
 */

// ── MODEL CONFIG ─────────────────────────────────────────────
const MODELS = {
  groq:            'llama-3.3-70b-versatile',
  groqVision:      'llama-3.2-90b-vision-preview',
  groqFallback:    'llama-3.1-8b-instant',
  gemini:          'gemini-1.5-flash',
  openrouter:      'meta-llama/llama-3.3-70b-instruct:free',
  openrouterVision:'google/gemini-flash-1.5'
};

const ENDPOINTS = {
  groq:        'https://api.groq.com/openai/v1/chat/completions',
  gemini:      'https://generativelanguage.googleapis.com/v1beta/models',
  openrouter:  'https://openrouter.ai/api/v1/chat/completions'
};

// ── API KEY VALIDATION ────────────────────────────────────────
export function validateKey(key, provider) {
  const k = (key || '').trim();
  if (!k) return false;
  if (provider === 'groq' && !k.startsWith('gsk_')) return false;
  return true;
}

export async function verifyGeminiKey(apiKey) {
  const key = (apiKey || '').trim();
  if (!key) throw new Error('Please enter your Gemini API key.');

  const testMessages = [{ role: 'user', content: 'Verify Gemini API key.' }];
  try {
    await _callGemini(testMessages, key, { temperature: 0, maxTokens: 1, timeout: 20000 });
    return true;
  } catch (err) {
    const message = String(err?.message || err || '').toLowerCase();
    if (message.includes('abort') || message.includes('timeout') || message.includes('failed to fetch') || message.includes('network')) {
      throw new Error('Unable to connect to Gemini. Please check your internet connection and try again.');
    }
    throw new Error('Unable to authenticate with Gemini. Please check your API key.');
  }
}

// ── MAIN DISPATCH ─────────────────────────────────────────────
/**
 * @param {Array}  messages      - OpenAI-style messages array
 * @param {string} apiKey        - Provider API key
 * @param {string} provider      - 'groq' | 'gemini' | 'openrouter'
 * @param {Object} opts          - { temperature, maxTokens, imageBase64, imageMime }
 */
export async function callAI(messages, apiKey, provider = 'groq', opts = {}) {
  if (!validateKey(apiKey, provider)) {
    throw new AiError('invalid_key', provider);
  }
  switch (provider) {
    case 'groq':        return _callGroq(messages, apiKey, opts);
    case 'gemini':      return _callGemini(messages, apiKey, opts);
    case 'openrouter':  return _callOpenRouter(messages, apiKey, opts);
    default: throw new AiError('unknown_provider', provider);
  }
}

// ── GROQ ──────────────────────────────────────────────────────
async function _callGroq(messages, apiKey, opts = {}) {
  const hasImage = !!(opts.imageBase64);
  const model = opts.model || (hasImage ? MODELS.groqVision : MODELS.groq);

  // When an image is provided, convert the last user message to a
  // multimodal content array (text + image_url in base64 data URI form)
  const builtMessages = hasImage
    ? _injectImageGroq(messages, opts.imageBase64, opts.imageMime || 'image/jpeg')
    : messages;

  const res = await _fetch(ENDPOINTS.groq, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: builtMessages,
      temperature: opts.temperature ?? 0.9,
      top_p:       opts.top_p       ?? 0.95,
      max_tokens:  opts.maxTokens   || 1600,
      response_format: { type: 'json_object' }
    })
  }, opts.timeout || 40000);

  const data = await res.json();
  if (!res.ok || data.error) {
    const serverMessage = data.error?.message || `Groq request failed with HTTP ${res.status}`;
    const msg = String(serverMessage).toLowerCase();

    // Vision-capability mismatch: retry using the same user text prompt with the
    // supported text model, but do not send image content on the fallback pass.
    if (hasImage && model !== MODELS.groqFallback && (
      msg.includes('does not exist') ||
      msg.includes('no access') ||
      msg.includes('vision') ||
      msg.includes('image') ||
      msg.includes('multimodal') ||
      msg.includes('not supported') ||
      msg.includes('unsupported')
    )) {
      console.warn('[AI] Groq vision model unavailable, retrying with text-only fallback');
      return _callGroq(messages, apiKey, {
        ...opts,
        model: MODELS.groqFallback,
        imageBase64: null
      });
    }

    throw new AiError('api_error', 'groq', serverMessage);
  }

  return data.choices?.[0]?.message?.content || '';
}

/** Build multimodal message array for Groq (OpenAI vision format) */
function _injectImageGroq(messages, imageBase64, imageMime) {
  return messages.map((msg, i) => {
    // Attach image only to the last user message
    if (i === messages.length - 1 && msg.role === 'user') {
      return {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:${imageMime};base64,${imageBase64}` }
          },
          { type: 'text', text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }
        ]
      };
    }
    return msg;
  });
}

// ── GEMINI ────────────────────────────────────────────────────
async function _callGemini(messages, apiKey, opts = {}) {
  const model    = opts.model || MODELS.gemini; // gemini-1.5-flash has vision built-in
  const endpoint = `${ENDPOINTS.gemini}/${model}:generateContent?key=${apiKey}`;

  // Build Gemini parts — add inline image first if provided
  const parts = [];
  if (opts.imageBase64) {
    parts.push({
      inline_data: {
        mime_type: opts.imageMime || 'image/jpeg',
        data: opts.imageBase64
      }
    });
  }
  // Add text content from messages
  messages.forEach(m => {
    const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
    parts.push({ text });
  });

  const res = await _fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature:     opts.temperature ?? 0.9,
        maxOutputTokens: opts.maxTokens   || 1600
      }
    })
  }, opts.timeout || 40000);

  const data = await res.json();
  if (data.error) throw new AiError('api_error', 'gemini', data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ── OPENROUTER ────────────────────────────────────────────────
async function _callOpenRouter(messages, apiKey, opts = {}) {
  const hasImage = !!(opts.imageBase64);
  const model    = opts.model || (hasImage ? MODELS.openrouterVision : MODELS.openrouter);

  // Inject image into the last user message (OpenAI vision format)
  const builtMessages = hasImage
    ? _injectImageGroq(messages, opts.imageBase64, opts.imageMime || 'image/jpeg')
    : messages;

  const res = await _fetch(ENDPOINTS.openrouter, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer':  'https://abrazylo.github.io',
      'X-Title':       'Abra Zylo SEO Portal'
    },
    body: JSON.stringify({
      model,
      messages:    builtMessages,
      temperature: opts.temperature ?? 0.9,
      max_tokens:  opts.maxTokens   || 1600,
      response_format: { type: 'json_object' }
    })
  }, opts.timeout || 40000);

  const data = await res.json();
  if (data.error) throw new AiError('api_error', 'openrouter', data.error.message);
  return data.choices?.[0]?.message?.content || '';
}

// ── FETCH WITH TIMEOUT ────────────────────────────────────────
async function _fetch(url, options, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ── FRIENDLY ERROR MESSAGES ───────────────────────────────────
export function friendlyError(err) {
  console.error('[AI Error]', err);
  if (err instanceof AiError) return err.userMessage();
  const raw = (err?.message || String(err)).toLowerCase();
  if (raw.includes('abort') || raw.includes('timeout')) {
    return 'Request timed out. Check your connection and try again.';
  }
  return 'Unable to generate content. Please try again later.';
}

// ── CUSTOM ERROR CLASS ────────────────────────────────────────
class AiError extends Error {
  constructor(type, provider, detail = '') {
    super(`[${provider}] ${type}: ${detail}`);
    this.type     = type;
    this.provider = provider;
    this.detail   = detail;
  }
  userMessage() {
    switch (this.type) {
      case 'invalid_key':
        if (this.provider === 'groq') {
        return 'Invalid Groq API key. Please check your key in Settings.';
      }
      if (this.provider === 'gemini') {
        return 'Invalid Gemini API key. Please check your API key in Settings.';
      }
      if (this.provider === 'openrouter') {
        return 'Invalid OpenRouter API key. Please check your key in Settings.';
      }
      return `Invalid ${this.provider} API key. Check your key in Settings.`;
      case 'api_error': {
        const d = this.detail.toLowerCase();
        if (d.includes('rate') || d.includes('quota') || d.includes('limit')) {
          return 'Rate limit reached.\n\nYou have used your free quota. Wait 60 seconds and try again.';
        }
        if (d.includes('unauthorized') || d.includes('invalid') || d.includes('auth')) {
          return 'API key rejected by the AI provider.\n\nCheck your key in Settings.';
        }
        return 'The AI service returned an error.\n\nPlease try again or switch providers in Settings.';
      }
      case 'unknown_provider':
        return 'Unknown AI provider selected. Please check Settings.';
      default:
        return 'Unable to generate content. Please try again later.';
    }
  }
}

export { MODELS };
