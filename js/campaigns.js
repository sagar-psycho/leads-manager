// ============================================================
// CAMPAIGNS.JS — Campaign Form Builder
//
// Super Admin only: create/edit/delete/activate campaigns and
// build custom lead-capture fields per campaign (no code changes,
// no JSON config files — everything is done through the CRM UI
// and stored in Firestore).
//
// Collections:
//   campaigns/{campaignId}       { name, active, createdAt, updatedAt, createdBy }
//   campaignFields/{fieldId}     { campaignId, fieldLabel, fieldType, required,
//                                  placeholder, options[], displayOrder,
//                                  helpText, defaultValue }
//
// Leads gain: campaignId, campaignName, campaignData { fieldId: value },
// and campaignFieldsMeta [{ id, label, type }] — a SNAPSHOT of the field
// labels/types at the moment the lead was created, so later edits to a
// campaign's form never change how an existing lead's data is displayed.
// ============================================================

const campaignsRef      = db.collection("campaigns");
const campaignFieldsRef = db.collection("campaignFields");

const FIELD_TYPES = [
  { value: "text",     label: "Text" },
  { value: "textarea", label: "Textarea" },
  { value: "dropdown", label: "Dropdown" },
  { value: "number",   label: "Number" },
  { value: "date",     label: "Date" },
  { value: "time",     label: "Time" },
  { value: "radio",    label: "Radio" },
  { value: "checkbox", label: "Checkbox" },
  { value: "phone",    label: "Phone" },
  { value: "email",    label: "Email" },
  { value: "url",      label: "URL" }
];

const FIELD_TYPES_WITH_OPTIONS = ["dropdown", "radio", "checkbox"];

let ALL_CAMPAIGNS = [];              // cached campaigns (all — active + inactive)
let CAMPAIGN_FIELDS_CACHE = {};      // campaignId -> [field, ...] ordered by displayOrder
let _builderCampaignId = null;       // campaign currently open in the Field Builder modal
let _builderRows = [];               // in-memory working copy of fields while builder is open
let _builderRowSeq = 0;              // counter for temp client-side row ids

// ── Bootstrapping ──────────────────────────────────────────────
function subscribeCampaigns() {
  campaignsRef.orderBy("createdAt", "asc").onSnapshot((snap) => {
    ALL_CAMPAIGNS = [];
    snap.forEach((d) => ALL_CAMPAIGNS.push({ id: d.id, ...d.data() }));

    const view = document.getElementById("view-campaigns");
    if (view && !view.classList.contains("d-none")) renderCampaignsView();

    refreshLeadCampaignDropdown();
  }, (err) => console.error("Campaigns snapshot error:", err));

  campaignFieldsRef.orderBy("displayOrder", "asc").onSnapshot((snap) => {
    CAMPAIGN_FIELDS_CACHE = {};
    snap.forEach((d) => {
      const f = { id: d.id, ...d.data() };
      if (!CAMPAIGN_FIELDS_CACHE[f.campaignId]) CAMPAIGN_FIELDS_CACHE[f.campaignId] = [];
      CAMPAIGN_FIELDS_CACHE[f.campaignId].push(f);
    });

    // If the Add Lead form currently has a campaign selected, re-render its fields
    const sel = document.getElementById("leadCampaign");
    if (sel && sel.value && sel.value !== "__none__") {
      renderCampaignFieldsInAddLead(sel.value);
    }
  }, (err) => console.error("Campaign fields snapshot error:", err));
}

