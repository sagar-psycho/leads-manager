// ============================================================
// ASSIGNMENT.JS — Smart Lead Assignment Engine
//
// Business rules (all values read from CRM_CONFIG at runtime):
//  • No assignment outside office hours
//  • No assignment on holidays
//  • No assignment to members on approved full-day leave
//  • Half-day morning leave: member eligible only after lunch
//  • Half-day afternoon leave: member eligible only before lunch
//  • Pending leads assigned gradually (interval from settings)
//  • Every action is logged to auditLog collection
// ============================================================

const assignmentQueueRef = db.collection("assignmentQueue");
const auditLogRef        = db.collection("auditLog");
const leavesRef          = db.collection("leaves");

function getAssignmentRoleForLead(lead) {
  if (!lead) return DEFAULT_ASSIGNMENT_ROLE;
  if (lead.assignmentRole) return lead.assignmentRole;
  if (lead.campaignId && typeof ALL_CAMPAIGNS !== "undefined") {
    const campaign = ALL_CAMPAIGNS.find((c) => c.id === lead.campaignId);
    if (campaign && campaign.defaultAssignmentRole) return campaign.defaultAssignmentRole;
  }
  return DEFAULT_ASSIGNMENT_ROLE;
}

// ── Audit log writer ──────────────────────────────────────────
async function writeAuditLog(leadId, slNo, action, reason, actorName) {
  try {
    await auditLogRef.add({
      leadId,
      slNo:      slNo || null,
      action,
      reason,
      actor:     actorName || "System",
      timestamp: firebase.firestore.Timestamp.now(),
      date:      new Date().toISOString().slice(0, 10)
    });
  } catch (e) {
    console.warn("Audit log write failed:", e.message);
  }
}

// ── Determine if current moment is valid for assignment ───────
function isValidAssignmentTime() {
  if (isHolidayToday())   return false;
  if (!isOfficeHoursNow()) return false;
  if (isBreakTimeNow())    return false;
  return true;
}

// ── Fetch today's approved leaves ────────────────────────────
async function getTodayLeaves() {
  const today = new Date().toISOString().slice(0, 10);
  
  // Get single day leaves for today
  const singleDaySnap = await leavesRef
    .where("date", "==", today)
    .where("status", "==", "Approved")
    .get();
  
  const leaves = [];
  singleDaySnap.forEach(d => leaves.push({ id: d.id, ...d.data() }));
  
  // Get multiple day leaves that span today
  const multipleDaySnap = await leavesRef
    .where("leaveType", "==", "Multiple Days")
    .where("status", "==", "Approved")
    .get();
  
  multipleDaySnap.forEach(d => {
    const leaveData = d.data();
    if (leaveData.dateFrom && leaveData.dateTo) {
      // Check if today falls within the range
      if (today >= leaveData.dateFrom && today <= leaveData.dateTo) {
        leaves.push({ id: d.id, ...leaveData });
      }
    }
  });
  
  return leaves;
}

// ── Check if a specific user is available right now ──────────
function isUserAvailableNow(userId, todayLeaves) {
  const leave = todayLeaves.find(l => l.memberId === userId);
  if (!leave) return true;

  const type = leave.leaveType;
  
  // Full day absences
  if (type === "Full Day" || type === "Sick Leave" || type === "Emergency Leave" || type === "Multiple Days") {
    return false;
  }
  
  // Work from home - member is available
  if (type === "Work From Home") return true;

  // Half day leaves - check time boundary
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const [lh, lm] = (CRM_CONFIG.lunchStart || "13:00").split(":").map(Number);
  const lunchMin = lh * 60 + lm;

  // Half Day Morning: absent AM, available after lunch
  if (type === "Half Day Morning") return nowMin >= lunchMin;
  
  // Half Day Afternoon: available AM, absent after lunch
  if (type === "Half Day Afternoon") return nowMin < lunchMin;

  return true;
}

function isMemberAvailableNow(memberId, todayLeaves) {
  return isUserAvailableNow(memberId, todayLeaves);
}

