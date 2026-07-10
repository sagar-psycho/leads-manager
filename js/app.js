// ============================================================
// APP.JS — Shell: role-based nav, view switching, current user
// ============================================================

let CURRENT_USER = null; // { uid, email, name, role, active }

const ROLE_LABELS = {
  superadmin: "Super Admin",
  admin: "Admin",
  member: "Sales Member"
};

async function initApp() {
  CURRENT_USER = await requireAuth();
  window.CURRENT_USER = CURRENT_USER;

  document.getElementById("userName").textContent =
    CURRENT_USER.name || CURRENT_USER.email;
  document.getElementById("userRole").textContent =
    ROLE_LABELS[CURRENT_USER.role] || CURRENT_USER.role;

  // ADD LEAD BUTTON — admin / superadmin only
  if (CURRENT_USER.role === "admin" || CURRENT_USER.role === "superadmin") {
    document.getElementById("addLeadBtnWrap").innerHTML = `
      <button class="btn btn-brand"
              data-bs-toggle="modal"
              data-bs-target="#addLeadModal">
        <i class="bi bi-plus-lg"></i> Add Lead
      </button>`;
  }

  buildNav();
  showView("leads");
  requestNotificationPermission();

  // Load AI settings first so every AI feature has the key ready
  await loadAISettings();

  await loadLeadsView();

  if (CURRENT_USER.role === "superadmin") {
    await loadUsersView();
  }

  startReminderWatcher();

  // Show first-login AI setup prompt if key not yet configured
  await checkAISetupPrompt();
}

function buildNav() {
  const nav = document.getElementById("sideNav");
  const isMember = CURRENT_USER.role === "member";

  let html = `
    <a href="#" class="nav-link nav-item-link active" data-view="leads">
      <i class="bi bi-list-task"></i> Leads
    </a>`;

  if (isMember) {
    html += `
    <a href="#" class="nav-link nav-item-link" data-view="myfollowups">
      <i class="bi bi-clock-history"></i> Follow-ups
    </a>
    <a href="#" class="nav-link nav-item-link" data-view="urgent">
      <i class="bi bi-exclamation-triangle"></i>
      My Urgent Actions
      <span id="urgentBadge" class="urgent-nav-badge d-none"></span>
    </a>`;
  } else {
    html += `
    <a href="#" class="nav-link nav-item-link" data-view="urgent">
      <i class="bi bi-exclamation-triangle"></i>
      Urgent Actions
      <span id="urgentBadge" class="urgent-nav-badge d-none"></span>
    </a>
    <a href="#" class="nav-link nav-item-link" data-view="report">
      <i class="bi bi-file-earmark-text"></i> Daily Report
    </a>`;
  }

  if (CURRENT_USER.role === "superadmin") {
    html += `
    <a href="#" class="nav-link nav-item-link" data-view="users">
      <i class="bi bi-people"></i> Manage Team
    </a>`;
  }

  // AI Settings — visible to ALL authenticated users, no role restriction
  html += `
    <a href="#" class="nav-link nav-item-link nav-ai-settings" data-view="aisettings">
      <i class="bi bi-robot"></i> AI Settings
    </a>`;

  nav.innerHTML = html;

  document.querySelectorAll(".nav-item-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelectorAll(".nav-item-link").forEach((l) => l.classList.remove("active"));
      link.classList.add("active");
      showView(link.dataset.view);
    });
  });
}

function showView(viewName) {
  document.querySelectorAll(".view-section").forEach((v) => v.classList.add("d-none"));
  const el = document.getElementById("view-" + viewName);
  if (el) el.classList.remove("d-none");

  if (viewName === "urgent") {
    // Set role-specific title and subtitle before rendering
    const isMember = CURRENT_USER.role === "member";
    const titleEl    = document.getElementById("urgentViewTitle");
    const subtitleEl = document.getElementById("urgentViewSubtitle");
    if (titleEl)    titleEl.textContent    = isMember ? "My Urgent Actions" : "Urgent Actions";
    if (subtitleEl) subtitleEl.textContent = isMember
      ? "Your leads that need immediate attention."
      : "All team leads that need immediate attention — sorted by most overdue first.";
    renderUrgentActions();
  }
  if (viewName === "myfollowups") renderMyFollowUps();
  if (viewName === "report")      renderDailyReport();
  if (viewName === "aisettings")  renderAISettingsView();
}

function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function toast(message, type = "primary") {
  const container = document.getElementById("toastContainer");
  const id = "t" + Date.now();
  const html = `
    <div id="${id}" class="toast align-items-center text-bg-${type} border-0" role="alert">
      <div class="d-flex">
        <div class="toast-body">${message}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    </div>`;
  container.insertAdjacentHTML("beforeend", html);
  const toastEl = new bootstrap.Toast(document.getElementById(id), { delay: 8000 });
  toastEl.show();
}

function browserNotify(title, body) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: "" });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);
  initApp();
});
