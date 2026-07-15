# Not Picking Call - Settings-Driven Attempt Tracking

## 🎯 Implementation Summary

The "Not Picking Call" status now includes **intelligent attempt tracking** that is completely driven by CRM Settings. The system automatically enforces maximum attempt limits and can auto-convert leads to "Not Interested" based on Super Admin configuration.

---

## ✅ Features Implemented

### **1. Settings-Driven Behavior**

All behavior controlled by CRM Settings (no hardcoded values):

#### **Setting: maxNotPickingAttempts**
- **Path**: `CRM_CONFIG.maxNotPickingAttempts`
- **Default**: 3 attempts
- **Range**: 1-20 attempts
- **Effect**: Maximum "Not Picking Call" attempts before action

#### **Setting: autoMoveNotInterested**
- **Path**: `CRM_CONFIG.autoMoveNotInterested`
- **Default**: true (enabled)
- **Effect**: Auto-convert to "Not Interested" when max reached
- **If Disabled**: Blocks further "Not Picking Call" updates, requires manual intervention

---

### **2. Attempt Tracking System**

#### **New Lead Field**
```javascript
notPickingAttempts: 0  // Counter initialized at lead creation
```

#### **Increment Logic**
- Every "Not Picking Call" status update → `notPickingAttempts++`
- Any other status change → Reset to 0
- "Busy" status → Reset to 0

#### **Counter Persistence**
- Stored in Firestore lead document
- Survives page refreshes
- Visible to all team members
- Included in lead history

---

### **3. Maximum Attempts Behavior**

#### **Scenario A: Auto Move Enabled (Default)**
```
Attempt 1/3 → "Not Picking Call" + 4-hour reminder
Attempt 2/3 → "Not Picking Call" + 4-hour reminder
Attempt 3/3 → Automatically changes to "Not Interested"
             → No follow-up scheduled
             → Timeline entry created
             → Toast notification shown
```

**Timeline Entry Example:**
```
"Not Picking Call - Attempt 3/3. Automatically moved to 'Not Interested' 
per CRM Settings. Note: [User's note if provided]"
```

#### **Scenario B: Auto Move Disabled**
```
Attempt 1/3 → "Not Picking Call" + 4-hour reminder
Attempt 2/3 → "Not Picking Call" + 4-hour reminder
Attempt 3/3 → Blocked! Error message shown
             → Update prevented
             → User must select different status
             → Or contact admin to reset counter
```

**Error Message:**
```
"Maximum 'Not Picking Call' attempts (3) reached. 
Please select another status or contact admin."
```

---

### **4. History Timeline Tracking**

#### **Visual Indicators**

**Attempt Counter Badge:**
- Attempt 1/3: ⚠️ Yellow badge `bg-warning`
- Attempt 2/3: ⚠️ Yellow badge `bg-warning`
- Attempt 3/3: 🔴 Red badge `bg-danger` (max reached)

**History Entry Format:**
```
Status: Not Picking Call [Badge: Attempt 2/3]
Not Picking Call - Attempt 2/3. Note: Customer phone was busy
```

**Auto-Move Entry Format:**
```
Status: Not Interested [Badge: Attempt 3/3]
Not Picking Call - Attempt 3/3. Automatically moved to "Not Interested" 
per CRM Settings. Note: Still not answering after 3 attempts
```

---

### **5. Lead Details Display**

#### **New Field in Lead Details Modal**

When `notPickingAttempts > 0`, shows:
```
┌──────────────────────────────────┐
│ Not Picking Call Attempts: 2/3   │
└──────────────────────────────────┘
```

**Location**: After "Status" field in lead details
**Format**: `current/max` (e.g., "2/3")
**Color Coding**: Red text when at max

---

## 🔧 Technical Implementation

### **File: js/leads.js**

#### **Enhanced `updateLeadStatus()` Function**

