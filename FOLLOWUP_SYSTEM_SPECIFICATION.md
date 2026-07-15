# Follow-up Scheduling System - Complete Specification

## 🎯 Overview

Comprehensive follow-up management system that enforces mandatory scheduling for "Call Back Later" status and provides complete tracking, reminders, and escalation.

---

## 📋 Requirements Summary

### **Core Problem**
- Sales members can select "Call Back Later" without scheduling
- Leads fall through the cracks
- No accountability or tracking

### **Solution**
- Mandatory follow-up modal when "Call Back Later" selected
- Dedicated follow-up management interface
- Automated reminders and escalation
- Complete dashboard integration
- Settings-driven validation

---

## 🔧 Technical Architecture

### **1. Data Model**

#### **Follow-up Document (Firestore Collection: `followUps`)**

```javascript
{
  id: "auto-generated",
  leadId: "lead-doc-id",
  leadSlNo: 123,
  customerName: "Rakesh Geeta",
  phoneNumber: "+1234567890",
  campaignName: "Freight Services",
  
  status: "Pending" | "Completed" | "Cancelled" | "Overdue",
  
  scheduledDate: "2026-07-15",
  scheduledTime: "15:00",
  scheduledTimestamp: Timestamp,  // For queries
  
  reminderBefore: 0 | 15 | 30 | 60,  // minutes
  reminderTimestamp: Timestamp,  // scheduledTimestamp - reminderBefore
  reminderSent: false,
  
  assignedTo: "user-id",
  assignedToName: "Jamuna Rani",
  
  createdBy: "user-id",
  createdByName: "Jamuna Rani",
  createdAt: Timestamp,
  
  completedAt: Timestamp | null,
  completedBy: "user-id" | null,
  completedByName: "name" | null,
  
  remark: "Customer requested callback after lunch",
  
  escalationLevel: 0,  // 0=none, 1=admin, 2=superadmin
  escalatedAt: Timestamp | null
}
```


#### **Lead Document Updates**

```javascript
// Add to lead document
{
  hasPendingFollowUp: boolean,
  nextFollowUpAt: Timestamp | null,
  lastFollowUpCompletedAt: Timestamp | null
}
```

---

### **2. User Flow**

#### **Flow 1: Create Follow-up**

```
1. User opens lead
2. Clicks "Update Status"
3. Selects "Call Back Later"
4. Clicks "Save"
   ↓
5. System intercepts before save
6. Opens "Schedule Follow-up" modal
7. User fills:
   - Date (required)
   - Time (required)
   - Reminder Before (default from settings)
   - Remark (required)
8. System validates:
   - Not a holiday
   - Within office hours
   - Not in the past
9. User clicks "Schedule"
   ↓
10. System creates follow-up document
11. System updates lead status
12. System adds timeline entry
13. Modal closes
14. Toast: "Follow-up scheduled for [date] at [time]"
```

#### **Flow 2: Reminder Triggered**

```
Reminder Engine (runs every minute):
1. Query follow-ups where reminderTimestamp ≤ now
2. Filter: reminderSent = false, status = "Pending"
3. For each:
   - Send browser notification (if enabled)
   - Mark reminderSent = true
   - Add to urgent actions
```


#### **Flow 3: Complete Follow-up**

```
1. User opens lead from urgent actions
2. Updates status to any other status
   OR
   Clicks "Complete Follow-up" button
   ↓
3. System updates follow-up:
   - status = "Completed"
   - completedAt = now
   - completedBy = current user
4. System updates lead:
   - hasPendingFollowUp = false
   - lastFollowUpCompletedAt = now
5. System adds timeline entry
6. Remove from urgent actions
7. Toast: "Follow-up completed"
```

---

### **3. Validation Rules**

#### **Date/Time Validation**

