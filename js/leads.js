// ============================================================
// LEADS.JS — Lead CRUD, round-robin assignment, status workflow,
// history logging, filters, urgent actions, follow-up reminders
// ============================================================

// ============================================================
// STATUS LIST
// ============================================================
// NOTE: "Pending Approval" and "Re-Call Required" are SYSTEM-ONLY statuses.
// They are automatically assigned by the workflow and should NEVER be 
// manually selectable in the dropdown. They are managed via callAuditStatus field.
// ============================================================

const STATUS_LIST = [
  "Not Open",
  "Busy",
  "Not Picking Call",
  "Interested",
  "Not Interested",
  "Job Seeker",
  "Driver",
  "Transporter"
];

// System-only statuses (never shown in dropdown, set automatically by workflow)
const SYSTEM_STATUSES = ["Pending Approval", "Re-Call Required"];

// Statuses that require mandatory call audit (Sales Members cannot set directly)
const AUDIT_REQUIRED_STATUSES = ["Not Interested"];

// Reminder delay in minutes per status — now read from CRM Settings at runtime.
// STATUS_REMINDER_MINUTES kept as a fallback for the very first render before
// Firestore settings load; actual values come from getCRMSetting().
const STATUS_REMINDER_MINUTES = {
  "Busy": 60,
  "Not Picking Call": 240
};

const STATUS_BADGE_CLASS = {
  "Not Open": "badge-not-open",
  "Busy": "badge-busy",
  "Not Picking Call": "badge-not-picking",
  "Interested": "badge-interested",
  "Not Interested": "badge-not-interested",
  "Job Seeker": "badge-job-seeker",
  "Driver": "badge-driver",
  "Transporter": "badge-transporter",
  "Pending Approval": "badge-pending-approval",
  "Re-Call Required": "badge-recall-required"
};

const UNCONTACTED_ALERT_MINUTES = 30; // fallback — overridden at runtime by getCRMSetting("leadRules.uncontactedAlertMinutes")

let ALL_LEADS = [];       // full scoped dataset from snapshot
let ACTIVE_MEMBERS = [];  // cached active member list for dropdowns
let toastedLeadIds = new Set(); // session-only, avoid repeat toast spam

// ---------------- LOAD / SUBSCRIBE ----------------
async function loadLeadsView() {
  await refreshActiveMembers();
  buildLeadFilterUI();

  // Sort by slNo descending so the highest (newest) serial number is always
  // first. Firestore returns documents in this order server-side, so there is
  // no flash of wrong order and no client-side re-sort is required.
  //
  // Admin / Super Admin  →  leadsRef.orderBy("slNo", "desc")
  //   Single-field index — Firestore creates it automatically.
  //
  // Member               →  where("assignedTo") + orderBy("slNo", "desc")
  //   Requires a composite index. Defined in firestore.indexes.json.
  //   If the index is not yet built, Firestore will print a direct
  //   creation link in the browser console on the first run.
  let query = leadsRef.orderBy("slNo", "desc");
  if (CURRENT_USER.role === "member") {
    query = leadsRef
      .where("assignedTo", "==", CURRENT_USER.uid)
      .orderBy("slNo", "desc");
  }

  query.onSnapshot((snap) => {
    ALL_LEADS = [];
    snap.forEach((doc) => ALL_LEADS.push({ id: doc.id, ...doc.data() }));
    // Firestore already returns docs in slNo desc order.
    // No client-side sort needed.
    renderLeadsTable();
    checkReminders(); // re-evaluate whenever data changes
  }, (err) => console.error("Leads snapshot error:", err));
}

async function refreshActiveMembers() {
  const snap = await usersRef.where("role", "==", "member").where("active", "==", true).get();
  ACTIVE_MEMBERS = [];
  snap.forEach((doc) => ACTIVE_MEMBERS.push({ id: doc.id, ...doc.data() }));
  ACTIVE_MEMBERS.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
}

// ---------------- CREATE LEAD (Admin / Super Admin) ----------------
async function createLead(formData) {
  // Delegate to Smart Assignment engine in assignment.js
  await smartCreateLead(formData);
}

