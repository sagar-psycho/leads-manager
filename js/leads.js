// ============================================================
// LEADS.JS — Lead CRUD, round-robin assignment, status workflow,
// history logging, filters, urgent actions, follow-up reminders
// ============================================================

// ============================================================
// STATUS LIST
// ============================================================
// NOTE: "Pending Approval", "Re-Call Required", and "No Response" are SYSTEM-ONLY statuses.
// They are automatically assigned by the workflow and should NEVER be 
// manually selectable in the dropdown.
// - Pending Approval & Re-Call Required: Managed via callAuditStatus field
// - No Response: Assigned after max consecutive Not Picking Call attempts
// ============================================================

const STATUS_LIST = [
  "Not Open",
  "Busy",
  "Contacted",
  "Interested",
  "Call Back Later",
  "Not Picking Call",
  "Not Interested",
  "Job Seeker",
  "Driver",
  "Transporter"
];

// System-only statuses (never shown in dropdown, set automatically by workflow)
const SYSTEM_STATUSES = [
  "Pending Approval",   // Call audit workflow
  "Re-Call Required",   // Call audit workflow
  "No Response"         // Auto-assigned after max consecutive Not Picking Call attempts
];

// Statuses that indicate meaningful contact (reset Not Picking Call counter)
const MEANINGFUL_CONTACT_STATUSES = [
  "Contacted",
  "Busy",
  "Interested",
  "Call Back Later"
];

// Statuses that require mandatory call audit (Sales Members cannot set directly)
const AUDIT_REQUIRED_STATUSES = ["Not Interested"];

// ============================================================
// ONE-TIME MIGRATION: Not Picking Call → No Response
// ============================================================
// This function reviews leads with consecutive Not Picking Call history
// and migrates them to "No Response" if they meet the criteria.
// Should be run ONCE after deploying this feature.
// ============================================================

async function migrateNotPickingCallToNoResponse() {
  console.log("Starting one-time migration: Not Picking Call → No Response");
  
  const maxConsecutiveAttempts = getCRMSetting("maxConsecutiveNotPickingAttempts") || 3;
  console.log(`Using max consecutive attempts: ${maxConsecutiveAttempts}`);
  
  // Query all leads still in "Not Picking Call" status
  const snapshot = await leadsRef.where("status", "==", "Not Picking Call").get();
  
  if (snapshot.empty) {
    console.log("No leads found in 'Not Picking Call' status. Migration complete.");
    return { migrated: 0, skipped: 0 };
  }
  
  let migratedCount = 0;
  let skippedCount = 0;
  const batch = db.batch();
  let batchCount = 0;
  const MAX_BATCH_SIZE = 500;
  
  for (const doc of snapshot.docs) {
    const lead = doc.data();
    const history = lead.history || [];
    
    // Count consecutive "Not Picking Call" attempts at the END of history
    let consecutiveAttempts = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      const entry = history[i];
      if (entry.statusAtTime === "Not Picking Call") {
        consecutiveAttempts++;
      } else if (MEANINGFUL_CONTACT_STATUSES.includes(entry.statusAtTime)) {
        // Stop counting at meaningful contact
        break;
      }
    }
    
    // Migrate if meets criteria
    if (consecutiveAttempts >= maxConsecutiveAttempts) {
      const migrationEntry = {
        text: `Migration: Automatically moved to "No Response" after ${consecutiveAttempts} consecutive Not Picking Call attempts (max: ${maxConsecutiveAttempts} per CRM Settings). This status distinguishes no customer response from explicit "Not Interested".`,
        statusAtTime: "No Response",
        updatedBy: "system-migration",
        updatedByName: "System Migration",
        timestamp: new Date().toISOString(),
        isMigration: true
      };
      
      batch.update(doc.ref, {
        status: "No Response",
        consecutiveNotPickingAttempts: consecutiveAttempts,
        nextFollowUpAt: null, // Remove follow-up
        history: firebase.firestore.FieldValue.arrayUnion(migrationEntry)
      });
      
      migratedCount++;
      batchCount++;
      
      // Commit batch if reaching limit
      if (batchCount >= MAX_BATCH_SIZE) {
        await batch.commit();
        console.log(`Committed batch of ${batchCount} updates`);
        batchCount = 0;
      }
    } else {
      skippedCount++;
    }
  }
  
  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
    console.log(`Committed final batch of ${batchCount} updates`);
  }
  
  console.log(`Migration complete: ${migratedCount} migrated, ${skippedCount} skipped`);
  return { migrated: migratedCount, skipped: skippedCount };
}

