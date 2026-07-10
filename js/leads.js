// ============================================================
// LEADS.JS — Lead CRUD, round-robin assignment, status workflow,
// history logging, filters, urgent actions, follow-up reminders
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

// Reminder delay in minutes per status (null = no auto follow-up reminder)
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
  "Transporter": "badge-transporter"
};

const UNCONTACTED_ALERT_MINUTES = 30;

let ALL_LEADS = [];       // full scoped dataset from snapshot
let ACTIVE_MEMBERS = [];  // cached active member list for dropdowns
let toastedLeadIds = new Set(); // session-only, avoid repeat toast spam

// ---------------- LOAD / SUBSCRIBE ----------------
async function loadLeadsView() {
  await refreshActiveMembers();
  buildLeadFilterUI();

  let query = leadsRef;
  if (CURRENT_USER.role === "member") {
    query = leadsRef.where("assignedTo", "==", CURRENT_USER.uid);
  }

  query.onSnapshot((snap) => {
    ALL_LEADS = [];
    snap.forEach((doc) => ALL_LEADS.push({ id: doc.id, ...doc.data() }));
    ALL_LEADS.sort((a, b) => (b.slNo || 0) - (a.slNo || 0));
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
  if (ACTIVE_MEMBERS.length === 0) {
    throw new Error("No active sales members exist. Add a member before creating leads.");
  }

  const counterDocRef = metaRef.doc("leadCounter");
  const roundRobinDocRef = metaRef.doc("roundRobin");
  const newLeadRef = leadsRef.doc();

  await db.runTransaction(async (t) => {
    const counterSnap = await t.get(counterDocRef);
    const rrSnap = await t.get(roundRobinDocRef);

    const nextSlNo = (counterSnap.exists ? counterSnap.data().count : 0) + 1;
    const lastIndex = rrSnap.exists ? rrSnap.data().lastIndex : -1;
    const newIndex = (lastIndex + 1) % ACTIVE_MEMBERS.length;
    const assignedMember = ACTIVE_MEMBERS[newIndex];

    const now = firebase.firestore.Timestamp.now();

    t.set(newLeadRef, {
      slNo: nextSlNo,
      serviceNeeded: formData.serviceNeeded,
      email: formData.email,
      fullName: formData.fullName,
      phoneNumber: formData.phoneNumber,
      companyName: formData.companyName,
      status: "Not Open",
      assignedTo: assignedMember.id,
      assignedToName: assignedMember.name || assignedMember.email,
      createdBy: CURRENT_USER.uid,
      createdByName: CURRENT_USER.name || CURRENT_USER.email,
      createdAt: now,
      lastContactedAt: null,
      nextFollowUpAt: null,
      history: [
        {
          text: "Lead created and auto-assigned to " + (assignedMember.name || assignedMember.email),
          statusAtTime: "Not Open",
          updatedBy: CURRENT_USER.uid,
          updatedByName: CURRENT_USER.name || CURRENT_USER.email,
          timestamp: new Date().toISOString()
        }
      ]
    });

    t.set(counterDocRef, { count: nextSlNo }, { merge: true });
    t.set(roundRobinDocRef, { lastIndex: newIndex }, { merge: true });
  });
}

// ---------------- UPDATE STATUS / NOTE (with history) ----------------
async function updateLeadStatus(leadId, newStatus, noteText) {
  const leadRef = leadsRef.doc(leadId);
  const now = firebase.firestore.Timestamp.now();

  let nextFollowUpAt = null;
  const reminderMinutes = STATUS_REMINDER_MINUTES[newStatus];
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
    return `
    <tr class="${uncontactedOverdue ? "row-urgent" : ""}">
      <td>${l.slNo}</td>
      <td>${formatDateTime(created)}</td>
      <td>${escapeHtml(l.fullName)}</td>
      <td>${escapeHtml(l.companyName || "-")}</td>
      <td>${escapeHtml(l.phoneNumber)}</td>
      <td>${escapeHtml(l.email || "-")}</td>
      <td>${escapeHtml(l.serviceNeeded || "-")}</td>
      <td>${escapeHtml(l.assignedToName || "-")}</td>
      <td><span class="status-badge ${STATUS_BADGE_CLASS[l.status] || ""}">${l.status}</span>
        ${uncontactedOverdue ? '<div class="small text-danger mt-1"><i class="bi bi-alarm"></i> Overdue</div>' : ""}
      </td>
      <td class="text-nowrap">
        <button class="btn btn-sm btn-primary" onclick="openStatusModal('${l.id}')"><i class="bi bi-pencil-square"></i> Update</button>
        <button class="btn btn-sm btn-outline-secondary" onclick="openHistoryModal('${l.id}')"><i class="bi bi-clock-history"></i></button>
        ${canEditDelete ? `<button class="btn btn-sm btn-outline-danger" onclick="confirmDeleteLead('${l.id}')"><i class="bi bi-trash"></i></button>` : ""}
      </td>
    </tr>`;
  }).join("");
}