// ---------------- UPDATE STATUS / NOTE (with history) ----------------
async function updateLeadStatus(leadId, newStatus, noteText) {
  const leadRef = leadsRef.doc(leadId);
  const now = firebase.firestore.Timestamp.now();

  // Read reminder delays from live CRM Settings; fall back to hardcoded values
  const reminderMap = {
    "Busy":            (typeof getCRMSetting === "function" ? getCRMSetting("leadRules.reminderAfterMinutes") : null) || 60,
    "Not Picking Call": 240
  };

  let nextFollowUpAt = null;
  const reminderMinutes = reminderMap[newStatus];
  if (reminderMinutes) {
    nextFollowUpAt = firebase.firestore.Timestamp.fromMillis(Date.now() + reminderMinutes * 60000);
  }

  const historyEntry = {
    text: noteText && noteText.trim() ? noteText.trim() : "(status updated, no note added)",
    statusAtTime: newStatus,
    updatedBy: CURRENT_USER.uid,
    updatedByName: CURRENT_USER.name || CURRENT_USER.email,
    timestamp: new Date().toISOString()
  };

  await leadRef.update({
    status: newStatus,
    lastContactedAt: now,
    nextFollowUpAt: nextFollowUpAt,
    history: firebase.firestore.FieldValue.arrayUnion(historyEntry)
  });
}

// ---------------- DELETE / EDIT (Super Admin only) ----------------
async function deleteLead(leadId) {
  const lead = ALL_LEADS.find((l) => l.id === leadId);
  const historyEntry = {
    text: "Lead deleted by Super Admin",
    statusAtTime: lead ? lead.status : "",
    updatedBy: CURRENT_USER.uid,
    updatedByName: CURRENT_USER.name || CURRENT_USER.email,
    timestamp: new Date().toISOString()
  };
  // Log to an audit trail collection before removing, so history isn't lost
  await db.collection("deletedLeadsAudit").add({
    ...lead,
    ...historyEntry,
    deletedAt: firebase.firestore.Timestamp.now()
  });
  await leadsRef.doc(leadId).delete();
}

async function editLeadDetails(leadId, formData) {
  const historyEntry = {
    text: "Lead details edited by Super Admin",
    statusAtTime: formData.status || null,
    updatedBy: CURRENT_USER.uid,
    updatedByName: CURRENT_USER.name || CURRENT_USER.email,
    timestamp: new Date().toISOString()
  };
  await leadsRef.doc(leadId).update({
    ...formData,
    history: firebase.firestore.FieldValue.arrayUnion(historyEntry)
  });
}

// ---------------- RENDER: FILTER UI ----------------
function buildLeadFilterUI() {
  const wrap = document.getElementById("leadFilters");
  if (!wrap) return;

  const showMemberFilter = CURRENT_USER.role !== "member";
  const memberOptions = ACTIVE_MEMBERS.map(
    (m) => `<option value="${m.id}">${m.name || m.email}</option>`
  ).join("");

  wrap.innerHTML = `
    <div class="row g-2 align-items-end mb-3">
      <div class="col-6 col-md-3">
        <label class="form-label small mb-1">Status</label>
        <select id="filterStatus" class="form-select form-select-sm">
          <option value="">All Statuses</option>
          ${STATUS_LIST.map((s) => `<option value="${s}">${s}</option>`).join("")}
        </select>
      </div>
      ${showMemberFilter ? `
      <div class="col-6 col-md-3">
        <label class="form-label small mb-1">Assigned To</label>
        <select id="filterMember" class="form-select form-select-sm">
          <option value="">All Members</option>
          ${memberOptions}
        </select>
      </div>` : ""}
      <div class="col-6 col-md-3">
        <label class="form-label small mb-1">Search</label>
        <input id="filterSearch" type="text" class="form-control form-control-sm" placeholder="Name, phone, company...">
      </div>
      <div class="col-6 col-md-3">
        <button class="btn btn-sm btn-outline-secondary w-100" onclick="clearLeadFilters()">Clear Filters</button>
      </div>
    </div>`;

  wrap.querySelectorAll("select, input").forEach((el) => {
    el.addEventListener("input", renderLeadsTable);
  });
}

function clearLeadFilters() {
  const status = document.getElementById("filterStatus");
  const member = document.getElementById("filterMember");
  const search = document.getElementById("filterSearch");
  if (status) status.value = "";
  if (member) member.value = "";
  if (search) search.value = "";
  renderLeadsTable();
}

