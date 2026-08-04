/**
 * auth.js - Firebase Authentication module
 * Handles login, register, forgot password, logout, session restore.
 */

import { FB } from './firebase.js';
import { showAlert, hideAlert, showToast } from './ui.js';
import { safeStr } from './utils.js';

const ADMIN_EMAIL = 'kothakulasagar2002@gmail.com';

// ── USER STATE ───────────────────────────────────────────────
let _currentUser = null;
let _userDoc     = null;

export function getUser()    { return _currentUser; }
export function getUserDoc() { return _userDoc; }
export function isAdmin()    { return _currentUser?.email === ADMIN_EMAIL; }

export function isAccessRestricted() {
  if (isAdmin()) return false;
  if (_userDoc?.blocked)           return true;
  if (_userDoc?.approved === false) return true;
  return false;
}

export function getAccessMessage() {
  if (_userDoc?.blocked) return 'Your account has been blocked. Please contact the administrator.';
  return 'Your account is pending administrator approval. Please wait.';
}

// ── LOAD / SAVE USER DOC ─────────────────────────────────────
export async function loadUserDoc(user) {
  if (!user) return null;
  try {
    const ref  = FB.docRef('users', user.uid);
    const snap = await FB.getDoc(ref);
    const defaults = {
      uid:         user.uid,
      email:       user.email || '',
      name:        user.displayName || user.email?.split('@')[0] || '',
      displayName: user.displayName || '',
      apiKey:      '',
      geminiKey:   '',
      openrouterKey: '',
      defaultProvider: 'groq',
      role:        user.email === ADMIN_EMAIL ? 'admin' : 'user',
      approved:    user.email === ADMIN_EMAIL,
      blocked:     false,
      theme:       'light',
      language:    'en',
      temperature: 0.9,
      maxTokens:   1500,
      createdAt:   FB.serverTimestamp(),
      lastLogin:   FB.serverTimestamp()
    };
    if (snap.exists()) {
      _userDoc = { ...defaults, ...snap.data() };
      // Always keep admin approved
      const updates = { lastLogin: FB.serverTimestamp() };
      if (user.email === ADMIN_EMAIL) {
        updates.role     = 'admin';
        updates.approved = true;
        updates.blocked  = false;
      }
      await FB.updateDoc(ref, updates);
      _userDoc = { ..._userDoc, ...updates, lastLogin: Date.now() };
    } else {
      await FB.setDoc(ref, defaults);
      _userDoc = { ...defaults, createdAt: Date.now(), lastLogin: Date.now() };
    }
    return _userDoc;
  } catch (e) {
    console.warn('[Auth] loadUserDoc error:', e.message);
    return null;
  }
}

// ── AUTH STATE OBSERVER ──────────────────────────────────────
export function onAuthReady(callback) {
  FB.onAuthChanged(async user => {
    _currentUser = user;
    if (user) {
      await loadUserDoc(user);
    } else {
      _userDoc = null;
    }
    callback(user);
  });
}

// ── LOGIN ────────────────────────────────────────────────────
export async function login() {
  hideAlert('login-alert');
  const emailRaw = document.getElementById('login-email')?.value.trim() || '';
  const pass     = document.getElementById('login-pass')?.value || '';
  const remember = document.getElementById('login-remember')?.checked;

  if (!emailRaw || !pass) {
    showAlert('login-alert', 'Please enter your email and password.'); return;
  }

  const email = emailRaw.includes('@') ? emailRaw : emailRaw + '@abrazylo.com';
  const btn   = document.getElementById('login-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Signing in...'; }

  try {
    await FB.signIn(email, pass);
    if (remember) localStorage.setItem('az-remember-email', email);
    else localStorage.removeItem('az-remember-email');
    // onAuthChanged will call the app callback
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = 'Sign in'; }
    showAlert('login-alert', _friendlyAuthError(err.code));
  }
}