// Call migration on page load (only if Super Admin and not run before)
async function checkAndRunMigration() {
  // Only Super Admin can trigger migration
  if (CURRENT_USER.role !== "superadmin") return;
  
  // Check if migration already run (using localStorage flag)
  const migrationKey = "noResponseMigrationCompleted_v1";
  if (localStorage.getItem(migrationKey)) {
    console.log("Migration already completed (flag found in localStorage)");
    return;
  }
  
  // Ask Super Admin for confirmation
  if (!confirm("One-time migration required: Review leads with consecutive 'Not Picking Call' attempts and move them to new 'No Response' status. This will improve your CRM analytics by distinguishing between 'no response' and 'not interested'. Run migration now?")) {
    console.log("Migration cancelled by user");
    return;
  }
  
  try {
    const result = await migrateNotPickingCallToNoResponse();
    toast(`Migration complete: ${result.migrated} leads moved to "No Response", ${result.skipped} leads skipped.`, "success");
    localStorage.setItem(migrationKey, new Date().toISOString());
  } catch (error) {
    console.error("Migration failed:", error);
    toast("Migration failed. Check console for details.", "danger");
  }
}

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
    if (typeof refreshCampaignAnalyticsIfVisible === "function") refreshCampaignAnalyticsIfVisible();
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

// ============================================================
// FOLLOW-UP SCHEDULING SYSTEM
// ============================================================

// Global variable to track follow-up modal state
let PENDING_STATUS_UPDATE = null;

/**
 * Validates follow-up date and time against CRM Settings
 * Returns { valid: boolean, error: string, suggestion: any }
 */
async function validateFollowUpDateTime(date, time) {
  const scheduledDateTime = new Date(`${date}T${time}`);
  const now = new Date();
  
  // 1. Not in the past
  if (scheduledDateTime <= now) {
    return { valid: false, error: "Cannot schedule follow-up in the past.", type: "error" };
  }
  
  // 2. Not on holiday
  const holidays = CRM_CONFIG.holidays || [];
  const isHoliday = holidays.some(h => {
    if (h.recurring) {
      return h.date.slice(5) === date.slice(5);
    }
    return h.date === date;
  });
  
  if (isHoliday) {
    const holiday = holidays.find(h => 
      h.recurring ? h.date.slice(5) === date.slice(5) : h.date === date
    );
    const nextDate = getNextWorkingDay(date);
    return { 
      valid: false, 
      error: `${date} is a holiday (${holiday.name}).`,
      suggestion: nextDate,
      type: "error"
    };
  }
  
  // 3. Working day
  const dayOfWeek = ["Sunday","Monday","Tuesday","Wednesday",
                     "Thursday","Friday","Saturday"][scheduledDateTime.getDay()];
  const workingDays = CRM_CONFIG.workingDays || [];
  
  if (!workingDays.includes(dayOfWeek)) {
    const nextDate = getNextWorkingDay(date);
    return { 
      valid: false, 
      error: `${dayOfWeek} is not a working day.`,
      suggestion: nextDate,
      type: "error"
    };
  }

  // 4. Office hours
  const [officeStartH, officeStartM] = (CRM_CONFIG.officeStart || "09:00").split(":").map(Number);
  const [officeEndH, officeEndM] = (CRM_CONFIG.officeEnd || "18:00").split(":").map(Number);
  const [schedH, schedM] = time.split(":").map(Number);
  
  const schedMinutes = schedH * 60 + schedM;
  const startMinutes = officeStartH * 60 + officeStartM;
  const endMinutes = officeEndH * 60 + officeEndM;
  
  if (schedMinutes < startMinutes || schedMinutes >= endMinutes) {
    return {
      valid: false,
      error: `Time must be between ${CRM_CONFIG.officeStart} and ${CRM_CONFIG.officeEnd}.`,
      suggestion: CRM_CONFIG.officeStart,
      type: "error"
    };
  }
  
  // 5. Not during break time
  const breaks = CRM_CONFIG.breakTimings || [];
  for (const brk of breaks) {
    const [brkStartH, brkStartM] = (brk.start || "00:00").split(":").map(Number);
    const [brkEndH, brkEndM] = (brk.end || "00:00").split(":").map(Number);
    const brkStartMin = brkStartH * 60 + brkStartM;
    const brkEndMin = brkEndH * 60 + brkEndM;
    
    if (schedMinutes >= brkStartMin && schedMinutes < brkEndMin) {
      return {
        valid: false,
        error: `Cannot schedule during break time: ${brk.name} (${brk.start} - ${brk.end}).`,
        type: "warning"
      };
    }
  }
  
  return { valid: true };
}

