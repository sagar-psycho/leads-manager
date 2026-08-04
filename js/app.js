/**
 * app.js - Main application controller
 *
 * Security init flow:
 *
 *   1. Page loads  →  #init-screen is visible, all other pages hidden
 *   2. Firebase SDK loads  →  onAuthStateChanged fires
 *   3a. No user  →  dismiss init screen, show login page only
 *   3b. User found  →  load Firestore user doc, check approval status
 *       - Pending/Blocked  →  show access-restricted screen
 *       - Approved  →  set body[data-app-ready], show full app
 *
 * The CSS rule:
 *   body[data-app-ready] .page-app.active { display: flex }
 * ensures the app shell is NEVER visible until this attribute is set.
 */
import * as Auth      from './auth.js';
import * as UI        from './ui.js';
import * as Dashboard from './dashboard.js';
import * as Generator from './seo-generator.js';
import * as History   from './history.js';
import * as Audit     from './audit.js';
import * as Settings  from './settings.js';
import * as Accounts  from './accounts.js';
import * as AuditHistory from './audit-history.js';
import * as Marketing from './marketing.js';

// ── EXPOSE MODULES TO window (required by HTML onclick attrs) ─
window.Auth      = Auth;
window.UI        = UI;
window.Dashboard = Dashboard;
window.Generator = Generator;
window.History   = History;
window.Audit     = Audit;
window.Settings  = Settings;
window.Accounts  = Accounts;
window.AuditHistory = AuditHistory;
window.Marketing = Marketing;

// ── APP CONTROLLER ────────────────────────────────────────────
const App = {
  _lang:          'en',
  _authConfirmed: false,   // true once onAuthStateChanged has fired at least once

  /**
   * Navigate to a tab.
   * Guards every route — unauthenticated calls are silently ignored.
   */
  go(tab) {
    // Hard block: refuse all navigation until auth is confirmed
    if (!this._authConfirmed) return;

    // Route guard: restricted users can only see the dashboard (access overlay)
    if (Auth.isAccessRestricted() && !Auth.isAdmin()) {
      _showAccessOverlay();
      UI.closeAllModals();
      UI.switchTab('dashboard');
      return;
    }

    // Accounts tab is admin-only
    if (tab === 'accounts' && !Auth.isAdmin()) return;
    
    // Campaigns and Meta Catalog tabs are admin-only
    if (tab === 'campaigns' && !Auth.isAdmin()) return;
    if (tab === 'campaign-detail' && !Auth.isAdmin()) return;
    if (tab === 'meta-catalog' && !Auth.isAdmin()) return;

    UI.closeAllModals();
    UI.switchTab(tab);

    // Lazy-load tab data
    if (tab === 'dashboard') Dashboard.loadStats();
    if (tab === 'history')   History.render();
    if (tab === 'audit')     Audit.renderHistory();
    if (tab === 'auditHistory') AuditHistory.render();
    if (tab === 'settings')  Settings.render();
    if (tab === 'accounts')  Accounts.render();
    if (tab === 'generate')  { 
      Generator.checkForm(); 
      Generator.initSeoGenerator();
    }
    if (tab === 'products')  Marketing.renderProducts();
    if (tab === 'campaigns') Marketing.renderCampaigns();
    if (tab === 'meta-catalog') Marketing.renderMetaCatalog();
    if (tab === 'campaign-detail') Marketing.renderCampaignDetail();
  },

  setLang(lang) {
    this._lang = lang;
    ['en', 'hi', 'te'].forEach(l =>
      document.getElementById(`lang-${l}`)?.classList.toggle('active', l === lang)
    );
    const sel = document.getElementById('prod-lang');
    if (sel) sel.value = lang;
  }
};

window.App = App;

// ── APPLY SAVED THEME IMMEDIATELY (before auth) ───────────────
// This runs synchronously before any async auth work so there is
// no theme flash. It does NOT show any protected content.
UI.initTheme();

// ── AUTH STATE OBSERVER ───────────────────────────────────────
// onAuthStateChanged is the ONLY entry point into the app.
// Every rendering decision flows from here.
Auth.onAuthReady(async user => {
  App._authConfirmed = true;

  if (user) {
    _setInitMessage('Verifying account status...');
    await _enterApp();
  } else {
    _dismissInitScreen();
    _showLandingPage();
  }
});

