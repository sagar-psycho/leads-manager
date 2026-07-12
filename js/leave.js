// ============================================================
// LEAVE.JS — Employee Leave Management
// Super Admin + Admin: full CRUD
// Member: view own leaves only
// ============================================================

const LEAVE_TYPES = [
  "Full Day",
  "Half Day Morning",
  "Half Day Afternoon",
  "Work From Home",
  "Emergency Leave",
  "Sick Leave"
];

let ALL_LEAVES = [];       // cached for the leave view
let ALL_USERS_LIST = [];   // for the member dropdown

// ── Subscribe to leaves (real-time) ──────────────────────────
function loadLeaveView() {
  const wrap = document.getElementById("view-leave");
  if (!wrap) return;

  let query = leavesRef.orderBy("date", "desc");
  if (CURRENT_USER.role === "member") {
    query = leavesRef
      .where("memberId", "==", CURRENT_USER.uid)
      .orderBy("date", "desc");
  }

  query.onSnapshot(snap => {
    ALL_LEAVES = [];
    snap.forEach(d => ALL_LEAVES.push({ id: d.id, ...d.data() }));
    renderLeaveView();
  }, err => console.error("Leave snapshot error:", err));
}

// ── Render Leave page ─────────────────────────────────────────
async function renderLeaveView() {
  const wrap = document.getElementById("view-leave");
  if (!wrap) return;

  const isSA = CURRENT_USER.role === "superadmin";
  const isAdmin = CURRENT_USER.role === "admin";
  const canManage = isSA || isAdmin;

  // Pre-fetch users for dropdown (admins/superadmins need this)
  if (canManage && ALL_USERS_LIST.length === 0) {
    const snap = await usersRef.where("active", "==", true).get();
    ALL_USERS_LIST = [];
    snap.forEach(d => ALL_USERS_LIST.push({ id: d.id, ...d.data() }));
  }

  const memberOpts = ALL_USERS_LIST
    .filter(u => u.role === "member")
    .map(u => `<option value="${u.id}">${escapeHtml(u.name || u.email)}</option>`)
    .join("");

  wrap.innerHTML = `
  <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
    <div>
      <h1 class="page-title"><i class="bi bi-calendar2-check me-2"></i>Leave Management</h1>
      <p class="page-subtitle">${canManage ? "Manage team leave requests." : "Your leave history."}</p>
    </div>
    ${canManage ? `
    <button class="btn btn-brand" data-bs-toggle="modal" data-bs-target="#addLeaveModal">
      <i class="bi bi-plus-lg me-1"></i>Add Leave
    </button>` : ""}
  </div>

  <div class="table-card">
    <div class="table-responsive">
      <table class="table align-middle table-hover mb-0">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Date</th>
            <th>Type</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Approved By</th>
            ${canManage ? "<th>Actions</th>" : ""}
          </tr>
        </thead>
        <tbody>
          ${ALL_LEAVES.length === 0
            ? `<tr><td colspan="7" class="text-center py-4 text-muted">No leave records found.</td></tr>`
            : ALL_LEAVES.map(l => `
          <tr>
            <td>${escapeHtml(l.memberName || "—")}</td>
            <td>${l.date || "—"}</td>
            <td><span class="badge bg-secondary">${escapeHtml(l.leaveType || "—")}</span></td>
            <td>${escapeHtml(l.reason || "—")}</td>
            <td>
              <span class="leave-status-badge leave-${(l.status||"pending").toLowerCase()}">
                ${l.status || "Pending"}
              </span>
            </td>
            <td>${escapeHtml(l.approvedByName || "—")}</td>
            ${canManage ? `
            <td class="text-nowrap">
              ${l.status === "Pending" ? `
              <button class="btn btn-sm btn-success" onclick="approveLeave('${l.id}')">Approve</button>
              <button class="btn btn-sm btn-outline-danger" onclick="rejectLeave('${l.id}')">Reject</button>` : ""}
              <button class="btn btn-sm btn-outline-danger" onclick="deleteLeave('${l.id}')">
                <i class="bi bi-trash"></i>
              </button>
            </td>` : ""}
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Add Leave Modal -->
  <div class="modal fade" id="addLeaveModal" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <form id="addLeaveForm" onsubmit="submitLeave(event)">
          <div class="modal-header">
            <h5 class="modal-title">Add Leave</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            ${canManage ? `
            <div class="mb-3">
              <label class="form-label">Employee</label>
              <select id="leaveEmployee" class="form-select" required>
                <option value="">Select employee…</option>
                ${memberOpts}
              </select>
            </div>` : ""}
            <div class="mb-3">
              <label class="form-label">Leave Date</label>
              <input type="date" id="leaveDate" class="form-control" required
                     value="${new Date().toISOString().slice(0,10)}">
            </div>
            <div class="mb-3">
              <label class="form-label">Leave Type</label>
              <select id="leaveType" class="form-select" required>
                ${LEAVE_TYPES.map(t => `<option>${t}</option>`).join("")}
              </select>
            </div>
            <div class="mb-3">
              <label class="form-label">Reason</label>
              <textarea id="leaveReason" class="form-control" rows="2"
                        placeholder="Brief reason…"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="submit" class="btn btn-brand">Save Leave</button>
          </div>
        </form>
      </div>
    </div>
  </div>`;
}

async function submitLeave(e) {
  e.preventDefault();
  const isSA = CURRENT_USER.role === "superadmin";
  const isAdmin = CURRENT_USER.role === "admin";
  const canManage = isSA || isAdmin;

  let memberId   = CURRENT_USER.uid;
  let memberName = CURRENT_USER.name || CURRENT_USER.email;

  if (canManage) {
    const sel = document.getElementById("leaveEmployee");
    memberId = sel?.value;
    if (!memberId) { toast("Select an employee.", "warning"); return; }
    const user = ALL_USERS_LIST.find(u => u.id === memberId);
    memberName = user ? (user.name || user.email) : "Unknown";
  }

  const date      = document.getElementById("leaveDate")?.value;
  const leaveType = document.getElementById("leaveType")?.value;
  const reason    = document.getElementById("leaveReason")?.value?.trim() || "";

  try {
    await leavesRef.add({
      memberId,
      memberName,
      date,
      leaveType,
      reason,
      status:         canManage ? "Approved" : "Pending",
      approvedBy:     canManage ? CURRENT_USER.uid : null,
      approvedByName: canManage ? (CURRENT_USER.name || CURRENT_USER.email) : null,
      createdAt:      firebase.firestore.Timestamp.now(),
      createdBy:      CURRENT_USER.uid
    });

    const modal = bootstrap.Modal.getInstance(document.getElementById("addLeaveModal"));
    modal?.hide();
    toast(`Leave ${canManage ? "approved" : "submitted"} for ${memberName}.`, "success");
  } catch (err) {
    console.error(err);
    toast("Failed to save leave.", "danger");
  }
}

async function approveLeave(id) {
  await leavesRef.doc(id).update({
    status:         "Approved",
    approvedBy:     CURRENT_USER.uid,
    approvedByName: CURRENT_USER.name || CURRENT_USER.email
  });
  toast("Leave approved.", "success");
}

async function rejectLeave(id) {
  await leavesRef.doc(id).update({ status: "Rejected" });
  toast("Leave rejected.", "success");
}

async function deleteLeave(id) {
  if (!confirm("Delete this leave record?")) return;
  await leavesRef.doc(id).delete();
  toast("Leave deleted.", "success");
}

// ── Holiday welcome popup ─────────────────────────────────────
async function checkHolidayWelcome() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);

  const wasHoliday = (CRM_CONFIG.holidays || []).some(h => {
    if (!h.date) return false;
    return h.recurring ? h.date.slice(5) === yStr.slice(5) : h.date === yStr;
  });

  if (!wasHoliday) return;

  const seenKey = `holidayWelcome_${yStr}_${CURRENT_USER.uid}`;
  if (sessionStorage.getItem(seenKey)) return;
  sessionStorage.setItem(seenKey, "1");

  const holName = (CRM_CONFIG.holidays || []).find(h =>
    h.recurring ? h.date?.slice(5) === yStr.slice(5) : h.date === yStr
  )?.name || "holiday";

  const modal = bootstrap.Modal.getOrCreateInstance(
    document.getElementById("holidayWelcomeModal")
  );
  document.getElementById("holidayWelcomeBody").innerHTML = `
    <div class="text-center py-2">
      <div style="font-size:3rem">🎉</div>
      <p class="mt-3 mb-0" style="font-size:15px;line-height:1.7">
        Hey <strong>${escapeHtml(CURRENT_USER.name || CURRENT_USER.email)}</strong>,<br>
        I hope you enjoyed your holiday yesterday (<em>${escapeHtml(holName)}</em>).<br>
        Let's focus on today's leads and give our customers the best experience.<br>
        Some customers have been waiting for your call.<br><br>
        <strong>Have a productive day! 🚀</strong>
      </p>
    </div>`;
  modal.show();
}