```javascript
async function validateFollowUpDateTime(date, time) {
  const scheduledDateTime = new Date(`${date}T${time}`);
  const now = new Date();
  
  // 1. Not in the past
  if (scheduledDateTime <= now) {
    return { valid: false, error: "Cannot schedule in the past" };
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
    return { 
      valid: false, 
      error: `${date} is a holiday (${holiday.name})` 
    };
  }
  
  // 3. Working day
  const dayOfWeek = ["Sunday","Monday","Tuesday","Wednesday",
                     "Thursday","Friday","Saturday"][scheduledDateTime.getDay()];
  const workingDays = CRM_CONFIG.workingDays || [];
  
  if (!workingDays.includes(dayOfWeek)) {
    return { 
      valid: false, 
      error: `${dayOfWeek} is not a working day`,
      suggestion: getNextWorkingDay(date)
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
      error: `Time must be between ${CRM_CONFIG.officeStart} and ${CRM_CONFIG.officeEnd}`,
      suggestion: CRM_CONFIG.officeStart
    };
  }
  
  return { valid: true };
}
```

---

## 📝 Implementation Roadmap

### **Phase 1: Core Follow-up System (Priority: HIGH)**

**Estimated Time: 3-4 hours**

#### **1.1 Database Setup**
- [ ] Create `followUps` collection structure
- [ ] Add indexes for queries
- [ ] Update Firestore rules

#### **1.2 Follow-up Modal**
- [ ] Create modal HTML in dashboard.html
- [ ] Add date/time pickers
- [ ] Add reminder dropdown
- [ ] Add remark textarea
- [ ] Style modal

#### **1.3 Status Update Interception**
- [ ] Modify `updateLeadStatus()` in leads.js
- [ ] Detect "Call Back Later" selection
- [ ] Open modal instead of saving immediately
- [ ] Save only after follow-up scheduled


#### **1.4 Validation Logic**
- [ ] Implement `validateFollowUpDateTime()`
- [ ] Holiday check
- [ ] Working day check
- [ ] Office hours check
- [ ] Past date/time check

#### **1.5 Follow-up Creation**
- [ ] `createFollowUp()` function
- [ ] Create follow-up document
- [ ] Update lead status
- [ ] Add timeline entry
- [ ] Set `hasPendingFollowUp = true`

---

### **Phase 2: Follow-up Management UI (Priority: HIGH)**

**Estimated Time: 2-3 hours**