// ---------------- RENDER: LEADS TABLE ----------------
function renderLeadsTable() {
  const tbody = document.getElementById("leadsTableBody");
  if (!tbody) return;

  const statusFilter = document.getElementById("filterStatus")?.value || "";
  const memberFilter = document.getElementById("filterMember")?.value || "";
  const searchFilter = (document.getElementById("filterSearch")?.value || "").toLowerCase();

  let rows = ALL_LEADS.filter((l) => {
    if (statusFilter && l.status !== statusFilter) return false;
    if (memberFilter && l.assignedTo !== memberFilter) return false;
    if (searchFilter) {
      const hay = `${l.fullName} ${l.phoneNumber} ${l.companyName} ${l.email}`.toLowerCase();
      if (!hay.includes(searchFilter)) return false;
    }
    return true;
  });

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted py-4">No leads found.</td></tr>`;
    return;
  }

  const canEditDelete = CURRENT_USER.role === "superadmin";
  tbody.innerHTML = rows.map((l) => {
    const created = l.createdAt ? l.createdAt.toDate() : new Date();
    const uncontactedOverdue = isUncontactedOverdue(l);
    const isPending = !!l.assignmentPending;
    return `
    <tr class="${uncontactedOverdue ? "row-urgent" : ""}">
      <td>${l.slNo}</td>
      <td>${formatDateTime(created)}</td>
      <td>${escapeHtml(l.fullName)}</td>
      <td>${escapeHtml(l.companyName || "-")}</td>
      <td>${escapeHtml(l.phoneNumber)}</td>
      <td>${escapeHtml(l.email || "-")}</td>
      <td>${escapeHtml(l.serviceNeeded || "-")}</td>
      <td>
        ${isPending
          ? `<span class="badge badge-pending-assignment"><i class="bi bi-hourglass-split me-1"></i>Pending Assignment</span>`
          : escapeHtml(l.assignedToName || "-")}
      </td>
      <td><span class="status-badge ${STATUS_BADGE_CLASS[l.status] || ""}">${l.status}</span>
        ${uncontactedOverdue ? '<div class="small text-danger mt-1"><i class="bi bi-alarm"></i> Overdue</div>' : ""}
      </td>
      <td class="text-nowrap">
        ${isPending ? "" : `<button class="btn btn-sm btn-primary" onclick="openStatusModal('${l.id}')"><i class="bi bi-pencil-square"></i> Update</button>`}
        <button class="btn btn-sm btn-outline-secondary" onclick="openHistoryModal('${l.id}')"><i class="bi bi-clock-history"></i></button>
        ${isPending ? "" : `<button class="btn btn-sm btn-ai-pitch" onclick="openSalesPitchModal('${l.id}')" title="AI Sales Pitch"><i class="bi bi-robot"></i> AI Pitch</button>`}
        ${canEditDelete ? `<button class="btn btn-sm btn-outline-danger" onclick="confirmDeleteLead('${l.id}')"><i class="bi bi-trash"></i></button>` : ""}
      </td>
    </tr>`;
  }).join("");
}

function isUncontactedOverdue(lead) {
  // Kept for backwards compatibility (row highlighting in leads table).
  // Delegates to the new overdueMinutes helper.
  return overdueMinutes(lead) > 0;
}

function isFollowUpDue(lead) {
  if (!lead.nextFollowUpAt) return false;
  return lead.nextFollowUpAt.toDate().getTime() <= Date.now();
}

// ── Overdue helpers ───────────────────────────────────────────────────────────

/**
 * Returns total minutes a lead has been overdue (0 if not overdue).
 * A lead is urgent when:
 *   (a) status === "Not Open" AND createdAt > UNCONTACTED_ALERT_MINUTES ago, OR
 *   (b) nextFollowUpAt has passed.
 */
