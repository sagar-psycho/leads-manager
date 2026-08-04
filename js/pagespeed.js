/**
 * pagespeed.js - Google PageSpeed Insights API Integration
 * Handles API key validation, performance audits, and data parsing
 */

import { FB } from './firebase.js';
import { getUser, isAdmin } from './auth.js';
import { showToast } from './ui.js';

const PAGESPEED_API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

// ── GET API KEY FROM FIRESTORE ───────────────────────────────
export async function getPageSpeedApiKey() {
  try {
    const docRef = FB.docRef('settings', 'global');
    const snap = await FB.getDoc(docRef);
    if (snap.exists()) {
      return snap.data().pageSpeedApiKey || '';
    }
    return '';
  } catch (e) {
    console.warn('[PageSpeed] Failed to fetch API key:', e.message);
    return '';
  }
}

// ── SAVE API KEY (ADMIN ONLY) ────────────────────────────────
export async function savePageSpeedApiKey(apiKey) {
  if (!isAdmin()) {
    showToast('Only administrators can save the API key.');
    return false;
  }
  
  const user = getUser();
  if (!user) return false;

  try {
    const docRef = FB.docRef('settings', 'global');
    await FB.setDoc(docRef, {
      pageSpeedApiKey: apiKey,
      updatedAt: FB.serverTimestamp(),
      updatedBy: user.uid
    }, { merge: true });
    return true;
  } catch (e) {
    console.warn('[PageSpeed] Failed to save API key:', e.message);
    return false;
  }
}

// ── VALIDATE API KEY ──────────────────────────────────────────
export async function validateApiKey(apiKey) {
  if (!apiKey || apiKey.trim() === '') {
    return { valid: false, error: 'API key is required.' };
  }

  try {
    const url = `${PAGESPEED_API}?url=https://example.com&strategy=mobile&key=${apiKey}`;
    const response = await fetch(url);
    
    if (response.ok) {
      return { valid: true };
    } else if (response.status === 400) {
      const data = await response.json();
      return { valid: false, error: data.error?.message || 'Invalid API key.' };
    } else {
      return { valid: false, error: 'Failed to validate API key.' };
    }
  } catch (e) {
    return { valid: false, error: 'Network error: ' + e.message };
  }
}

// ── RUN PAGESPEED AUDIT ───────────────────────────────────────
export async function runPageSpeedAudit(url, strategy = 'mobile') {
  const apiKey = await getPageSpeedApiKey();
  
  if (!apiKey) {
    throw new Error('Administrator has not configured the Google PageSpeed API Key.');
  }

  const encodedUrl = encodeURIComponent(url);
  const apiUrl = `${PAGESPEED_API}?url=${encodedUrl}&strategy=${strategy}&key=${apiKey}&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO`;

  try {
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to fetch PageSpeed data.');
    }

    const data = await response.json();
    return parsePageSpeedResponse(data);
  } catch (e) {
    throw new Error('PageSpeed API error: ' + e.message);
  }
}

