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

  // Subscribe to CRM Settings in real time (all roles)
  subscribeCRMSettings();

  // Subscribe to Campaigns + Campaign Fields (all roles need the cache;
  // only Super Admin sees the management UI)
  subscribeCampaigns();

  // Load personal AI settings
  await loadAISettings();

  await loadLeadsView();

  if (CURRENT_USER.role === "superadmin") {
    await loadUsersView();
  }

  // Subscribe to Call Audits (for Admin/Super Admin dashboard)
  if (CURRENT_USER.role === "admin" || CURRENT_USER.role === "superadmin") {
    subscribeCallAudits();
  }

  // Start background watchers
  startReminderWatcher();
  startAssignmentWatcher();          // smart assignment engine

  // Post-login checks
  await checkAISetupPrompt();
  await checkHolidayWelcome();       // show welcome popup if yesterday was a holiday
}

function buildNav() {
  const nav     = document.getElementById("sideNav");
  const isSA    = CURRENT_USER.role === "superadmin";
  const isAdmin = CURRENT_USER.role === "admin";
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
    // Admin + Super Admin
    html += `
    <a href="#" class="nav-link nav-item-link" data-view="dashboard">
      <i class="bi bi-speedometer2"></i> Dashboard
    </a>
    <a href="#" class="nav-link nav-item-link" data-view="urgent">
      <i class="bi bi-exclamation-triangle"></i>
      Urgent Actions
      <span id="urgentBadge" class="urgent-nav-badge d-none"></span>
    </a>
    <a href="#" class="nav-link nav-item-link" data-view="callaudit">
      <i class="bi bi-clipboard-check"></i> Call Audit
    </a>
    <a href="#" class="nav-link nav-item-link" data-view="report">
      <i class="bi bi-file-earmark-text"></i> Daily Report
    </a>`;
  }

  // Leave Management — all roles (members see own leave only)
  html += `
    <a href="#" class="nav-link nav-item-link" data-view="leave">
      <i class="bi bi-calendar2-check"></i> Leave Management
    </a>`;

  if (!isMember) {
    html += `
    <a href="#" class="nav-link nav-item-link" data-view="auditlog">
      <i class="bi bi-journal-text"></i> Audit Log
    </a>`;
  }

  if (isSA) {
    html += `
    <a href="#" class="nav-link nav-item-link" data-view="users">
      <i class="bi bi-people"></i> Manage Team
    </a>
    <a href="#" class="nav-link nav-item-link" data-view="campaigns">
      <i class="bi bi-columns-gap"></i> Campaign Form Builder
    </a>`;
  }

  // CRM Settings — all roles (read-only for non-SA)
  html += `
    <a href="#" class="nav-link nav-item-link nav-crm-settings" data-view="crmsettings">
      <i class="bi bi-gear-fill"></i> CRM Settings
    </a>`;

  // AI Settings — all roles
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
  if (viewName === "report")      initReportControls();
  if (viewName === "aisettings")  renderAISettingsView();
  if (viewName === "crmsettings") renderCRMSettingsView();
  if (viewName === "leave")       loadLeaveView();
  if (viewName === "dashboard")   renderDashboardCards();
  if (viewName === "auditlog")    renderAuditLog();
  if (viewName === "callaudit")   renderCallAuditDashboard();
  if (viewName === "campaigns")   renderCampaignsView();
}