function overdueMinutes(lead) {
  const now = Date.now();
  let maxOverdue = 0;

  // Read live from CRM Settings (falls back to module constant if settings not yet loaded)
  const alertMin = (typeof getCRMSetting === "function"
    ? getCRMSetting("leadRules.uncontactedAlertMinutes")
    : null) || UNCONTACTED_ALERT_MINUTES;

  // Rule (a): uncontacted "Not Open" lead
  if (lead.status === "Not Open" && lead.createdAt) {
    const ageMin = (now - lead.createdAt.toMillis()) / 60000;
    if (ageMin >= alertMin) {
      maxOverdue = Math.max(maxOverdue, Math.floor(ageMin - alertMin));
    }
  }

  // Rule (b): missed follow-up reminder
  if (lead.nextFollowUpAt) {
    const passedMin = (now - lead.nextFollowUpAt.toMillis()) / 60000;
    if (passedMin > 0) {
      maxOverdue = Math.max(maxOverdue, Math.floor(passedMin));
    }
  }

  return maxOverdue;
}

/** True when the lead has any urgency (used for row highlighting etc.) */
function isUrgentLead(lead) {
  return overdueMinutes(lead) > 0;
}

/**
 * Returns priority level string and CSS class based on overdue duration.
 *   > 120 min  → Critical  (dark red)
 *   60–120 min → High      (orange)
 *   0–60 min   → Medium    (yellow)
 */
function urgentPriority(overdueMin) {
  if (overdueMin > 120) return { label: "Critical",  cls: "urgent-critical" };
  if (overdueMin >= 60)  return { label: "High",      cls: "urgent-high"     };
  return                        { label: "Medium",    cls: "urgent-medium"   };
}

/** Human-readable overdue label, e.g. "2 hr 15 min" */
function formatOverdue(overdueMin) {
  if (overdueMin < 60) return `${overdueMin} min`;
  const h = Math.floor(overdueMin / 60);
  const m = overdueMin % 60;
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
}

// ── WhatsApp phone normaliser (shared) ────────────────────────────────────────
function normalisePhone(raw) {
  let phone = (raw || "").replace(/[\s\-().+]/g, "");
  if (phone.startsWith("0")) phone = "91" + phone.slice(1);
  return /^\d{10,15}$/.test(phone) ? phone : null;
}

// ── Urgent Actions — role-branching entry point ───────────────────────────────
function renderUrgentActions() {
  const container = document.getElementById("urgentActionsBody");
  if (!container) return;

  if (CURRENT_USER.role === "member") {
    _renderUrgentMember(container);
  } else {
    _renderUrgentStaff(container);
  }
}

// ── STAFF view (Admin / Super Admin) — full team ──────────────────────────────
function _renderUrgentStaff(container) {
  // Collect all urgent leads with their overdue minutes, sorted most overdue first
  const urgent = ALL_LEADS
    .map(l => ({ lead: l, min: overdueMinutes(l) }))
    .filter(x => x.min > 0)
    .sort((a, b) => b.min - a.min);

  if (urgent.length === 0) {
    container.innerHTML = `
      <div class="urgent-empty">
        <div class="urgent-empty-icon">🎉</div>
        <div class="urgent-empty-title">Great Job!</div>
        <div class="urgent-empty-sub">No urgent leads right now. All leads are being attended to.</div>
      </div>`;
    return;
  }

  container.innerHTML = urgent.map(({ lead: l, min }) => {
    const { label, cls } = urgentPriority(min);
    const phone = normalisePhone(l.phoneNumber);
    return `
    <div class="urgent-card-v2 ${cls}">
      <div class="urgent-card-priority-bar"></div>
      <div class="urgent-card-body">

        <div class="urgent-card-top">
          <div class="urgent-card-meta">
            <span class="urgent-sl">Sl.No ${l.slNo}</span>
            <span class="urgent-priority-badge ${cls}-badge">${label}</span>
          </div>
          <div class="urgent-overdue-pill ${cls}-pill">
            <i class="bi bi-alarm-fill me-1"></i>Overdue ${formatOverdue(min)}
          </div>
        </div>

        <div class="urgent-card-info">
          <div class="urgent-name">${escapeHtml(l.fullName)}</div>
          <div class="urgent-company">${escapeHtml(l.companyName || "—")}</div>
        </div>

        <div class="urgent-card-details">
          <span class="urgent-detail-item">
            <i class="bi bi-person-fill"></i>${escapeHtml(l.assignedToName || "Unassigned")}
          </span>
          <span class="urgent-detail-item">
            <i class="bi bi-telephone-fill"></i>${escapeHtml(l.phoneNumber || "—")}
          </span>
          <span class="urgent-detail-item">
            <span class="status-badge ${STATUS_BADGE_CLASS[l.status] || ""}">${l.status}</span>
          </span>
        </div>

        <div class="urgent-card-actions">
          ${phone ? `
          <a href="tel:${phone}" class="btn btn-sm btn-success">
            <i class="bi bi-telephone-fill"></i> Call
          </a>` : ""}
          <button class="btn btn-sm btn-primary" onclick="openStatusModal('${l.id}')">
            <i class="bi bi-pencil-square"></i> Update
          </button>
          <button class="btn btn-sm btn-ai-pitch" onclick="openSalesPitchModal('${l.id}')">
            <i class="bi bi-robot"></i> AI Pitch
          </button>
          ${phone ? `
          <a href="https://wa.me/${phone}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-whatsapp">
            <i class="bi bi-whatsapp"></i> WhatsApp
          </a>` : ""}
          <button class="btn btn-sm btn-outline-secondary" onclick="openHistoryModal('${l.id}')">
            <i class="bi bi-clock-history"></i> History
          </button>
        </div>

      </div>
    </div>`;
  }).join("");
}