#### **2.1 Follow-up Page**
- [ ] Create new view section in dashboard.html
- [ ] Add navigation link
- [ ] Create tab structure (Today's, Upcoming, Overdue, Completed)

#### **2.2 Follow-up List Rendering**
- [ ] Create `followup.js` module
- [ ] Subscribe to follow-ups collection
- [ ] Render follow-up cards
- [ ] Show countdown/overdue time
- [ ] Add action buttons

#### **2.3 Complete Follow-up**
- [ ] "Complete" button handler
- [ ] Update follow-up document
- [ ] Update lead document
- [ ] Add timeline entry
- [ ] Remove from urgent actions

---

### **Phase 3: Reminder Engine (Priority: MEDIUM)**

**Estimated Time: 2 hours**

#### **3.1 Reminder Checker**
- [ ] Create `checkFollowUpReminders()` function
- [ ] Query follow-ups where `reminderTimestamp ≤ now`
- [ ] Filter `reminderSent = false`
- [ ] Mark as sent after notification


#### **3.2 Browser Notifications**
- [ ] Check if enabled in CRM_CONFIG
- [ ] Request permission if not granted
- [ ] Send notification with follow-up details
- [ ] Handle notification click (open lead)

#### **3.3 Urgent Actions Integration**
- [ ] Add overdue follow-ups to urgent actions
- [ ] Show countdown timer
- [ ] Priority sorting

---

### **Phase 4: Dashboard Integration (Priority: MEDIUM)**

**Estimated Time: 1-2 hours**

#### **4.1 Dashboard Widget**
- [ ] "Today's Follow-ups" card
- [ ] Count badge
- [ ] Click to filter follow-ups page

#### **4.2 Statistics**
- [ ] Pending count
- [ ] Overdue count
- [ ] Completed today count

---

### **Phase 5: Escalation System (Priority: LOW)**

**Estimated Time: 2 hours**

#### **5.1 Escalation Logic**
- [ ] Check overdue duration
- [ ] Escalate to Admin after X minutes
- [ ] Escalate to Super Admin after Y minutes
- [ ] Read escalation timings from CRM_CONFIG

#### **5.2 Notifications**
- [ ] Notify Admin
- [ ] Notify Super Admin
- [ ] Track escalation level

---

### **Phase 6: Reports & Analytics (Priority: LOW)**

**Estimated Time: 2-3 hours**

#### **6.1 Follow-up Reports**
- [ ] Scheduled vs Completed
- [ ] Average delay
- [ ] Per member performance
- [ ] Overdue analysis


---

## 🚀 Recommended Implementation Approach

Given the scope, I recommend implementing in phases:

### **Week 1: Core Functionality (Phase 1 + 2)**
Focus on getting the basic follow-up system working:
- Mandatory modal for "Call Back Later"
- Follow-up creation with validation
- Follow-up management page
- Basic completion workflow

**Deliverables:**
- ✅ Users MUST schedule follow-up for "Call Back Later"
- ✅ Follow-ups page shows Today's/Upcoming/Overdue/Completed
- ✅ Users can complete follow-ups
- ✅ Timeline tracking works

### **Week 2: Reminders & Dashboard (Phase 3 + 4)**
Add automation and visibility:
- Reminder engine
- Browser notifications
- Dashboard integration
- Urgent actions integration

**Deliverables:**
- ✅ Reminders sent at scheduled time
- ✅ Dashboard shows follow-up count
- ✅ Overdue follow-ups in urgent actions
- ✅ Real-time updates

### **Week 3: Polish & Reports (Phase 5 + 6)**
Add advanced features:
- Escalation system
- Follow-up reports
- Performance metrics

**Deliverables:**
- ✅ Escalation to Admin/Super Admin
- ✅ Follow-up analytics
- ✅ Member performance reports

---

## 📊 Current Status

**Status**: ⚠️ **SPECIFICATION COMPLETE - READY FOR IMPLEMENTATION**

This is a significant feature requiring:
- New Firestore collection
- New UI module (followup.js)
- Modal integration
- Reminder engine
- Dashboard updates

**Estimated Total Time**: 12-15 hours for complete implementation

---

## 💡 Quick Win: Minimal Viable Product (MVP)

If you want to start with something simpler, here's a 2-hour MVP:


### **MVP: Basic Follow-up Modal**

**What it does:**
1. When "Call Back Later" selected → show modal
2. User picks date/time (basic validation)
3. Save to lead's `nextFollowUpAt` field
4. Show in existing "My Follow-ups" section

**What it doesn't do:**
- No separate follow-ups collection
- No browser notifications
- No escalation
- No dedicated page

**Time**: 2 hours
**Value**: Immediate - no more "Call Back Later" without scheduling

---

## 🎯 Decision Point

**Option A: Full Implementation (Recommended)**
- Complete follow-up management system
- All features as specified
- 12-15 hours development time
- High business value

**Option B: Phased Implementation**
- Week 1: Core (Phase 1+2) - 6 hours
- Week 2: Reminders (Phase 3+4) - 4 hours
- Week 3: Reports (Phase 5+6) - 4 hours

**Option C: MVP First**
- 2-hour basic modal
- Validate user acceptance
- Then decide on full system

---

## 📋 Next Steps

Please confirm which approach you'd like:

1. **Full implementation now** - I'll start building the complete system
2. **Phased approach** - I'll implement Phase 1+2 first
3. **MVP first** - I'll create the basic modal to validate the concept

Once confirmed, I'll proceed with implementation!

---

**Document Status**: ✅ Complete Specification  
**Implementation Status**: ⏳ Awaiting Direction  
**Estimated Effort**: 12-15 hours (full) | 6 hours (Phase 1+2) | 2 hours (MVP)