/**
 * Find next working day starting from given date
 */
function getNextWorkingDay(startDate) {
  const workingDays = CRM_CONFIG.workingDays || [];
  const holidays = CRM_CONFIG.holidays || [];
  const date = new Date(startDate);
  
  // Try up to 14 days ahead
  for (let i = 1; i <= 14; i++) {
    date.setDate(date.getDate() + 1);
    const dateStr = date.toISOString().slice(0, 10);
    const dayName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][date.getDay()];
    
    // Check if working day
    if (!workingDays.includes(dayName)) continue;
    
    // Check if holiday
    const isHoliday = holidays.some(h => {
      if (h.recurring) return h.date.slice(5) === dateStr.slice(5);
      return h.date === dateStr;
    });
    
    if (!isHoliday) return dateStr;
  }
  
  return startDate; // fallback
}

/**
 * Open follow-up scheduling modal
 */
async function openFollowUpModal(leadId, leadData, statusNote) {
  // Store pending status update
  PENDING_STATUS_UPDATE = {
    leadId: leadId,
    newStatus: "Call Back Later",
    noteText: statusNote,
    leadData: leadData
  };
  
  // Populate modal
  document.getElementById("followUpLeadName").textContent = escapeHtml(leadData.fullName);
  document.getElementById("followUpLeadPhone").textContent = escapeHtml(leadData.phoneNumber || "—");
  
  // Set default date (tomorrow) and time (10:00 AM)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  
  document.getElementById("followUpDate").value = tomorrowStr;
  document.getElementById("followUpTime").value = "10:00";
  document.getElementById("followUpRemark").value = "";
  document.getElementById("followUpValidationMessages").innerHTML = "";
  
  // Reset radio buttons
  document.getElementById("followUpCall").checked = true;
  document.getElementById("followUpMorning").checked = true;
  
  // Show modal
  const modal = new bootstrap.Modal(document.getElementById("scheduleFollowUpModal"));
  modal.show();
  
  // Add validation on change
  document.getElementById("followUpDate").addEventListener("input", validateFollowUpInputs);
  document.getElementById("followUpTime").addEventListener("input", validateFollowUpInputs);
}

/**
 * Validate follow-up inputs and show messages
 */
async function validateFollowUpInputs() {
  const date = document.getElementById("followUpDate").value;
  const time = document.getElementById("followUpTime").value;
  const msgContainer = document.getElementById("followUpValidationMessages");
  
  if (!date || !time) {
    msgContainer.innerHTML = "";
    return;
  }
  
  const validation = await validateFollowUpDateTime(date, time);
  
  if (!validation.valid) {
    const iconClass = validation.type === "error" ? "bi-x-circle-fill" : "bi-exclamation-triangle-fill";
    const cssClass = validation.type === "error" ? "followup-validation-error" : "followup-validation-warning";
    
    let html = `
      <div class="${cssClass}">
        <i class="bi ${iconClass}"></i>
        <div>
          <div>${escapeHtml(validation.error)}</div>
          ${validation.suggestion ? `
            <span class="followup-validation-suggestion" onclick="applySuggestedDate('${validation.suggestion}')">
              <i class="bi bi-arrow-right-circle me-1"></i>Use ${validation.suggestion}
            </span>
          ` : ""}
        </div>
      </div>
    `;
    msgContainer.innerHTML = html;
  } else {
    msgContainer.innerHTML = `
      <div style="background: #D8F3DD; border: 1px solid #a8dcb4; border-radius: 8px; padding: 10px 12px; font-size: 13px; color: #1E7A34;">
        <i class="bi bi-check-circle-fill me-2"></i>Follow-up time is valid.
      </div>
    `;
  }
}

/**
 * Apply suggested date from validation message
 */
function applySuggestedDate(dateStr) {
  document.getElementById("followUpDate").value = dateStr;
  validateFollowUpInputs();
}