// ============================================================
// CAMPAIGN MANAGEMENT VIEW (Super Admin only — sidebar "Campaign Form Builder")
// ============================================================
function renderCampaignsView() {
  const wrap = document.getElementById("view-campaigns");
  if (!wrap) return;

  wrap.innerHTML = `
  <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
    <div>
      <h1 class="page-title"><i class="bi bi-columns-gap me-2"></i>Campaign Form Builder</h1>
      <p class="page-subtitle">Create campaign lead forms — Admins select a campaign when adding a lead, no code changes needed.</p>
    </div>
    <button class="btn btn-brand" onclick="openCampaignModal()">
      <i class="bi bi-plus-lg me-1"></i>Create Campaign
    </button>
  </div>

  ${ALL_CAMPAIGNS.length === 0 ? `
  <div class="table-card p-4 text-center text-muted">
    No campaigns yet. Click "Create Campaign" to add your first one — e.g. Freight Services, Warehousing, Sea Freight…
  </div>` : `
  <div class="table-card">
    <div class="table-responsive">
      <table class="table align-middle table-hover mb-0">
        <thead>
          <tr>
            <th>Campaign Name</th>
            <th>Fields</th>
            <th>Status</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${ALL_CAMPAIGNS.map((c) => {
            const fieldCount = (CAMPAIGN_FIELDS_CACHE[c.id] || []).length;
            const created = c.createdAt ? formatDateTime(c.createdAt.toDate()) : "—";
            return `
          <tr>
            <td class="fw-semibold">${escapeHtml(c.name)}</td>
            <td>${fieldCount} field${fieldCount === 1 ? "" : "s"}</td>
            <td>${c.active === false
              ? '<span class="badge bg-danger">Inactive</span>'
              : '<span class="badge bg-success">Active</span>'}</td>
            <td class="text-nowrap">${created}</td>
            <td class="text-nowrap">
              <button class="btn btn-sm btn-outline-primary" onclick="openFieldBuilderModal('${c.id}')">
                <i class="bi bi-ui-checks-grid"></i> Manage Fields
              </button>
              <button class="btn btn-sm btn-outline-secondary" onclick="openCampaignModal('${c.id}')">
                <i class="bi bi-pencil-square"></i>
              </button>
              <button class="btn btn-sm ${c.active === false ? "btn-outline-success" : "btn-outline-warning"}"
                onclick="toggleCampaignActive('${c.id}', ${c.active === false})">
                ${c.active === false ? "Activate" : "Deactivate"}
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="confirmDeleteCampaign('${c.id}')">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  </div>`}`;
}

// ── Create / Edit Campaign ───────────────────────────────────
function openCampaignModal(campaignId) {
  const c = campaignId ? ALL_CAMPAIGNS.find((x) => x.id === campaignId) : null;
  document.getElementById("campaignModalTitle").textContent = c ? "Edit Campaign" : "Create Campaign";
  document.getElementById("campaignId").value = c ? c.id : "";
  document.getElementById("campaignName").value = c ? c.name : "";
  document.getElementById("campaignActive").checked = c ? c.active !== false : true;
  new bootstrap.Modal(document.getElementById("campaignModal")).show();
}

async function saveCampaign() {
  const id = document.getElementById("campaignId").value;
  const name = document.getElementById("campaignName").value.trim();
  const active = document.getElementById("campaignActive").checked;

  if (!name) { toast("Campaign name is required.", "warning"); return; }

  try {
    if (id) {
      await campaignsRef.doc(id).update({
        name, active, updatedAt: firebase.firestore.Timestamp.now()
      });
      toast("Campaign updated.", "success");
    } else {
      await campaignsRef.add({
        name, active,
        createdAt: firebase.firestore.Timestamp.now(),
        updatedAt: firebase.firestore.Timestamp.now(),
        createdBy: CURRENT_USER.uid
      });
      toast("Campaign created.", "success");
    }
    bootstrap.Modal.getInstance(document.getElementById("campaignModal"))?.hide();
  } catch (err) {
    console.error(err);
    toast("Failed to save campaign.", "danger");
  }
}

async function toggleCampaignActive(id, makeActive) {
  try {
    await campaignsRef.doc(id).update({ active: makeActive, updatedAt: firebase.firestore.Timestamp.now() });
    toast(makeActive ? "Campaign activated." : "Campaign deactivated.", "success");
  } catch (err) {
    console.error(err);
    toast("Failed to update campaign status.", "danger");
  }
}

function confirmDeleteCampaign(id) {
  const c = ALL_CAMPAIGNS.find((x) => x.id === id);
  if (!c) return;
  if (!confirm(`Delete campaign "${c.name}"? Its field definitions will also be removed. Leads already created with this campaign keep their data.`)) return;

  (async () => {
    try {
      const batch = db.batch();
      batch.delete(campaignsRef.doc(id));
      (CAMPAIGN_FIELDS_CACHE[id] || []).forEach((f) => batch.delete(campaignFieldsRef.doc(f.id)));
      await batch.commit();
      toast("Campaign deleted.", "success");
    } catch (err) {
      console.error(err);
      toast("Failed to delete campaign.", "danger");
    }
  })();
}

// ============================================================
// FIELD BUILDER MODAL
// ============================================================
function openFieldBuilderModal(campaignId) {
  const c = ALL_CAMPAIGNS.find((x) => x.id === campaignId);
  if (!c) return;

  _builderCampaignId = campaignId;
  _builderRows = (CAMPAIGN_FIELDS_CACHE[campaignId] || [])
    .slice()
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
    .map((f) => ({ ...f, _rowId: f.id }));

  document.getElementById("fieldBuilderModalTitle").textContent = `Form Fields — ${c.name}`;
  renderFieldBuilderRows();
  new bootstrap.Modal(document.getElementById("fieldBuilderModal")).show();
}

function renderFieldBuilderRows() {
  const wrap = document.getElementById("fieldBuilderRows");
  if (!wrap) return;

  if (_builderRows.length === 0) {
    wrap.innerHTML = `<p class="text-muted small mb-2">No fields yet. Click "Add Field" below to create the first one.</p>`;
    return;
  }

  wrap.innerHTML = _builderRows.map((f, idx) => `
    <div class="field-builder-row" data-rowid="${f._rowId}">
      <div class="field-builder-row-head">
        <span class="field-builder-index">#${idx + 1}</span>
        <div class="field-builder-row-actions">
          <button type="button" class="btn btn-sm btn-outline-secondary" title="Move up"
            ${idx === 0 ? "disabled" : ""} onclick="moveFieldRow('${f._rowId}', -1)">
            <i class="bi bi-arrow-up"></i>
          </button>
          <button type="button" class="btn btn-sm btn-outline-secondary" title="Move down"
            ${idx === _builderRows.length - 1 ? "disabled" : ""} onclick="moveFieldRow('${f._rowId}', 1)">
            <i class="bi bi-arrow-down"></i>
          </button>
          <button type="button" class="btn btn-sm btn-outline-danger" title="Delete field" onclick="deleteFieldRow('${f._rowId}')">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>

      <div class="row g-2">
        <div class="col-md-6">
          <label class="form-label small mb-1">Field Label</label>
          <input type="text" class="form-control form-control-sm fb-label" value="${escapeHtml(f.fieldLabel || "")}" placeholder="e.g. Shipment Type">
        </div>
        <div class="col-md-6">
          <label class="form-label small mb-1">Field Type</label>
          <select class="form-select form-select-sm fb-type" onchange="_onFieldTypeChange('${f._rowId}', this.value)">
            ${FIELD_TYPES.map((t) => `<option value="${t.value}" ${t.value === f.fieldType ? "selected" : ""}>${t.label}</option>`).join("")}
          </select>
        </div>
        <div class="col-md-6">
          <label class="form-label small mb-1">Placeholder</label>
          <input type="text" class="form-control form-control-sm fb-placeholder" value="${escapeHtml(f.placeholder || "")}">
        </div>
        <div class="col-md-6">
          <label class="form-label small mb-1">Default Value</label>
          <input type="text" class="form-control form-control-sm fb-default" value="${escapeHtml(f.defaultValue || "")}">
        </div>
        <div class="col-12 fb-options-wrap" style="${FIELD_TYPES_WITH_OPTIONS.includes(f.fieldType) ? "" : "display:none;"}">
          <label class="form-label small mb-1">Options (comma separated)</label>
          <input type="text" class="form-control form-control-sm fb-options"
            value="${escapeHtml((f.options || []).join(", "))}" placeholder="e.g. FTL, LTL, Container">
        </div>
        <div class="col-12">
          <label class="form-label small mb-1">Help Text</label>
          <input type="text" class="form-control form-control-sm fb-help" value="${escapeHtml(f.helpText || "")}" placeholder="Shown under the field to guide the Admin">
        </div>
        <div class="col-12">
          <div class="form-check">
            <input class="form-check-input fb-required" type="checkbox" ${f.required ? "checked" : ""} id="fbReq_${f._rowId}">
            <label class="form-check-label small" for="fbReq_${f._rowId}">Required</label>
          </div>
        </div>
      </div>
    </div>`).join("");
}

function _onFieldTypeChange(rowId, newType) {
  const row = document.querySelector(`.field-builder-row[data-rowid="${rowId}"]`);
  if (!row) return;
  const optWrap = row.querySelector(".fb-options-wrap");
  if (optWrap) optWrap.style.display = FIELD_TYPES_WITH_OPTIONS.includes(newType) ? "" : "none";
}

function addFieldRow() {
  _builderRowSeq++;
  _builderRows.push({
    _rowId: "_new_" + Date.now() + "_" + _builderRowSeq,
    campaignId: _builderCampaignId,
    fieldLabel: "",
    fieldType: "text",
    required: false,
    placeholder: "",
    options: [],
    helpText: "",
    defaultValue: ""
  });
  renderFieldBuilderRows();
}

function moveFieldRow(rowId, dir) {
  _syncBuilderRowsFromDOM();
  const idx = _builderRows.findIndex((f) => f._rowId === rowId);
  const target = idx + dir;
  if (idx < 0 || target < 0 || target >= _builderRows.length) return;
  const tmp = _builderRows[idx];
  _builderRows[idx] = _builderRows[target];
  _builderRows[target] = tmp;
  renderFieldBuilderRows();
}

function deleteFieldRow(rowId) {
  _syncBuilderRowsFromDOM();
  _builderRows = _builderRows.filter((f) => f._rowId !== rowId);
  renderFieldBuilderRows();
}

// Reads current DOM input values back into _builderRows before reordering/deleting
// so in-progress edits aren't lost.
function _syncBuilderRowsFromDOM() {
  document.querySelectorAll("#fieldBuilderRows .field-builder-row").forEach((rowEl) => {
    const rowId = rowEl.dataset.rowid;
    const f = _builderRows.find((x) => x._rowId === rowId);
    if (!f) return;
    f.fieldLabel   = rowEl.querySelector(".fb-label")?.value.trim() || "";
    f.fieldType    = rowEl.querySelector(".fb-type")?.value || "text";
    f.placeholder  = rowEl.querySelector(".fb-placeholder")?.value.trim() || "";
    f.defaultValue = rowEl.querySelector(".fb-default")?.value.trim() || "";
    f.helpText     = rowEl.querySelector(".fb-help")?.value.trim() || "";
    f.required     = rowEl.querySelector(".fb-required")?.checked || false;
    const optsRaw  = rowEl.querySelector(".fb-options")?.value || "";
    f.options      = optsRaw.split(",").map((o) => o.trim()).filter(Boolean);
  });
}

async function saveFieldBuilder() {
  _syncBuilderRowsFromDOM();

  // Basic validation
  for (const f of _builderRows) {
    if (!f.fieldLabel) { toast("Every field needs a label.", "warning"); return; }
    if (FIELD_TYPES_WITH_OPTIONS.includes(f.fieldType) && f.options.length === 0) {
      toast(`"${f.fieldLabel}" needs at least one option.`, "warning");
      return;
    }
  }

  const originalIds = (CAMPAIGN_FIELDS_CACHE[_builderCampaignId] || []).map((f) => f.id);
  const keptIds = _builderRows.filter((f) => !String(f._rowId).startsWith("_new_")).map((f) => f._rowId);
  const removedIds = originalIds.filter((id) => !keptIds.includes(id));

  try {
    const batch = db.batch();

    _builderRows.forEach((f, idx) => {
      const payload = {
        campaignId:   _builderCampaignId,
        fieldLabel:   f.fieldLabel,
        fieldType:    f.fieldType,
        required:     !!f.required,
        placeholder:  f.placeholder || "",
        options:      FIELD_TYPES_WITH_OPTIONS.includes(f.fieldType) ? f.options : [],
        displayOrder: idx,
        helpText:     f.helpText || "",
        defaultValue: f.defaultValue || ""
      };
      if (String(f._rowId).startsWith("_new_")) {
        batch.set(campaignFieldsRef.doc(), payload);
      } else {
        batch.update(campaignFieldsRef.doc(f._rowId), payload);
      }
    });

    removedIds.forEach((id) => batch.delete(campaignFieldsRef.doc(id)));

    await batch.commit();
    toast("Campaign form fields saved.", "success");
    bootstrap.Modal.getInstance(document.getElementById("fieldBuilderModal"))?.hide();
  } catch (err) {
    console.error(err);
    toast("Failed to save fields.", "danger");
  }
}

// ============================================================
// ADD LEAD — Campaign selection & dynamic field rendering
// ============================================================
function refreshLeadCampaignDropdown() {
  const sel = document.getElementById("leadCampaign");
  if (!sel) return;
  const current = sel.value;

  const activeCampaigns = ALL_CAMPAIGNS.filter((c) => c.active !== false);
  sel.innerHTML = `
    <option value="">Select Campaign…</option>
    <option value="__none__">General / No Campaign</option>
    ${activeCampaigns.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")}
  `;
  if (current && [...sel.options].some((o) => o.value === current)) sel.value = current;
}

function onLeadCampaignChange() {
  const sel = document.getElementById("leadCampaign");
  const legacyService = document.getElementById("legacyServiceWrap");
  const legacyCompany = document.getElementById("legacyCompanyWrap");
  const campaignFieldsContainer = document.getElementById("campaignFieldsContainer");
  if (!sel) return;

  const val = sel.value;

  if (!val) {
    campaignFieldsContainer.innerHTML = "";
    return;
  }

  if (val === "__none__") {
    // Legacy path — plain lead, no campaign-specific fields
    if (legacyService) legacyService.classList.remove("d-none");
    if (legacyCompany) legacyCompany.classList.remove("d-none");
    campaignFieldsContainer.innerHTML = "";
    return;
  }

  // A real campaign is selected — hide legacy fields, show campaign fields instantly
  if (legacyService) legacyService.classList.add("d-none");
  if (legacyCompany) legacyCompany.classList.add("d-none");
  renderCampaignFieldsInAddLead(val);
}

function renderCampaignFieldsInAddLead(campaignId) {
  const container = document.getElementById("campaignFieldsContainer");
  if (!container) return;

  const fields = (CAMPAIGN_FIELDS_CACHE[campaignId] || []).slice().sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

  if (fields.length === 0) {
    container.innerHTML = `<p class="text-muted small">This campaign has no custom fields yet.</p>`;
    return;
  }

  container.innerHTML = `<hr class="my-3"><p class="small fw-semibold text-muted mb-2">Campaign Details</p>` +
    fields.map((f) => `<div class="mb-3">${_renderLeadFieldInput(f)}</div>`).join("");
}

function _renderLeadFieldInput(f) {
  const req = f.required ? "required" : "";
  const label = `<label class="form-label">${escapeHtml(f.fieldLabel)}${f.required ? ' <span class="text-danger">*</span>' : ""}</label>`;
  const help = f.helpText ? `<div class="form-text">${escapeHtml(f.helpText)}</div>` : "";
  const id = `cf_${f.id}`;

  switch (f.fieldType) {
    case "textarea":
      return `${label}<textarea class="form-control cf-input" id="${id}" data-fieldid="${f.id}" rows="2" placeholder="${escapeHtml(f.placeholder || "")}" ${req}>${escapeHtml(f.defaultValue || "")}</textarea>${help}`;

    case "dropdown":
      return `${label}<select class="form-select cf-input" id="${id}" data-fieldid="${f.id}" ${req}>
        <option value="">${escapeHtml(f.placeholder || "Select…")}</option>
        ${(f.options || []).map((o) => `<option value="${escapeHtml(o)}" ${o === f.defaultValue ? "selected" : ""}>${escapeHtml(o)}</option>`).join("")}
      </select>${help}`;

    case "radio":
      return `${label}<div class="cf-input" id="${id}" data-fieldid="${f.id}" data-fieldtype="radio">
        ${(f.options || []).map((o, i) => `
        <div class="form-check">
          <input class="form-check-input cf-radio-${f.id}" type="radio" name="cf_radio_${f.id}" value="${escapeHtml(o)}" id="${id}_${i}" ${o === f.defaultValue ? "checked" : ""}>
          <label class="form-check-label" for="${id}_${i}">${escapeHtml(o)}</label>
        </div>`).join("")}
      </div>${help}`;

    case "checkbox":
      return `${label}<div class="cf-input" id="${id}" data-fieldid="${f.id}" data-fieldtype="checkbox">
        ${(f.options || []).map((o, i) => `
        <div class="form-check">
          <input class="form-check-input cf-checkbox-${f.id}" type="checkbox" value="${escapeHtml(o)}" id="${id}_${i}">
          <label class="form-check-label" for="${id}_${i}">${escapeHtml(o)}</label>
        </div>`).join("")}
      </div>${help}`;

    case "number":
      return `${label}<input type="number" class="form-control cf-input" id="${id}" data-fieldid="${f.id}" placeholder="${escapeHtml(f.placeholder || "")}" value="${escapeHtml(f.defaultValue || "")}" ${req}>${help}`;
    case "date":
      return `${label}<input type="date" class="form-control cf-input" id="${id}" data-fieldid="${f.id}" value="${escapeHtml(f.defaultValue || "")}" ${req}>${help}`;
    case "time":
      return `${label}<input type="time" class="form-control cf-input" id="${id}" data-fieldid="${f.id}" value="${escapeHtml(f.defaultValue || "")}" ${req}>${help}`;
    case "phone":
      return `${label}<input type="tel" class="form-control cf-input" id="${id}" data-fieldid="${f.id}" placeholder="${escapeHtml(f.placeholder || "")}" value="${escapeHtml(f.defaultValue || "")}" ${req}>${help}`;
    case "email":
      return `${label}<input type="email" class="form-control cf-input" id="${id}" data-fieldid="${f.id}" placeholder="${escapeHtml(f.placeholder || "")}" value="${escapeHtml(f.defaultValue || "")}" ${req}>${help}`;
    case "url":
      return `${label}<input type="url" class="form-control cf-input" id="${id}" data-fieldid="${f.id}" placeholder="${escapeHtml(f.placeholder || "")}" value="${escapeHtml(f.defaultValue || "")}" ${req}>${help}`;

    case "text":
    default:
      return `${label}<input type="text" class="form-control cf-input" id="${id}" data-fieldid="${f.id}" placeholder="${escapeHtml(f.placeholder || "")}" value="${escapeHtml(f.defaultValue || "")}" ${req}>${help}`;
  }
}

// Collects { campaignId, campaignName, campaignData, campaignFieldsMeta } from the
// currently open Add Lead form. Throws with a user-facing message if a required
// campaign field is missing. Returns null for the legacy / no-campaign path.
function collectCampaignDataFromAddLeadForm() {
  const sel = document.getElementById("leadCampaign");
  if (!sel || !sel.value || sel.value === "__none__") return null;

  const campaignId = sel.value;
  const campaign = ALL_CAMPAIGNS.find((c) => c.id === campaignId);
  const fields = (CAMPAIGN_FIELDS_CACHE[campaignId] || []).slice().sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

  const campaignData = {};
  const campaignFieldsMeta = [];

  for (const f of fields) {
    campaignFieldsMeta.push({ id: f.id, label: f.fieldLabel, type: f.fieldType });

    let value;
    if (f.fieldType === "checkbox") {
      value = Array.from(document.querySelectorAll(`.cf-checkbox-${f.id}:checked`)).map((el) => el.value);
    } else if (f.fieldType === "radio") {
      const checked = document.querySelector(`.cf-radio-${f.id}:checked`);
      value = checked ? checked.value : "";
    } else {
      const el = document.getElementById(`cf_${f.id}`);
      value = el ? el.value.trim() : "";
    }

    if (f.required) {
      const isEmpty = Array.isArray(value) ? value.length === 0 : !value;
      if (isEmpty) throw new Error(`"${f.fieldLabel}" is required.`);
    }

    campaignData[f.id] = value;
  }

  return {
    campaignId,
    campaignName: campaign ? campaign.name : "",
    campaignData,
    campaignFieldsMeta
  };
}

function resetAddLeadCampaignUI() {
  const sel = document.getElementById("leadCampaign");
  const legacyService = document.getElementById("legacyServiceWrap");
  const legacyCompany = document.getElementById("legacyCompanyWrap");
  const container = document.getElementById("campaignFieldsContainer");
  if (sel) sel.value = "";
  if (legacyService) legacyService.classList.remove("d-none");
  if (legacyCompany) legacyCompany.classList.remove("d-none");
  if (container) container.innerHTML = "";
}

document.addEventListener("DOMContentLoaded", () => {
  const addLeadModalEl = document.getElementById("addLeadModal");
  if (addLeadModalEl) {
    addLeadModalEl.addEventListener("hidden.bs.modal", resetAddLeadCampaignUI);
  }
});

// ============================================================
// LEAD DETAILS MODAL (👁 View) — label:value layout
// ============================================================
function openLeadDetailsModal(leadId) {
  const lead = ALL_LEADS.find((l) => l.id === leadId);
  if (!lead) return;

  const rows = [];
  rows.push(["Campaign Type", lead.campaignName || "General / No Campaign"]);
  rows.push("divider");
  rows.push(["Full Name", lead.fullName || "—"]);
  rows.push(["Mobile Number", lead.phoneNumber || "—"]);
  rows.push(["Email", lead.email || "—"]);

  const meta = lead.campaignFieldsMeta || [];
  if (meta.length > 0) {
    rows.push("divider");
    rows.push("__campaign_header__");
    meta.forEach((m) => {
      let val = lead.campaignData ? lead.campaignData[m.id] : undefined;
      if (Array.isArray(val)) val = val.join(", ");
      rows.push([m.label, val || "—"]);
    });
  } else if (lead.serviceNeeded || lead.companyName) {
    // Legacy lead — show the original fields it was created with
    rows.push("divider");
    if (lead.serviceNeeded) rows.push(["Service Needed", lead.serviceNeeded]);
    if (lead.companyName)  rows.push(["Company Name", lead.companyName]);
  }

  rows.push("divider");
  rows.push(["Assigned To", lead.assignedToName || "Unassigned"]);
  rows.push(["Assignment Type", lead.assignedBy || (lead.assignmentPending ? "Pending" : "—")]);
  rows.push(["Assigned At", lead.assignedAt ? formatDateTime(lead.assignedAt.toDate()) : "—"]);
  rows.push(["Status", lead.status || "—"]);

  document.getElementById("leadDetailsModalTitle").textContent = `Sl.No ${lead.slNo} — ${lead.fullName}`;
  document.getElementById("leadDetailsModalBody").innerHTML = rows.map((r) => {
    if (r === "divider") return `<hr class="my-2">`;
    if (r === "__campaign_header__") return `<div class="small fw-semibold text-muted mb-1">Campaign Details</div>`;
    const [label, value] = r;
    return `
    <div class="lead-detail-row">
      <div class="lead-detail-label">${escapeHtml(label)}</div>
      <div class="lead-detail-value">${escapeHtml(String(value))}</div>
    </div>`;
  }).join("");

  new bootstrap.Modal(document.getElementById("leadDetailsModal")).show();
}