```javascript
async function updateLeadStatus(leadId, newStatus, noteText) {
  // 1. Read current lead data
  const leadDoc = await leadRef.get();
  const leadData = leadDoc.data();
  
  // 2. Read settings (all from CRM_CONFIG)
  const maxAttempts = getCRMSetting("maxNotPickingAttempts") || 3;
  const autoMoveEnabled = getCRMSetting("autoMoveNotInterested") ?? true;
  
  // 3. Track attempts
  let currentAttempts = leadData.notPickingAttempts || 0;
  
  if (newStatus === "Not Picking Call") {
    currentAttempts++;
    
    // 4. Check if max reached
    if (currentAttempts >= maxAttempts) {
      if (autoMoveEnabled) {
        // Auto-convert to Not Interested
        finalStatus = "Not Interested";
        nextFollowUpAt = null;
        historyText = `Attempt ${currentAttempts}/${maxAttempts}. 
                       Automatically moved to "Not Interested"...`;
      } else {
        // Block the update
        toast("Maximum attempts reached...", "danger");
        return; // Exit without updating
      }
    }
  } else {
    // Reset counter for any other status
    currentAttempts = 0;
  }
  
  // 5. Update with counter
  await leadRef.update({
    status: finalStatus,
    notPickingAttempts: currentAttempts,
    history: [...historyEntry with attemptCount]
  });
}
```

---

### **File: js/assignment.js**

#### **Enhanced Lead Creation**

```javascript
const baseFields = {
  // ... existing fields
  notPickingAttempts: 0,  // Initialize counter
  // ... rest of fields
};
```

**Effect**: All new leads start with counter at 0

---

### **File: js/campaigns.js**

#### **Enhanced `openLeadDetailsModal()`**

```javascript
// Show attempt counter if > 0
if (lead.notPickingAttempts > 0) {
  const maxAttempts = getCRMSetting("maxNotPickingAttempts") || 3;
  rows.push(["Not Picking Call Attempts", 
             `${lead.notPickingAttempts}/${maxAttempts}`]);
}
```

**Effect**: Counter visible in lead details view

---

### **File: js/leads.js**

#### **Enhanced `openHistoryModal()`**

```javascript
// Add attempt badge to history entries
if (h.attemptCount && h.maxAttempts) {
  const isMaxReached = h.attemptCount >= h.maxAttempts;
  const badgeClass = isMaxReached ? "bg-danger" : "bg-warning text-dark";
  attemptBadge = `<span class="badge ${badgeClass}">
                    Attempt ${h.attemptCount}/${h.maxAttempts}
                  </span>`;
}
```

**Effect**: Visual badges in timeline

---

## 📊 CRM Settings Configuration

### **Super Admin Interface**

**Location**: Navigation → CRM Settings → Not Picking Call Rule

**Current UI:**
```
┌─────────────────────────────────────────────────────┐
│ Max attempts before auto "Not Interested"           │
│ [3] ▼  After this count, status becomes             │
│        "Not Interested"                              │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Auto Status Rules                                    │
│ ☑ Auto Move to Not Interested                       │
│ ☑ Auto Follow-up Scheduling                         │
│ ☑ Auto Reminder Toasts                              │
│ ☐ Auto Escalation to Admin                          │
└─────────────────────────────────────────────────────┘
```

**Settings Interaction:**
- **Max Attempts**: 1-20 (default: 3)
- **Auto Move**: Toggle ON/OFF (default: ON)
- **Changes**: Apply immediately to all users
- **Effect**: Real-time, no code changes needed

---

## 🎯 User Experience Flow

### **Flow 1: Auto Move Enabled (Default)**

```
1. Sales Member opens lead
   Status: "Not Open"
   Attempt Counter: 0/3

2. Updates to "Not Picking Call" + note
   ✅ Status saved
   ✅ Counter: 1/3
   ✅ Timeline: "Not Picking Call - Attempt 1/3. Note: [user note]"
   ✅ Follow-up: 4 hours later
   ✅ Badge: ⚠️ Yellow "Attempt 1/3"

3. Follow-up reminder appears
   Updates to "Not Picking Call" again
   ✅ Counter: 2/3
   ✅ Timeline: "Not Picking Call - Attempt 2/3. Note: [user note]"
   ✅ Badge: ⚠️ Yellow "Attempt 2/3"

4. Third attempt (max reached)
   Tries to update to "Not Picking Call"
   ✅ Status automatically changed to "Not Interested"
   ✅ Counter: 3/3 (final)
   ✅ Timeline: "Attempt 3/3. Automatically moved to 'Not Interested'..."
   ✅ Badge: 🔴 Red "Attempt 3/3"
   ✅ Toast: "Lead automatically moved to 'Not Interested' after 3 attempts"
   ✅ No follow-up scheduled

5. Lead now in "Not Interested" bucket
   Sales member sees automated reason in timeline
   Admin can review auto-converted leads
```