// ── ENTER APP FLOW ────────────────────────────────────────────
async function _enterApp() {
  const ud   = Auth.getUserDoc() || {};
  const user = Auth.getUser();

  // ── Admin-only element visibility ──
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = Auth.isAdmin() ? '' : 'none';
  });

  // ── Apply user theme ──
  UI.applyTheme(ud.theme || 'light');

  // ── Sync language ──
  App.setLang(ud.language || 'en');

  // ── Default provider ──
  const provSel = document.getElementById('prod-provider');
  if (provSel && ud.defaultProvider) provSel.value = ud.defaultProvider;

  // ── Populate sidebar ──
  const name  = ud.name || user.displayName || user.email?.split('@')[0] || 'User';
  const email = user.email || '';
  _setText('sidebar-name',  name);
  _setText('sidebar-email', email);
  _setText('sidebar-av',    name[0]?.toUpperCase() || 'U');

  // ── Reveal the app shell ──
  // Setting this attribute is the only place the CSS allows .page-app to display.
  document.body.setAttribute('data-app-ready', 'true');
  document.body.classList.add('app-ready');

  const authPage = document.getElementById('page-auth');
  const appPage  = document.getElementById('page-app');
  if (authPage) { authPage.classList.remove('active'); authPage.style.display = 'none'; }
  if (appPage)  appPage.classList.add('active');
  if (appPage)  appPage.style.display = 'flex';

  // ── Dismiss init screen ──
  _dismissInitScreen();

  // ── Route based on approval status ──
  if (Auth.isAccessRestricted() && !Auth.isAdmin()) {
    _showAccessOverlay();
    UI.switchTab('dashboard');   // show tab structure but overlaid
    return;
  }

  _hideAccessOverlay();

  // First visit with no API key: go straight to settings
  const hasKey = ud.apiKey || ud.geminiKey || ud.openrouterKey;
  if (!hasKey) {
    App.go('settings');
    UI.showToast('Welcome! Add your Groq API key in Settings to start generating SEO.');
  } else {
    App.go('dashboard');
  }

  // One-time welcome toast set during login/register
  const welcome = sessionStorage.getItem('az-welcome');
  if (welcome) { UI.showToast(welcome); sessionStorage.removeItem('az-welcome'); }

  // Init drag-drop
  Generator.initDragDrop();
}

// ── SHOW PUBLIC LANDING PAGE ─────────────────────────────────
function _showLandingPage() {
  const appPage = document.getElementById('page-app');
  if (appPage) { appPage.classList.remove('active'); appPage.style.display = 'none'; }

  const authPage = document.getElementById('page-auth');
  if (authPage) { authPage.classList.remove('active'); authPage.style.display = 'none'; }

  const publicPage = document.getElementById('page-public');
  if (publicPage) { publicPage.classList.add('active'); publicPage.style.display = 'block'; }

  document.body.removeAttribute('data-app-ready');
  document.body.classList.remove('app-ready');
}

// ── SHOW AUTH PAGE ────────────────────────────────────────────
function _showAuthPage() {
  const appPage = document.getElementById('page-app');
  if (appPage) { appPage.classList.remove('active'); appPage.style.display = 'none'; }

  const publicPage = document.getElementById('page-public');
  if (publicPage) { publicPage.classList.remove('active'); publicPage.style.display = 'none'; }

  document.body.removeAttribute('data-app-ready');
  document.body.classList.remove('app-ready');

  const authPage = document.getElementById('page-auth');
  if (authPage) { authPage.classList.add('active'); authPage.style.display = 'block'; }

  Auth.showView('login');
}

// ── INIT SCREEN HELPERS ───────────────────────────────────────
function _setInitMessage(msg) {
  const el = document.getElementById('init-message');
  if (el) el.textContent = msg;
}

function _dismissInitScreen() {
  const screen = document.getElementById('init-screen');
  if (!screen) return;
  screen.classList.add('hide');
  // Remove from DOM after transition so it cannot be unhidden via devtools
  setTimeout(() => screen.remove(), 350);
}

// ── ACCESS OVERLAY ────────────────────────────────────────────
function _showAccessOverlay() {
  const overlay = document.getElementById('access-overlay');
  const msg     = document.getElementById('access-msg');
  if (overlay) overlay.style.display = 'flex';
  if (msg)     msg.textContent = Auth.getAccessMessage();
}

function _hideAccessOverlay() {
  const el = document.getElementById('access-overlay');
  if (el) el.style.display = 'none';
}

// ── KEYBOARD ──────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const authPage  = document.getElementById('page-auth');
  const loginView = document.getElementById('view-login');
  if (authPage?.classList.contains('active') && loginView?.classList.contains('active')) {
    Auth.login();
  }
});

// ── CLICK OUTSIDE OVERLAY MODAL ───────────────────────────────
document.addEventListener('click', e => {
  const target = e.target;
  if (target instanceof HTMLElement && target.classList.contains('overlay') && target.id) {
    UI.closeModal(target.id);
  }
});

// ── HELPER ────────────────────────────────────────────────────
function _setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
