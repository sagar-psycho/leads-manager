// ============================================================
// REPORT.JS — Daily lead report for Admin / Super Admin
// Generates a professional summary message with total leads
// and a full status breakdown for a chosen date.
// ============================================================

// Friendly order + labels for the report message (kept distinct from table badge order)
const REPORT_STATUS_ORDER = [
  "Interested",
  "Not Interested",
  "Driver",
  "Transporter",
  "Job Seeker",
  "Busy",
  "Not Picking Call",
  "Not Open"
];

const REPORT_STATUS_LABEL = {
  "Interested": "Interested",
  "Not Interested": "Not Interested",
  "Driver": "Drivers",
  "Transporter": "Transporters",
  "Job Seeker": "Job Seekers",
  "Busy": "Busy (call again)",
  "Not Picking Call": "Not Picking Call",
  "Not Open": "Pending / Not Contacted"
};

function initReportDatePicker() {
  const dateInput = document.getElementById("reportDate");
  if (dateInput && !dateInput.value) {
    const today = new Date();
    dateInput.value = today.toISOString().slice(0, 10); // YYYY-MM-DD, local-ish default
  }
}

function getLeadsForReportDate() {
  const dateInput = document.getElementById("reportDate");
  initReportDatePicker();
  const selected = dateInput.value; // "YYYY-MM-DD"

  return ALL_LEADS.filter((l) => {
    if (!l.createdAt) return false;
    const created = l.createdAt.toDate();
    const y = created.getFullYear();
    const m = String(created.getMonth() + 1).padStart(2, "0");
    const d = String(created.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}` === selected;
  });
}

function computeStatusCounts(leads) {
  const counts = {};
  REPORT_STATUS_ORDER.forEach((s) => (counts[s] = 0));
  leads.forEach((l) => {
    if (counts[l.status] !== undefined) counts[l.status]++;
    else counts[l.status] = (counts[l.status] || 0) + 1;
  });
  return counts;
}

function renderDailyReport() {
  initReportDatePicker();
  const grid = document.getElementById("reportStatsGrid");
  const box = document.getElementById("reportMessageBox");
  if (!grid || !box) return;

  const leads = getLeadsForReportDate();
  const counts = computeStatusCounts(leads);
  const total = leads.length;

  // ---- Stat cards ----
  grid.innerHTML = `
    <div class="col-6 col-md-3">
      <div class="report-stat-card report-stat-total">
        <div class="report-stat-value">${total}</div>
        <div class="report-stat-label">Total Leads</div>
      </div>
    </div>
    ${REPORT_STATUS_ORDER.map((s) => `
      <div class="col-6 col-md-3">
        <div class="report-stat-card">
          <div class="report-stat-value">${counts[s] || 0}</div>
          <div class="report-stat-label">${REPORT_STATUS_LABEL[s]}</div>
        </div>
      </div>`).join("")}
  `;

  // ---- Message text ----
  box.textContent = buildReportMessage(leads, counts, total);
}

function buildReportMessage(leads, counts, total) {
  const dateInput = document.getElementById("reportDate");
  const managerName = (document.getElementById("reportManagerName")?.value || "Team").trim();
  const dateObj = new Date(dateInput.value + "T00:00:00");
  const dateLabel = dateObj.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

  const lines = [];
  lines.push(`Hi ${managerName}, here is today's lead summary for Abra Logistics (${dateLabel}):`);
  lines.push("");
  lines.push(`Total leads received: ${total}`);
  lines.push("");

  REPORT_STATUS_ORDER.forEach((s) => {
    lines.push(`${REPORT_STATUS_LABEL[s]}: ${counts[s] || 0}`);
  });

  lines.push("");
  const pendingCount = counts["Not Open"] || 0;
  if (pendingCount > 0) {
    lines.push(`Note: ${pendingCount} lead(s) are still pending first contact — following up shortly.`);
  } else {
    lines.push("All leads received today have been contacted at least once.");
  }
  lines.push("");
  lines.push("Regards,");
  lines.push(CURRENT_USER?.name || "Abra Logistics Sales Team");

  return lines.join("\n");
}

function copyReportMessage() {
  const box = document.getElementById("reportMessageBox");
  if (!box) return;
  navigator.clipboard.writeText(box.textContent).then(
    () => toast("Report copied to clipboard.", "success"),
    () => toast("Could not copy — please select and copy manually.", "danger")
  );
}

function shareReportOnWhatsApp() {
  const box = document.getElementById("reportMessageBox");
  if (!box) return;
  const encoded = encodeURIComponent(box.textContent);
  window.open(`https://wa.me/?text=${encoded}`, "_blank");
}