// ── MEMBER view — only their own urgent leads ─────────────────────────────────
function _renderUrgentMember(container) {
  const urgent = ALL_LEADS
    .filter(l => l.assignedTo === CURRENT_USER.uid)   // safety: members only see their own
    .map(l => ({ lead: l, min: overdueMinutes(l) }))
    .filter(x => x.min > 0)
    .sort((a, b) => b.min - a.min);

  if (urgent.length === 0) {
    container.innerHTML = `
      <div class="urgent-empty">
        <div class="urgent-empty-icon">🎉</div>
        <div class="urgent-empty-title">Great Job!</div>
        <div class="urgent-empty-sub">No urgent leads assigned to you. Keep it up!</div>
      </div>`;
    return;
  }

  container.innerHTML = urgent.map(({ lead: l, min }) => {
    const { label, cls } = urgentPriority(min);
    const phone = normalisePhone(l.phoneNumber);
    return `
    <div class="urgent-card-v2 ${cls}">
      <div class="urgent-card-priority-bar"></div>
      <div class="urgent-card-body">

        <div class="urgent-card-top">
          <div class="urgent-card-meta">
            <span class="urgent-sl">Sl.No ${l.slNo}</span>
            <span class="urgent-priority-badge ${cls}-badge">${label}</span>
          </div>
          <div class="urgent-overdue-pill ${cls}-pill">
            <i class="bi bi-alarm-fill me-1"></i>Overdue ${formatOverdue(min)}
          </div>
        </div>

        <div class="urgent-card-info">
          <div class="urgent-name">${escapeHtml(l.fullName)}</div>
          <div class="urgent-company">${escapeHtml(l.companyName || "—")}</div>
        </div>

        <div class="urgent-card-details">
          ${phone ? `<span class="urgent-detail-item"><i class="bi bi-telephone-fill"></i>${escapeHtml(l.phoneNumber)}</span>` : ""}
          <span class="urgent-detail-item">
            <span class="status-badge ${STATUS_BADGE_CLASS[l.status] || ""}">${l.status}</span>
          </span>
        </div>

        <div class="urgent-card-actions">
          ${phone ? `
          <a href="tel:${phone}" class="btn btn-sm btn-success">
            <i class="bi bi-telephone-fill"></i> Call
          </a>` : ""}
          <button class="btn btn-sm btn-primary" onclick="openStatusModal('${l.id}')">
            <i class="bi bi-pencil-square"></i> Update
          </button>
          <button class="btn btn-sm btn-ai-pitch" onclick="openSalesPitchModal('${l.id}')">
            <i class="bi bi-robot"></i> AI Pitch
          </button>
          ${phone ? `
          <a href="https://wa.me/${phone}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-whatsapp">
            <i class="bi bi-whatsapp"></i> WhatsApp
          </a>` : ""}
        </div>

      </div>
    </div>`;
  }).join("");
}