/**
 * Cancel follow-up schedule - return to status modal
 */
function cancelFollowUpSchedule() {
  const modal = bootstrap.Modal.getInstance(document.getElementById("scheduleFollowUpModal"));
  modal.hide();
  PENDING_STATUS_UPDATE = null;
  
  // Re-open status modal
  // Note: The status modal should still be accessible in the DOM
}

/**
 * Handle follow-up form submission
 */
document.addEventListener("DOMContentLoaded", () => {
  const followUpForm = document.getElementById("scheduleFollowUpForm");
  if (followUpForm) {
    followUpForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      if (!PENDING_STATUS_UPDATE) {
        toast("No pending status update found.", "danger");
        return;
      }
      
      const date = document.getElementById("followUpDate").value;
      const time = document.getElementById("followUpTime").value;
      const contactMethod = document.querySelector('input[name="followUpContactMethod"]:checked').value;
      const preferredTime = document.querySelector('input[name="followUpPreferredTime"]:checked').value;
      const remark = document.getElementById("followUpRemark").value.trim();
      
      if (!remark) {
        toast("Please provide a remark for the follow-up.", "warning");
        return;
      }
      
      // Final validation
      const validation = await validateFollowUpDateTime(date, time);
      if (!validation.valid) {
        toast(validation.error, "danger");
        return;
      }
      
      // Disable submit button
      const submitBtn = followUpForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Scheduling...';
      
      try {
        // Create follow-up object
        const scheduledTimestamp = firebase.firestore.Timestamp.fromDate(new Date(`${date}T${time}`));
        
        const followUpData = {
          status: "Pending",
          scheduledDate: date,
          scheduledTime: time,
          scheduledTimestamp: scheduledTimestamp,
          contactMethod: contactMethod,
          preferredTime: preferredTime,
          remark: remark,
          assignedTo: CURRENT_USER.uid,
          assignedToName: CURRENT_USER.name || CURRENT_USER.email,
          createdBy: CURRENT_USER.uid,
          createdByName: CURRENT_USER.name || CURRENT_USER.email,
          createdAt: firebase.firestore.Timestamp.now(),
          completedAt: null,
          completedBy: null,
          completedByName: null
        };
        
        // Now execute the status update WITH follow-up
        await executeStatusUpdateWithFollowUp(
          PENDING_STATUS_UPDATE.leadId,
          PENDING_STATUS_UPDATE.newStatus,
          PENDING_STATUS_UPDATE.noteText,
          followUpData
        );
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById("scheduleFollowUpModal"));
        modal.hide();
        
        // Close status modal too
        const statusModal = bootstrap.Modal.getInstance(document.getElementById("statusModal"));
        if (statusModal) statusModal.hide();
        
        // Clear pending update
        PENDING_STATUS_UPDATE = null;
        
        toast(`Follow-up scheduled for ${date} at ${time}.`, "success");
        
      } catch (error) {
        console.error("Follow-up scheduling error:", error);
        toast("Failed to schedule follow-up. Please try again.", "danger");
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Schedule Follow-up';
      }
    });
  }
});

/**
 * Execute status update with follow-up data
 */
async function executeStatusUpdateWithFollowUp(leadId, newStatus, noteText, followUpData) {
  const leadRef = leadsRef.doc(leadId);
  const now = firebase.firestore.Timestamp.now();

  // Get current lead data
  const leadDoc = await leadRef.get();
  if (!leadDoc.exists) {
    toast("Lead not found.", "danger");
    return;
  }
  const leadData = leadDoc.data();

  // Read settings
  const maxConsecutiveAttempts = getCRMSetting("maxConsecutiveNotPickingAttempts") || 3;
  
  // Create history entry with follow-up details
  let historyText = noteText && noteText.trim() ? noteText.trim() : "(status updated, no note added)";
  historyText += `\n\n📅 Follow-up scheduled:\nDate: ${followUpData.scheduledDate} at ${followUpData.scheduledTime}\nMethod: ${followUpData.contactMethod}\nPreferred: ${followUpData.preferredTime}\nRemark: ${followUpData.remark}`;

  const historyEntry = {
    text: historyText,
    statusAtTime: newStatus,
    updatedBy: CURRENT_USER.uid,
    updatedByName: CURRENT_USER.name || CURRENT_USER.email,
    timestamp: new Date().toISOString(),
    followUp: followUpData // Embed follow-up in history
  };

  // Update lead with follow-up embedded
  const updateData = {
    status: newStatus,
    lastContactedAt: now,
    followUp: followUpData, // Store current follow-up in lead document
    hasPendingFollowUp: true,
    nextFollowUpAt: followUpData.scheduledTimestamp,
    consecutiveNotPickingAttempts: 0, // Reset on Call Back Later
    history: firebase.firestore.FieldValue.arrayUnion(historyEntry)
  };

  await leadRef.update(updateData);
}