---

### **Flow 2: Auto Move Disabled**

```
1-3. Same as Flow 1 (attempts 1-2)

4. Third attempt (max reached)
   Tries to update to "Not Picking Call"
   ❌ Update blocked
   ❌ Error: "Maximum 'Not Picking Call' attempts (3) reached..."
   ❌ Status stays at previous value
   ❌ Counter stays at 2/3

5. Sales member must choose different action:
   Option A: Select "Not Interested" manually
   Option B: Select "Busy" (resets counter)
   Option C: Select "Interested" (resets counter)
   Option D: Contact admin to reset counter
```

---

## 🔍 Testing Scenarios

### **Test 1: Default Behavior (Auto Move ON, Max 3)**
1. Create new lead
2. Update to "Not Picking Call" 3 times
3. **Expected**: 3rd attempt auto-converts to "Not Interested"
4. **Verify**: Timeline shows automatic conversion with reason

### **Test 2: Auto Move Disabled**
1. Super Admin disables "Auto Move to Not Interested"
2. Sales member updates lead to "Not Picking Call" 3 times
3. **Expected**: 3rd attempt blocked with error message
4. **Verify**: Status unchanged, error toast shown

### **Test 3: Counter Reset**
1. Update to "Not Picking Call" (counter: 1/3)
2. Update to "Busy" (counter resets to 0/3)
3. Update to "Not Picking Call" again
4. **Expected**: Counter starts at 1/3 again (reset worked)

### **Test 4: Settings Change Mid-Flow**
1. Update to "Not Picking Call" 2 times (counter: 2/3)
2. Super Admin changes max to 5
3. Update to "Not Picking Call" again
4. **Expected**: Counter shows 3/5 (new max applied)

### **Test 5: History Display**
1. Create lead with 3 "Not Picking Call" attempts
2. Open History modal
3. **Expected**: 
   - Entry 1: Yellow badge "Attempt 1/3"
   - Entry 2: Yellow badge "Attempt 2/3"
   - Entry 3: Red badge "Attempt 3/3" + auto-move text

### **Test 6: Lead Details Display**
1. Lead with 2 "Not Picking Call" attempts
2. Open Lead Details modal
3. **Expected**: Shows "Not Picking Call Attempts: 2/3"

---

## 📈 Benefits

### **For Sales Members**
- ✅ Clear visibility into attempt count
- ✅ Automatic status conversion (no manual action)
- ✅ No need to remember previous attempts
- ✅ Visual badges in timeline for quick reference
- ✅ Prevents wasting time on non-responsive leads

### **For Super Admin**
- ✅ Complete control via settings
- ✅ Can adjust max attempts anytime
- ✅ Can enable/disable auto-conversion
- ✅ Changes apply immediately
- ✅ No code changes required
- ✅ Audit trail in timeline

### **For Business**
- ✅ Enforces consistent follow-up policy
- ✅ Prevents endless "Not Picking Call" loops
- ✅ Improves lead qualification efficiency
- ✅ Reduces time wasted on unresponsive leads
- ✅ Data-driven decision making (attempt metrics)

---

## 🔄 Data Migration

### **Existing Leads**

**No migration needed!**
- Field `notPickingAttempts` defaults to 0 if undefined
- Code handles `leadData.notPickingAttempts || 0`
- Existing leads work without modification
- Counter starts from 0 on first "Not Picking Call" update

**Backward Compatibility:** ✅ 100% compatible

---

## 🎓 Key Architectural Decisions

### **1. Counter Storage**
**Decision**: Store in lead document (not separate collection)
**Reason**: 
- Atomic updates with status
- No additional queries needed
- Simpler data model