// ---------------- MEMBER FOLLOW-UP LIST ----------------
function renderMyFollowUps() {
  const container = document.getElementById("myFollowUpsBody");
  if (!container) return;

  const dueList = ALL_LEADS
    .filter((l) => l.nextFollowUpAt)
    .sort((a, b) => a.nextFollowUpAt.toMillis() - b.nextFollowUpAt.toMillis());

  if (dueList.length === 0) {
    container.innerHTML = `<p class="text-muted">No pending follow-ups scheduled.</p>`;
    return;
  }

  container.innerHTML = dueList.map((l) => {
    const dt = l.nextFollowUpAt.toDate();
    const due = dt.getTime() <= Date.now();
    return `
    <div class="followup-card ${due ? "followup-due" : ""}">
      <div>
        <strong>${escapeHtml(l.fullName)}</strong> · ${escapeHtml(l.phoneNumber)}
        <div class="small text-muted">Status: ${l.status} · Sl.No ${l.slNo}</div>
      </div>
      <div class="text-end">
        <div class="fw-semibold ${due ? "text-danger" : ""}">${due ? "Call now" : "Call at " + formatDateTime(dt)}</div>
        <button class="btn btn-sm btn-primary mt-1" onclick="openStatusModal('${l.id}')">Update</button>
      </div>
    </div>`;
  }).join("");
}

// ---------------- REMINDER WATCHER (toasts) ----------------
function startReminderWatcher() {
  checkReminders();
  setInterval(checkReminders, 60000); // check every minute
}

function checkReminders() {
  // Suppress all reminders during breaks, holidays, and outside office hours
  if (typeof shouldSuppressReminders === "function" && shouldSuppressReminders()) return;

  const toastEnabled = (typeof getCRMSetting === "function"
    ? getCRMSetting("notificationRules.toastNotifications") : true) !== false;
  const browserEnabled = (typeof getCRMSetting === "function"
    ? getCRMSetting("notificationRules.browserNotifications") : true) !== false;

  ALL_LEADS.forEach((l) => {
    const key = l.id + "_" + l.status;

    if (isUncontactedOverdue(l) && !toastedLeadIds.has(key)) {
      toastedLeadIds.add(key);
      if (CURRENT_USER.role === "member") {
        if (l.assignedTo === CURRENT_USER.uid) {
          if (toastEnabled)   toast(`Lead #${l.slNo} needs immediate attention — ${l.fullName}.`, "warning");
          if (browserEnabled) browserNotify("Urgent Lead", `Lead #${l.slNo} — ${l.fullName} (${l.phoneNumber})`);
        }
      } else {
        if (toastEnabled) toast(
          `Overdue: <strong>${escapeHtml(l.fullName)}</strong> (Sl.No ${l.slNo}) — assigned to ${escapeHtml(l.assignedToName)} — ${formatOverdue(overdueMinutes(l))} overdue.`,
          "danger"
        );
      }
    }

    if (CURRENT_USER.role === "member" && isFollowUpDue(l) && !toastedLeadIds.has(key + "_followup")) {
      if (l.assignedTo === CURRENT_USER.uid) {
        toastedLeadIds.add(key + "_followup");
        if (toastEnabled)   toast(`Follow-up due now: ${escapeHtml(l.fullName)} (${l.status}).`, "info");
        if (browserEnabled) browserNotify("Follow-up due", `${l.fullName} — ${l.status}`);
      }
    }
  });

  // ── Update sidebar badge ──────────────────────────────────────────────────
  const badge = document.getElementById("urgentBadge");
  if (!badge) return;

  let urgentCount = 0;
  if (CURRENT_USER.role === "member") {
    urgentCount = ALL_LEADS.filter(
      l => l.assignedTo === CURRENT_USER.uid && overdueMinutes(l) > 0
    ).length;
  } else {
    urgentCount = ALL_LEADS.filter(l => overdueMinutes(l) > 0).length;
  }

  if (urgentCount > 0) {
    badge.textContent = urgentCount;
    badge.classList.remove("d-none");
  } else {
    badge.classList.add("d-none");
  }

  // Also refresh the urgent view if it is currently visible
  const urgentSection = document.getElementById("view-urgent");
  if (urgentSection && !urgentSection.classList.contains("d-none")) {
    renderUrgentActions();
  }
}