// ---------------- UPDATE STATUS / NOTE (with history) ----------------
async function updateLeadStatus(leadId, newStatus, noteText) {
  const leadRef = leadsRef.doc(leadId);
  const now = firebase.firestore.Timestamp.now();

  // Get current lead data
  const leadDoc = await leadRef.get();
  if (!leadDoc.exists) {
    toast("Lead not found.", "danger");
    return;
  }
  const leadData = leadDoc.data();
  
  // ✅ INTERCEPT "Call Back Later" — require follow-up scheduling
  if (newStatus === "Call Back Later") {
    // Close the status modal first
    const statusModal = bootstrap.Modal.getInstance(document.getElementById("statusModal"));
    if (statusModal) statusModal.hide();
    
    // Open follow-up modal
    await openFollowUpModal(leadId, leadData, noteText);
    return; // Stop here — follow-up modal will complete the update
  }
  
  // ✅ AUTO-CANCEL pending follow-up if moving to final status
  const finalStatuses = ["Interested", "Not Interested", "No Response", "Job Seeker", "Driver", "Transporter"];
  if (finalStatuses.includes(newStatus) && leadData.hasPendingFollowUp) {
    await cancelPendingFollowUp(leadId, leadData, newStatus);
  }

  // Continue with normal status update logic
  // Read settings - all values from CRM_CONFIG
  const maxConsecutiveAttempts = getCRMSetting("maxConsecutiveNotPickingAttempts") || 3;
  const autoMoveToNoResponse = getCRMSetting("autoMoveToNoResponse") ?? true;
  const reminderAfterBusy = getCRMSetting("reminderAfterMinutes") || 60;
  
  // Not Picking Call reminder: 4 hours (240 minutes)
  const reminderMap = {
    "Busy": reminderAfterBusy,
    "Not Picking Call": 240
  };

  // Track consecutive "Not Picking Call" attempts
  let consecutiveAttempts = leadData.consecutiveNotPickingAttempts || 0;
  let finalStatus = newStatus;
  let nextFollowUpAt = null;
  let historyText = noteText && noteText.trim() ? noteText.trim() : "(status updated, no note added)";

  // Handle "Not Picking Call" attempt tracking
  if (newStatus === "Not Picking Call") {
    consecutiveAttempts++;
    
    // Check if max consecutive attempts reached
    if (consecutiveAttempts >= maxConsecutiveAttempts) {
      if (autoMoveToNoResponse) {
        // Auto-move to "No Response" (system-only status)
        finalStatus = "No Response";
        nextFollowUpAt = null; // No follow-up for No Response
        historyText = `Not Picking Call - Attempt ${consecutiveAttempts}/${maxConsecutiveAttempts}. Automatically moved to "No Response" per CRM Settings (${maxConsecutiveAttempts} consecutive attempts with no answer). ${noteText && noteText.trim() ? "Note: " + noteText.trim() : ""}`;
        
        toast(`Lead automatically moved to "No Response" after ${maxConsecutiveAttempts} consecutive attempts with no answer.`, "warning");
      } else {
        // Prevent additional "Not Picking Call" updates
        toast(`Maximum consecutive "Not Picking Call" attempts (${maxConsecutiveAttempts}) reached. Please select another status or contact admin.`, "danger");
        return; // Block the update
      }
    } else {
      // Still under max attempts - schedule follow-up
      const reminderMinutes = reminderMap[newStatus];
      if (reminderMinutes) {
        nextFollowUpAt = firebase.firestore.Timestamp.fromMillis(Date.now() + reminderMinutes * 60000);
      }
      historyText = `Not Picking Call - Consecutive attempt ${consecutiveAttempts}/${maxConsecutiveAttempts}. ${noteText && noteText.trim() ? "Note: " + noteText.trim() : ""}`;
    }
  } else if (MEANINGFUL_CONTACT_STATUSES.includes(newStatus)) {
    // Reset consecutive attempts on meaningful contact
    consecutiveAttempts = 0;
    
    // Schedule follow-up if applicable
    const reminderMinutes = reminderMap[newStatus];
    if (reminderMinutes) {
      nextFollowUpAt = firebase.firestore.Timestamp.fromMillis(Date.now() + reminderMinutes * 60000);
    }
  } else {
    // Other status changes also reset the counter
    consecutiveAttempts = 0;
  }

  // Create history entry
  const historyEntry = {
    text: historyText,
    statusAtTime: finalStatus,
    updatedBy: CURRENT_USER.uid,
    updatedByName: CURRENT_USER.name || CURRENT_USER.email,
    timestamp: new Date().toISOString(),
    ...(newStatus === "Not Picking Call" && { 
      attemptCount: consecutiveAttempts, 
      maxAttempts: maxConsecutiveAttempts,
      isConsecutive: true
    })
  };

  // Update lead
  const updateData = {
    status: finalStatus,
    lastContactedAt: now,
    nextFollowUpAt: nextFollowUpAt,
    consecutiveNotPickingAttempts: consecutiveAttempts,
    history: firebase.firestore.FieldValue.arrayUnion(historyEntry)
  };

  await leadRef.update(updateData);

  // Log to console for debugging
  if (newStatus === "Not Picking Call") {
    console.log(`Not Picking Call: Consecutive attempt ${consecutiveAttempts}/${maxConsecutiveAttempts}, Auto-move to No Response enabled: ${autoMoveToNoResponse}, Final status: ${finalStatus}`);
  }
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
      <td>${escapeHtml(l.campaignName || l.serviceNeeded || "General")}</td>
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
        <button class="btn btn-sm btn-outline-secondary" onclick="openLeadDetailsModal('${l.id}')" title="View Details"><i class="bi bi-eye"></i></button>
        <button class="btn btn-sm btn-outline-secondary" onclick="openHistoryModal('${l.id}')" title="History"><i class="bi bi-clock-history"></i></button>
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
 * Cancel pending follow-up when lead moves to final status
 */
async function cancelPendingFollowUp(leadId, leadData, newStatus) {
  const leadRef = leadsRef.doc(leadId);
  
  // Update follow-up status to cancelled
  const cancelledFollowUp = {
    ...leadData.followUp,
    status: "Cancelled",
    cancelledAt: firebase.firestore.Timestamp.now(),
    cancelledBy: CURRENT_USER.uid,
    cancelledByName: CURRENT_USER.name || CURRENT_USER.email,
    cancelReason: `Lead moved to final status: ${newStatus}`
  };
  
  // Add timeline entry
  const timelineEntry = {
    text: `Follow-up Cancelled: Lead moved to "${newStatus}" status. Original follow-up was scheduled for ${leadData.followUp.scheduledDate} at ${leadData.followUp.scheduledTime}.`,
    statusAtTime: newStatus,
    updatedBy: CURRENT_USER.uid,
    updatedByName: CURRENT_USER.name || CURRENT_USER.email,
    timestamp: new Date().toISOString(),
    followUpCancelled: true
  };
  
  await leadRef.update({
    followUp: cancelledFollowUp,
    hasPendingFollowUp: false,
    nextFollowUpAt: null,
    history: firebase.firestore.FieldValue.arrayUnion(timelineEntry)
  });
}

/**
 * Returns total minutes a lead has been overdue (0 if not overdue).
 * A lead is urgent when:
 *   (a) status === "Not Open" AND createdAt > UNCONTACTED_ALERT_MINUTES ago, OR
 *   (b) nextFollowUpAt has passed (legacy reminders), OR
 *   (c) hasPendingFollowUp and scheduledTimestamp has passed (new follow-up system)
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

  // Rule (b): missed follow-up reminder (legacy)
  if (lead.nextFollowUpAt) {
    const passedMin = (now - lead.nextFollowUpAt.toMillis()) / 60000;
    if (passedMin > 0) {
      maxOverdue = Math.max(maxOverdue, Math.floor(passedMin));
    }
  }
  
  // Rule (c): NEW - pending follow-up overdue
  if (lead.hasPendingFollowUp && lead.followUp && lead.followUp.status === "Pending") {
    if (lead.followUp.scheduledTimestamp) {
      const followUpTime = lead.followUp.scheduledTimestamp.toMillis ? 
        lead.followUp.scheduledTimestamp.toMillis() : 
        new Date(lead.followUp.scheduledDate + "T" + lead.followUp.scheduledTime).getTime();
      const passedMin = (now - followUpTime) / 60000;
      if (passedMin > 0) {
        maxOverdue = Math.max(maxOverdue, Math.floor(passedMin));
      }
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
          ${l.hasPendingFollowUp && l.followUp ? `
          <div class="followup-timeline-details mt-2">
            <div class="followup-timeline-details-row">
              <span class="followup-timeline-details-label"><i class="bi bi-calendar-check me-1"></i>Follow-up:</span>
              <span class="followup-timeline-details-value">${l.followUp.scheduledDate} at ${l.followUp.scheduledTime}</span>
            </div>
            ${l.followUp.remark ? `
            <div class="followup-timeline-details-row">
              <span class="followup-timeline-details-label"><i class="bi bi-chat-text me-1"></i>Remark:</span>
              <span class="followup-timeline-details-value">${escapeHtml(l.followUp.remark).substring(0, 60)}${l.followUp.remark.length > 60 ? '...' : ''}</span>
            </div>
            ` : ''}
          </div>
          ` : ''}
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
          ${l.hasPendingFollowUp && l.followUp ? `
          <div class="followup-timeline-details mt-2">
            <div class="followup-timeline-details-row">
              <span class="followup-timeline-details-label"><i class="bi bi-calendar-check me-1"></i>Follow-up:</span>
              <span class="followup-timeline-details-value">${l.followUp.scheduledDate} at ${l.followUp.scheduledTime}</span>
            </div>
            ${l.followUp.remark ? `
            <div class="followup-timeline-details-row">
              <span class="followup-timeline-details-label"><i class="bi bi-chat-text me-1"></i>Remark:</span>
              <span class="followup-timeline-details-value">${escapeHtml(l.followUp.remark).substring(0, 60)}${l.followUp.remark.length > 60 ? '...' : ''}</span>
            </div>
            ` : ''}
          </div>
          ` : ''}
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

    const campaignSel = document.getElementById("leadCampaign");
    if (campaignSel && !campaignSel.value) {
      toast("Please select a Campaign Type.", "warning");
      return;
    }

    let campaignInfo = null;
    try {
      campaignInfo = collectCampaignDataFromAddLeadForm(); // null on legacy / no-campaign path
    } catch (err) {
      toast(err.message, "warning");
      return;
    }

    btn.disabled = true;
    try {
      await createLead({
        serviceNeeded: document.getElementById("leadService").value.trim(),
        email: document.getElementById("leadEmail").value.trim(),
        fullName: document.getElementById("leadFullName").value.trim(),
        phoneNumber: document.getElementById("leadPhone").value.trim(),
        companyName: document.getElementById("leadCompany").value.trim(),
        campaignId:          campaignInfo ? campaignInfo.campaignId : null,
        campaignName:        campaignInfo ? campaignInfo.campaignName : null,
        campaignData:        campaignInfo ? campaignInfo.campaignData : null,
        campaignFieldsMeta:  campaignInfo ? campaignInfo.campaignFieldsMeta : null
      });
      addLeadForm.reset();
      resetAddLeadCampaignUI();
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
    body.innerHTML = history.map((h) => {
      // Build attempt badge if this is a Not Picking Call entry
      let attemptBadge = "";
      if (h.attemptCount && h.maxAttempts) {
        const isMaxReached = h.attemptCount >= h.maxAttempts;
        const badgeClass = isMaxReached ? "bg-danger" : "bg-warning text-dark";
        attemptBadge = `<span class="badge ${badgeClass} ms-2">Attempt ${h.attemptCount}/${h.maxAttempts}</span>`;
      }
      
      return `
      <div class="history-entry">
        <div class="d-flex justify-content-between align-items-start">
          <span class="fw-semibold">${escapeHtml(h.updatedByName || "Unknown")}</span>
          <span class="small text-muted">${formatDateTime(new Date(h.timestamp))}</span>
        </div>
        <div class="small text-muted mb-1">
          Status: ${h.statusAtTime || "-"}${attemptBadge}
        </div>
        <div>${escapeHtml(h.text)}</div>
      </div>`;
    }).join("");
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