### **2. Reset Logic**
**Decision**: Reset on ANY other status (not just "Interested")
**Reason**:
- "Busy" indicates customer is reachable
- "Interested" means engaged
- Fresh start after any successful contact

### **3. Auto Move Default**
**Decision**: Enabled by default
**Reason**:
- Prevents accidental infinite loops
- Encourages lead qualification
- Can be disabled if needed

### **4. History Metadata**
**Decision**: Store `attemptCount` and `maxAttempts` in history entry
**Reason**:
- Timeline shows exact attempt number
- Historical record of settings at that time
- Visual badges in UI

### **5. Block vs Warning**
**Decision**: Block update when max reached (if auto-move off)
**Reason**:
- Forces intentional decision
- Prevents accidental bypassing
- Clear error message guides user

---

## 📚 Related Settings

### **Settings That Work Together**

1. **maxNotPickingAttempts** + **autoMoveNotInterested**
   - Control the "Not Picking Call" lifecycle
   - Work in tandem for complete policy

2. **reminderAfterMinutes** (for "Busy" status)
   - Reminder after 60 minutes (configurable)
   - Separate from "Not Picking Call" 4-hour reminder

3. **maxReminderCount** (for general reminders)
   - Different from Not Picking Call attempts
   - Controls follow-up reminder frequency

---

## ✅ Verification Checklist

### **Code Quality**
- ✅ No hardcoded max attempts value
- ✅ No hardcoded auto-move behavior
- ✅ All settings read from `CRM_CONFIG`
- ✅ Defensive coding (`|| 0`, `?? true`)
- ✅ Error handling in place

### **User Experience**
- ✅ Clear error messages
- ✅ Visual attempt badges
- ✅ Toast notifications
- ✅ Timeline entries descriptive
- ✅ Lead details show counter

### **Settings Integration**
- ✅ Super Admin can configure
- ✅ Changes apply immediately
- ✅ Real-time propagation via onSnapshot
- ✅ Read-only for Admin/Member

### **Backward Compatibility**
- ✅ Existing leads work without migration
- ✅ Default values handle undefined fields
- ✅ No breaking changes

---

## 🚀 Production Readiness

**Status**: ✅ **READY FOR PRODUCTION**

| Aspect | Status |
|--------|--------|
| Settings-Driven | ✅ Complete |
| Attempt Tracking | ✅ Working |
| Auto-Move Logic | ✅ Tested |
| Block Logic | ✅ Tested |
| Timeline Display | ✅ Enhanced |
| Lead Details | ✅ Enhanced |
| History Badges | ✅ Implemented |
| Error Handling | ✅ In Place |
| Backward Compatible | ✅ Yes |
| Documentation | ✅ Complete |

---

## 📞 Quick Reference

### **For Sales Members**

**Q: How many "Not Picking Call" attempts do I get?**
A: Check your dashboard - default is 3, but Super Admin controls this

**Q: What happens at max attempts?**
A: Usually auto-converts to "Not Interested" (configurable by admin)

**Q: How do I see attempt count?**
A: Open lead details or check history timeline (badges show X/Y)

**Q: Can I reset the counter?**
A: Yes - any other status update resets it (e.g., "Busy", "Interested")

---

### **For Super Admin**

**Q: Where do I configure this?**
A: CRM Settings → "Not Picking Call Rule" section

**Q: What's the recommended max?**
A: 3 attempts (default) - balance between persistence and efficiency

**Q: Should I enable auto-move?**
A: Yes (recommended) - prevents endless "Not Picking Call" loops

**Q: Can I change settings mid-day?**
A: Yes - changes apply immediately to all users

**Q: Will existing leads break?**
A: No - backward compatible, counter starts from 0

---

## 📖 Summary

The "Not Picking Call" feature is now **100% settings-driven** with intelligent attempt tracking, visual indicators, and automatic status conversion. Super Admin has complete control over behavior via CRM Settings, and all changes propagate in real-time without code modifications.

**Implementation Date**: January 2026  
**Status**: ✅ Production Ready  
**Zero Breaking Changes**: Yes  
**Backward Compatible**: 100%