// ── Dashboard Cards ───────────────────────────────────────────
async function renderDashboardCards() {
  const grid = document.getElementById("dashboardCardsGrid");
  const listWrap = document.getElementById("dashboardPendingList");
  if (!grid) return;

  grid.innerHTML = `<div class="col-12 text-center text-muted py-3">
    <span class="spinner-border spinner-border-sm me-2"></span>Loading…</div>`;

  const today = new Date().toISOString().slice(0, 10);

  // Parallel fetches
  const [pendingSnap, assignedSnap, leaveSnap, queueSnap] = await Promise.all([
    leadsRef.where("assignmentPending", "==", true).get(),
    leadsRef.where("assignedAt", ">=", firebase.firestore.Timestamp.fromDate(
      new Date(today + "T00:00:00"))).get(),
    leavesRef.where("date", "==", today).where("status", "==", "Approved").get(),
    assignmentQueueRef.get()
  ]);

  const pendingCount  = pendingSnap.size;
  const assignedToday = assignedSnap.size;
  const onLeave       = leaveSnap.size;
  const queueCount    = queueSnap.size;

  const upcomingHols = (CRM_CONFIG.holidays || [])
    .filter(h => h.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  const workingMembers = ACTIVE_MEMBERS.length - onLeave;

  const cards = [
    { icon: "bi-hourglass-split", label: "Pending Assignment", value: pendingCount,  color: "var(--amber)" },
    { icon: "bi-person-check",    label: "Today's Assigned",   value: assignedToday, color: "#1E7A34" },
    { icon: "bi-calendar2-x",     label: "In Assignment Queue",value: queueCount,    color: "#B23434" },
    { icon: "bi-person-dash",     label: "On Leave Today",     value: onLeave,       color: "#C05621" },
    { icon: "bi-people-fill",     label: "Working Today",      value: workingMembers < 0 ? 0 : workingMembers, color: "var(--steel)" },
    { icon: "bi-calendar-event",  label: "Upcoming Holidays",  value: upcomingHols.length, color: "#6339B5" }
  ];

  grid.innerHTML = cards.map(c => `
    <div class="col-6 col-md-4 col-lg-2">
      <div class="dash-stat-card">
        <div class="dash-stat-icon" style="color:${c.color}">
          <i class="bi ${c.icon}"></i>
        </div>
        <div class="dash-stat-value" style="color:${c.color}">${c.value}</div>
        <div class="dash-stat-label">${c.label}</div>
      </div>
    </div>`).join("");

  // Pending leads detail list
  if (pendingCount === 0) {
    listWrap.innerHTML = "";
    return;
  }

  const pendingLeads = [];
  pendingSnap.forEach(d => pendingLeads.push({ id: d.id, ...d.data() }));

  listWrap.innerHTML = `
  <div class="crm-settings-card">
    <div class="crm-settings-card-header">
      <i class="bi bi-hourglass-split me-2"></i>Pending Assignment Leads
    </div>
    <div class="table-responsive">
      <table class="table align-middle table-hover mb-0" style="font-size:13.5px">
        <thead>
          <tr>
            <th>Sl.No</th><th>Name</th><th>Phone</th><th>Created</th><th>Reason</th>
          </tr>
        </thead>
        <tbody>
          ${pendingLeads.map(l => `
          <tr>
            <td>${l.slNo}</td>
            <td>${escapeHtml(l.fullName)}</td>
            <td>${escapeHtml(l.phoneNumber)}</td>
            <td>${l.createdAt ? formatDateTime(l.createdAt.toDate()) : "—"}</td>
            <td><span class="badge badge-pending-assignment">${escapeHtml(l.assignmentReason || "Pending")}</span></td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ── Audit Log ─────────────────────────────────────────────────
async function renderAuditLog() {
  const wrap = document.getElementById("auditLogBody");
  if (!wrap) return;

  wrap.innerHTML = `<div class="text-center text-muted py-4">
    <span class="spinner-border spinner-border-sm me-2"></span>Loading…</div>`;

  try {
    const snap = await auditLogRef.orderBy("timestamp", "desc").limit(200).get();
    if (snap.empty) {
      wrap.innerHTML = `<p class="text-muted">No audit entries yet.</p>`;
      return;
    }

    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));

    wrap.innerHTML = `
    <div class="table-card">
      <div class="table-responsive">
        <table class="table align-middle table-hover mb-0" style="font-size:13px">
          <thead>
            <tr>
              <th>Date &amp; Time</th>
              <th>Lead #</th>
              <th>Action</th>
              <th>Reason</th>
              <th>Actor</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
            <tr>
              <td class="text-nowrap">${r.timestamp ? formatDateTime(r.timestamp.toDate()) : "—"}</td>
              <td>${r.slNo || "—"}</td>
              <td><span class="badge audit-badge-${_auditBadgeClass(r.action)}">${escapeHtml(r.action)}</span></td>
              <td>${escapeHtml(r.reason || "—")}</td>
              <td>${escapeHtml(r.actor || "System")}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>`;
  } catch (err) {
    console.error("Audit log load failed:", err);
    wrap.innerHTML = `<p class="text-danger">Failed to load audit log.</p>`;
  }
}

function _auditBadgeClass(action) {
  if (!action) return "info";
  const a = action.toLowerCase();
  if (a.includes("assigned immediately") || a.includes("office opening")) return "success";
  if (a.includes("pending"))   return "warning";
  if (a.includes("skipped"))   return "danger";
  if (a.includes("holiday"))   return "secondary";
  return "info";
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