async function getNextAvailableUserByRole(role, todayLeaves) {
  if (role === "hr") {
    await refreshActiveHR();
  } else {
    await refreshActiveMembers();
  }

  const activeList = role === "hr" ? ACTIVE_HR : ACTIVE_MEMBERS;
  if (!activeList || activeList.length === 0) return null;

  const roundRobinDocId = role === "member" ? "roundRobin_member" : `roundRobin_${role}`;
  const rrSnap = await metaRef.doc(roundRobinDocId).get();
  let lastIndex = rrSnap.exists ? (rrSnap.data().lastIndex ?? -1) : -1;

  // Backwards compatibility for the original shared round robin document.
  if (role === "member" && lastIndex < 0) {
    const legacySnap = await metaRef.doc("roundRobin").get();
    if (legacySnap.exists) lastIndex = legacySnap.data().lastIndex ?? -1;
  }

  for (let i = 1; i <= activeList.length; i++) {
    const idx = (lastIndex + i) % activeList.length;
    const user = activeList[idx];
    if (isUserAvailableNow(user.id, todayLeaves)) {
      await metaRef.doc(roundRobinDocId).set({ lastIndex: idx }, { merge: true });
      return user;
    }
  }
  return null; // all users unavailable
}

async function getNextAvailableMember(todayLeaves) {
  return getNextAvailableUserByRole("member", todayLeaves);
}

// ── Smart createLead — used instead of the original ───────────
async function smartCreateLead(formData) {
  const assignmentRole = formData.assignmentRole || DEFAULT_ASSIGNMENT_ROLE;
  if (assignmentRole === "hr") {
    await refreshActiveHR();
    if (!ACTIVE_HR || ACTIVE_HR.length === 0) {
      throw new Error("No active HR users exist. Add an HR user before creating leads for this campaign.");
    }
  } else {
    await refreshActiveMembers();
    if (!ACTIVE_MEMBERS || ACTIVE_MEMBERS.length === 0) {
      throw new Error("No active sales members exist. Add a member before creating leads.");
    }
  }

  const counterDocRef = metaRef.doc("leadCounter");
  const newLeadRef    = leadsRef.doc();
  const now           = firebase.firestore.Timestamp.now();
  const canAssign     = isValidAssignmentTime();
  const todayLeaves   = canAssign ? await getTodayLeaves() : [];
  const assignedMember = canAssign ? await getNextAvailableUserByRole(assignmentRole, todayLeaves) : null;

  let nextSlNo = 1;

  await db.runTransaction(async t => {
    const counterSnap = await t.get(counterDocRef);
    nextSlNo = (counterSnap.exists ? counterSnap.data().count : 0) + 1;

    const baseFields = {
      slNo:          nextSlNo,
      serviceNeeded: formData.serviceNeeded,
      email:         formData.email || "",
      fullName:      formData.fullName,
      phoneNumber:   formData.phoneNumber,
      companyName:   formData.companyName || "",
      status:        "Not Open",
      createdBy:     CURRENT_USER.uid,
      createdByName: CURRENT_USER.name || CURRENT_USER.email,
      createdAt:     now,
      lastContactedAt: null,
      nextFollowUpAt:  null,
      consecutiveNotPickingAttempts: 0,  // Track consecutive "Not Picking Call" attempts
      assignmentRole: assignmentRole,
      // Campaign Form Builder — null/"" when the legacy "General / No Campaign" path is used
      campaignId:         formData.campaignId || null,
      campaignName:        formData.campaignName || null,
      campaignData:        formData.campaignData || null,
      campaignFieldsMeta:  formData.campaignFieldsMeta || null,
    };

    if (assignedMember) {
      // ── Immediate assignment ──────────────────────────────
      t.set(newLeadRef, {
        ...baseFields,
        assignedTo:          assignedMember.id,
        assignedToName:      assignedMember.name || assignedMember.email,
        assignedAt:          now,
        assignedBy:          "System Auto Assignment",
        assignmentPending:   false,
        assignmentReason:    null,
        history: [{
          text: `Lead created and auto-assigned to ${assignedMember.name || assignedMember.email}`,
          statusAtTime: "Not Open",
          updatedBy:     CURRENT_USER.uid,
          updatedByName: CURRENT_USER.name || CURRENT_USER.email,
          timestamp:     new Date().toISOString()
        }]
      });
    } else {
      // ── Pending assignment ────────────────────────────────
      const reason = isHolidayToday()
        ? "Holiday — no assignment today"
        : !isOfficeHoursNow()
          ? "Outside Office Hours"
          : isBreakTimeNow()
            ? "Break Time"
            : assignmentRole === "hr"
              ? "No HR available"
              : "No Sales Members available";

      t.set(newLeadRef, {
        ...baseFields,
        assignedTo:        null,
        assignedToName:    null,
        assignedAt:        null,
        assignedBy:        null,
        assignmentPending: true,
        assignmentReason:  reason,
        history: [{
          text: `Lead created — pending assignment (${reason})`,
          statusAtTime: "Not Open",
          updatedBy:     CURRENT_USER.uid,
          updatedByName: CURRENT_USER.name || CURRENT_USER.email,
          timestamp:     new Date().toISOString()
        }]
      });

      // Add to assignment queue
      t.set(assignmentQueueRef.doc(newLeadRef.id), {
        leadId:    newLeadRef.id,
        slNo:      nextSlNo,
        createdAt: now,
        reason
      });
    }

    t.set(counterDocRef, { count: nextSlNo }, { merge: true });
  });

  // Audit log
  const action = assignedMember ? "Assigned Immediately" : "Pending Assignment";
  const reason = assignedMember
    ? `Assigned to ${assignedMember.name || assignedMember.email}`
    : "Created outside valid assignment window";
  await writeAuditLog(newLeadRef.id, nextSlNo, action, reason, CURRENT_USER.name || CURRENT_USER.email);

  if (!assignedMember) {
    toast("Lead saved with Pending Assignment — will be assigned at next office opening.", "warning");
  }
}