// ---------------- MODALS: Add Lead ----------------
const addLeadForm = document.getElementById("addLeadForm");
if (addLeadForm) {
  addLeadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("addLeadSubmitBtn");
    btn.disabled = true;
    try {
      await createLead({
        serviceNeeded: document.getElementById("leadService").value.trim(),
        email: document.getElementById("leadEmail").value.trim(),
        fullName: document.getElementById("leadFullName").value.trim(),
        phoneNumber: document.getElementById("leadPhone").value.trim(),
        companyName: document.getElementById("leadCompany").value.trim()
      });
      addLeadForm.reset();
      bootstrap.Modal.getInstance(document.getElementById("addLeadModal")).hide();
      toast("Lead added and auto-assigned.", "success");
    } catch (err) {
      console.error(err);
      toast(err.message || "Failed to add lead.", "danger");
    } finally {
      btn.disabled = false;
    }
  });
}

// ---------------- MODALS: Update Status ----------------
let currentStatusLeadId = null;

function openStatusModal(leadId) {
  const lead = ALL_LEADS.find((l) => l.id === leadId);
  if (!lead) return;
  currentStatusLeadId = leadId;

  document.getElementById("statusModalLeadName").textContent = `${lead.fullName} — ${lead.phoneNumber}`;
  const select = document.getElementById("statusSelect");
  
  // Build dropdown with all regular statuses (SYSTEM_STATUSES are never selectable)
  // "Not Interested" IS visible for everyone - it's intercepted for members
  select.innerHTML = STATUS_LIST.map((s) => `<option value="${s}" ${s === lead.status ? "selected" : ""}>${s}</option>`).join("");
  document.getElementById("statusNote").value = "";

  new bootstrap.Modal(document.getElementById("statusModal")).show();
}

const statusUpdateForm = document.getElementById("statusUpdateForm");
if (statusUpdateForm) {
  statusUpdateForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newStatus = document.getElementById("statusSelect").value;
    const note = document.getElementById("statusNote").value;
    const lead = ALL_LEADS.find(l => l.id === currentStatusLeadId);
    
    // Check if this is a "Not Interested" status for a Sales Member
    if (newStatus === "Not Interested" && CURRENT_USER.role === "member") {
      // Intercept and open call audit modal - do NOT change status directly
      handleNotInterestedStatus(currentStatusLeadId, lead);
      return;
    }
    
    try {
      await updateLeadStatus(currentStatusLeadId, newStatus, note);
      bootstrap.Modal.getInstance(document.getElementById("statusModal")).hide();
      toast("Status updated.", "success");
    } catch (err) {
      console.error(err);
      toast("Failed to update status.", "danger");
    }
  });
}

// ---------------- MODAL: History ----------------
function openHistoryModal(leadId) {
  const lead = ALL_LEADS.find((l) => l.id === leadId);
  if (!lead) return;

  document.getElementById("historyModalLeadName").textContent = `${lead.fullName} — Sl.No ${lead.slNo}`;
  const body = document.getElementById("historyModalBody");

  const history = [...(lead.history || [])].reverse();
  if (history.length === 0) {
    body.innerHTML = `<p class="text-muted">No history yet.</p>`;
  } else {
    body.innerHTML = history.map((h) => `
      <div class="history-entry">
        <div class="d-flex justify-content-between">
          <span class="fw-semibold">${escapeHtml(h.updatedByName || "Unknown")}</span>
          <span class="small text-muted">${formatDateTime(new Date(h.timestamp))}</span>
        </div>
        <div class="small text-muted mb-1">Status: ${h.statusAtTime || "-"}</div>
        <div>${escapeHtml(h.text)}</div>
      </div>`).join("");
  }

  new bootstrap.Modal(document.getElementById("historyModal")).show();
}

// ---------------- DELETE CONFIRM (Super Admin) ----------------
function confirmDeleteLead(leadId) {
  const lead = ALL_LEADS.find((l) => l.id === leadId);
  if (!lead) return;
  if (confirm(`Delete lead "${lead.fullName}" (Sl.No ${lead.slNo})? This cannot be undone.`)) {
    deleteLead(leadId)
      .then(() => toast("Lead deleted.", "success"))
      .catch((err) => {
        console.error(err);
        toast("Failed to delete lead.", "danger");
      });
  }
}

// ---------------- UTILS ----------------
function formatDateTime(date) {
  return date.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}