function isUncontactedOverdue(lead) {
  if (lead.status !== "Not Open") return false;
  if (!lead.createdAt) return false;
  const created = lead.createdAt.toDate();
  const diffMin = (Date.now() - created.getTime()) / 60000;
  return diffMin >= UNCONTACTED_ALERT_MINUTES;
}

function isFollowUpDue(lead) {
  if (!lead.nextFollowUpAt) return false;
  return lead.nextFollowUpAt.toDate().getTime() <= Date.now();
}

// ---------------- URGENT ACTIONS (Admin / Super Admin) ----------------
function renderUrgentActions() {
  const container = document.getElementById("urgentActionsBody");
  if (!container) return;

  const urgent = ALL_LEADS.filter((l) => isUncontactedOverdue(l));
  if (urgent.length === 0) {
    container.innerHTML = `<p class="text-muted">No overdue leads right now. 🎉</p>`;
    return;
  }

  container.innerHTML = urgent.map((l) => {
    const created = l.createdAt.toDate();
    const overdueMin = Math.floor((Date.now() - created.getTime()) / 60000) - UNCONTACTED_ALERT_MINUTES;
    return `
    <div class="urgent-card">
      <div>
        <strong>${escapeHtml(l.fullName)}</strong> (${escapeHtml(l.companyName || "-")})
        <div class="small text-muted">Assigned to ${escapeHtml(l.assignedToName)} · Sl.No ${l.slNo}</div>
      </div>
      <span class="badge bg-danger">${overdueMin} min overdue</span>
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
  ALL_LEADS.forEach((l) => {
    const key = l.id + "_" + l.status;

    if (isUncontactedOverdue(l) && !toastedLeadIds.has(key)) {
      toastedLeadIds.add(key);
      if (CURRENT_USER.role === "member") {
        toast(`New lead waiting: ${l.fullName} — contact within 30 mins.`, "warning");
        browserNotify("Lead needs contact", `${l.fullName} — ${l.phoneNumber}`);
      } else {
        toast(`Overdue: ${l.fullName} assigned to ${l.assignedToName} not contacted in 30+ min.`, "danger");
      }
    }

    if (CURRENT_USER.role === "member" && isFollowUpDue(l) && !toastedLeadIds.has(key + "_followup")) {
      toastedLeadIds.add(key + "_followup");
      toast(`Follow-up due now: ${l.fullName} (${l.status}).`, "info");
      browserNotify("Follow-up due", `${l.fullName} — ${l.status}`);
    }
  });

  if (CURRENT_USER.role !== "member") {
    const urgentCount = ALL_LEADS.filter((l) => isUncontactedOverdue(l)).length;
    const badge = document.getElementById("urgentBadge");
    if (badge) {
      if (urgentCount > 0) {
        badge.textContent = urgentCount;
        badge.classList.remove("d-none");
      } else {
        badge.classList.add("d-none");
      }
    }
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