// ── Pending assignment dispatcher (called at office open time) ─
// Assigns queued leads one by one with the configured interval.
let _dispatchTimer = null;

async function dispatchPendingLeads() {
  if (!isValidAssignmentTime()) return;

  // Get all pending queue entries, ordered by creation time
  const qSnap = await assignmentQueueRef.orderBy("createdAt", "asc").get();
  if (qSnap.empty) return;

  const todayLeaves = await getTodayLeaves();
  const intervalMs  = (getCRMSetting("assignmentIntervalMinutes") || 30) * 60 * 1000;

  let delay = 0;
  qSnap.forEach(qDoc => {
    const { leadId, slNo } = qDoc.data();
    setTimeout(async () => {
      if (!isValidAssignmentTime()) return; // re-check before each assignment
      try {
        // Check if lead still exists before attempting update
        const leadDoc = await leadsRef.doc(leadId).get();
        if (!leadDoc.exists) {
          console.warn(`Lead ${leadId} no longer exists, removing from queue`);
          await assignmentQueueRef.doc(leadId).delete();
          await writeAuditLog(leadId, slNo, "Skipped", "Lead was deleted before assignment", "System");
          return;
        }
        
        const leadData = leadDoc.data();
        const assignmentRole = getAssignmentRoleForLead(leadData);
        const member = await getNextAvailableUserByRole(assignmentRole, todayLeaves);
        if (!member) {
          await writeAuditLog(leadId, slNo, "Skipped", `No ${assignmentRole} available`, "System");
          return;
        }

        const now = firebase.firestore.Timestamp.now();
        await leadsRef.doc(leadId).update({
          assignedTo:        member.id,
          assignedToName:    member.name || member.email,
          assignedAt:        now,
          assignedBy:        "System Auto Assignment",
          assignmentPending: false,
          assignmentReason:  null,
          history:           firebase.firestore.FieldValue.arrayUnion({
            text:          `Auto-assigned to ${ASSIGNMENT_ROLE_LABELS[assignmentRole] || assignmentRole} ${member.name || member.email} at office opening`,
            statusAtTime:  "Not Open",
            updatedBy:     "system",
            updatedByName: "System Auto Assignment",
            timestamp:     new Date().toISOString()
          })
        });
        await assignmentQueueRef.doc(leadId).delete();
        await writeAuditLog(leadId, slNo, "Assigned After Office Opening",
          `Assigned to ${member.name || member.email}`, "System");

        // Notify the assigned member
        if (getCRMSetting("toastNotifications") !== false) {
          toast(`Lead #${slNo} auto-assigned to ${member.name || member.email}.`, "info");
        }
      } catch (err) {
        console.error("Dispatch error for lead", leadId, err);
        // Don't crash the entire queue - continue with next lead
      }
    }, delay);
    delay += intervalMs;
  });
}

// ── Poll every minute — trigger dispatch when office opens ────
function startAssignmentWatcher() {
  setInterval(async () => {
    if (isValidAssignmentTime()) {
      await dispatchPendingLeads();
    }
  }, 60 * 1000);
  // Run immediately on load too
  dispatchPendingLeads();
}

// Export functions for use by other modules
window.getNextAvailableUserByRole = getNextAvailableUserByRole;
window.writeAuditLog = writeAuditLog;
window.isValidAssignmentTime = isValidAssignmentTime;
window.getTodayLeaves = getTodayLeaves;