// ── REGISTER ─────────────────────────────────────────────────
export async function register() {
  hideAlert('reg-alert');
  const name   = document.getElementById('reg-name')?.value.trim() || '';
  const email  = document.getElementById('reg-email')?.value.trim() || '';
  const pass   = document.getElementById('reg-pass')?.value || '';
  const apiKey = document.getElementById('reg-apikey')?.value.trim() || '';

  if (!name || name.length < 2)          { showAlert('reg-alert', 'Please enter your full name.');        return; }
  if (!email || !email.includes('@'))    { showAlert('reg-alert', 'Please enter a valid email address.'); return; }
  if (!pass  || pass.length < 6)         { showAlert('reg-alert', 'Password must be at least 6 characters.'); return; }

  const btn = document.getElementById('reg-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Creating account...'; }

  try {
    const cred = await FB.createUserWithEmailAndPassword(email, pass);
    await FB.updateProfile(cred.user, { displayName: name });
    await FB.setDoc(FB.docRef('users', cred.user.uid), {
      uid: cred.user.uid, name, displayName: name, email,
      apiKey: apiKey || '', geminiKey: '', openrouterKey: '',
      defaultProvider: 'groq', role: 'user', approved: false, blocked: false,
      theme: 'light', language: 'en', temperature: 0.9, maxTokens: 1500,
      createdAt: FB.serverTimestamp(), lastLogin: FB.serverTimestamp()
    });
    // onAuthChanged fires and logs them in
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = 'Create account'; }
    showAlert('reg-alert', _friendlyAuthError(err.code));
  }
}

// ── FORGOT PASSWORD ──────────────────────────────────────────
export function showForgot() {
  hideAlert('forgot-alert'); hideAlert('forgot-ok');
  const saved = localStorage.getItem('az-remember-email') || document.getElementById('login-email')?.value.trim() || '';
  const inp = document.getElementById('forgot-email');
  if (inp) inp.value = saved;
  document.getElementById('forgot-modal').style.display = 'flex';
}
export function hideForgot() {
  document.getElementById('forgot-modal').style.display = 'none';
}

export async function sendReset() {
  hideAlert('forgot-alert'); hideAlert('forgot-ok');
  const email = document.getElementById('forgot-email')?.value.trim() || '';
  if (!email || !email.includes('@')) {
    showAlert('forgot-alert', 'Please enter a valid email address.'); return;
  }
  const btn = document.querySelector('#forgot-modal .btn-accent');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
  try {
    await FB.sendReset(email);
    showAlert('forgot-ok', 'Reset link sent! Check your email.', 'success');
    if (btn) { btn.disabled = false; btn.textContent = 'Send Reset Link'; }
    setTimeout(hideForgot, 3000);
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = 'Send Reset Link'; }
    showAlert('forgot-alert', _friendlyAuthError(err.code));
  }
}

// ── LOGOUT ───────────────────────────────────────────────────
export async function logout() {
  try { await FB.signOut(); } catch { /* ignore */ }
  _currentUser = null;
  _userDoc     = null;
}

// ── VIEW SWITCHER ─────────────────────────────────────────────
export function showView(name) {
  document.querySelectorAll('.auth-view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(`view-${name}`);
  if (target) target.classList.add('active');
  // Pre-fill remembered email on login view
  if (name === 'login') {
    const saved = localStorage.getItem('az-remember-email');
    if (saved) {
      const el = document.getElementById('login-email');
      if (el) el.value = saved;
    }
  }
}

// ── PRIVATE HELPERS ──────────────────────────────────────────
function _friendlyAuthError(code) {
  const map = {
    'auth/user-not-found':         'No account found with this email.',
    'auth/wrong-password':         'Incorrect password. Please try again.',
    'auth/invalid-credential':     'Incorrect email or password.',
    'auth/email-already-in-use':   'This email is already registered. Please sign in.',
    'auth/weak-password':          'Password must be at least 6 characters.',
    'auth/invalid-email':          'Please enter a valid email address.',
    'auth/too-many-requests':      'Too many attempts. Please wait a moment.',
    'auth/network-request-failed': 'Network error. Check your connection.'
  };
  return map[code] || 'Something went wrong. Please try again.';
}

// ── UPDATE USER DOC FIELD ─────────────────────────────────────
export async function updateUserField(fields) {
  if (!_currentUser) return;
  try {
    await FB.updateDoc(FB.docRef('users', _currentUser.uid), fields);
    _userDoc = { ..._userDoc, ...fields };
  } catch (e) { console.warn('[Auth] updateUserField:', e.message); }
}

export function getApiKey(provider = 'groq') {
  if (provider === 'groq')        return safeStr(_userDoc?.apiKey);
  if (provider === 'gemini')      return safeStr(_userDoc?.geminiKey);
  if (provider === 'openrouter')  return safeStr(_userDoc?.openrouterKey);
  return '';
}