// ── PARSE PAGESPEED RESPONSE ──────────────────────────────────
function parsePageSpeedResponse(data) {
  const lighthouseResult = data.lighthouseResult;
  const categories = lighthouseResult.categories;
  const audits = lighthouseResult.audits;

  // Main scores (0-1 scale, convert to 0-100)
  const scores = {
    performance: Math.round((categories.performance?.score || 0) * 100),
    accessibility: Math.round((categories.accessibility?.score || 0) * 100),
    bestPractices: Math.round((categories['best-practices']?.score || 0) * 100),
    seo: Math.round((categories.seo?.score || 0) * 100)
  };

  // Core Web Vitals
  const coreWebVitals = {
    lcp: {
      value: audits['largest-contentful-paint']?.numericValue || 0,
      displayValue: audits['largest-contentful-paint']?.displayValue || 'N/A',
      score: audits['largest-contentful-paint']?.score || 0,
      title: 'Largest Contentful Paint'
    },
    cls: {
      value: audits['cumulative-layout-shift']?.numericValue || 0,
      displayValue: audits['cumulative-layout-shift']?.displayValue || 'N/A',
      score: audits['cumulative-layout-shift']?.score || 0,
      title: 'Cumulative Layout Shift'
    },
    inp: {
      value: audits['max-potential-fid']?.numericValue || 0,
      displayValue: audits['max-potential-fid']?.displayValue || 'N/A',
      score: audits['max-potential-fid']?.score || 0,
      title: 'Max Potential FID'
    },
    fcp: {
      value: audits['first-contentful-paint']?.numericValue || 0,
      displayValue: audits['first-contentful-paint']?.displayValue || 'N/A',
      score: audits['first-contentful-paint']?.score || 0,
      title: 'First Contentful Paint'
    },
    speedIndex: {
      value: audits['speed-index']?.numericValue || 0,
      displayValue: audits['speed-index']?.displayValue || 'N/A',
      score: audits['speed-index']?.score || 0,
      title: 'Speed Index'
    },
    ttfb: {
      value: audits['server-response-time']?.numericValue || 0,
      displayValue: audits['server-response-time']?.displayValue || 'N/A',
      score: audits['server-response-time']?.score || 0,
      title: 'Time to First Byte'
    }
  };

  // Opportunities (things to improve)
  const opportunities = [];
  const opportunityAudits = [
    'render-blocking-resources',
    'unused-css-rules',
    'unused-javascript',
    'modern-image-formats',
    'offscreen-images',
    'unminified-css',
    'unminified-javascript',
    'uses-optimized-images',
    'uses-text-compression',
    'uses-responsive-images'
  ];

  opportunityAudits.forEach(key => {
    const audit = audits[key];
    if (audit && audit.score !== null && audit.score < 1) {
      opportunities.push({
        id: key,
        title: audit.title,
        description: audit.description,
        displayValue: audit.displayValue || '',
        score: audit.score
      });
    }
  });

  // Diagnostics (additional information)
  const diagnostics = [];
  const diagnosticAudits = [
    'total-byte-weight',
    'dom-size',
    'critical-request-chains',
    'mainthread-work-breakdown',
    'bootup-time',
    'network-rtt',
    'network-server-latency',
    'font-display',
    'third-party-summary'
  ];

  diagnosticAudits.forEach(key => {
    const audit = audits[key];
    if (audit && audit.score !== null) {
      diagnostics.push({
        id: key,
        title: audit.title,
        description: audit.description,
        displayValue: audit.displayValue || '',
        score: audit.score
      });
    }
  });

  // Passed audits
  const passed = [];
  Object.keys(audits).forEach(key => {
    const audit = audits[key];
    if (audit.score === 1 && audit.title) {
      passed.push({
        id: key,
        title: audit.title
      });
    }
  });

  return {
    scores,
    coreWebVitals,
    opportunities,
    diagnostics,
    passed,
    url: data.id || '',
    timestamp: Date.now(),
    strategy: data.lighthouseResult.configSettings?.formFactor || 'mobile'
  };
}

// ── SAVE AUDIT TO FIRESTORE ───────────────────────────────────
export async function saveAuditToFirestore(auditData) {
  const user = getUser();
  if (!user) throw new Error('User not authenticated.');

  try {
    await FB.addDoc(FB.col('pagespeed_audits'), {
      uid: user.uid,
      url: auditData.url,
      strategy: auditData.strategy,
      scores: auditData.scores,
      coreWebVitals: auditData.coreWebVitals,
      opportunitiesCount: auditData.opportunities.length,
      diagnosticsCount: auditData.diagnostics.length,
      passedCount: auditData.passed.length,
      timestamp: auditData.timestamp,
      createdAt: FB.serverTimestamp(),
      createdBy: user.email || ''
    });
    showToast('Performance audit saved to Firebase!');
  } catch (e) {
    throw new Error('Failed to save audit: ' + e.message);
  }
}

// ── FETCH AUDIT HISTORY ───────────────────────────────────────
export async function fetchAuditHistory() {
  const user = getUser();
  if (!user) return [];

  try {
    const q = FB.query(
      FB.col('pagespeed_audits'),
      FB.where('uid', '==', user.uid),
      FB.orderBy('timestamp', 'desc'),
      FB.limit(20)
    );
    const snap = await FB.getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('[PageSpeed] Failed to fetch history:', e.message);
    return [];
  }
}

// ── DELETE AUDIT FROM HISTORY ─────────────────────────────────
export async function deleteAuditHistory(docId) {
  if (!isAdmin()) {
    showToast('Only administrators can delete audits.');
    return false;
  }

  try {
    await FB.deleteDoc(FB.docRef('pagespeed_audits', docId));
    showToast('Audit deleted.');
    return true;
  } catch (e) {
    showToast('Delete failed: ' + e.message);
    return false;
  }
}
