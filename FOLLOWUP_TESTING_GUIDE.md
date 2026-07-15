# Follow-up Scheduling System - Testing Guide

## 🧪 Complete Testing Checklist

This guide provides step-by-step instructions to test all features of the Follow-up Scheduling System.

---

## ✅ Pre-Test Setup

### **1. Configure CRM Settings**

Before testing, ensure CRM Settings are properly configured:

1. Login as **Super Admin**
2. Navigate to **CRM Settings**
3. Verify the following are set:

```
Working Days: Monday - Saturday
Office Hours: 09:00 - 18:00
Break Timings:
  - Lunch Break: 13:00 - 14:00
Holidays:
  - At least one holiday configured
```

### **2. Create Test Leads**

Create 3-5 test leads with:
- Different statuses
- Assigned to yourself
- Various campaign types

---

## 🎯 Test Scenarios

### **TEST 1: Mandatory Follow-up Modal**

**Objective**: Verify "Call Back Later" requires follow-up scheduling

**Steps**:
1. Open any lead (click 👁️ View or Update button)
2. Click "Update Status"
3. Select "Call Back Later" from dropdown
4. Add note: "Customer requested callback"
5. Click "Save Update"

**Expected Result**:
- ✅ Status modal closes
- ✅ Follow-up modal opens immediately
- ✅ Modal shows customer name and phone
- ✅ Date field pre-filled with tomorrow's date
- ✅ Time field pre-filled with 10:00
- ✅ Cannot close modal by clicking outside (backdrop static)
- ✅ ESC key doesn't close modal

---

### **TEST 2: Date Validation - Past Date**

**Objective**: Verify cannot schedule in the past

**Steps**:
1. In follow-up modal (from TEST 1)
2. Change date to yesterday
3. Observe validation message

**Expected Result**:
- ❌ Red error message appears:
  ```
  ⊗ Cannot schedule follow-up in the past.
  ```
- ✅ No suggestion offered (past date)

---

### **TEST 3: Date Validation - Holiday**

**Objective**: Verify cannot schedule on holiday

**Steps**:
1. In follow-up modal
2. Change date to a configured holiday (e.g., Independence Day)
3. Observe validation message

**Expected Result**:
- ❌ Red error message appears:
  ```
  ⊗ 2026-08-15 is a holiday (Independence Day).
  → Use 2026-08-16  [Clickable suggestion]
  ```
- ✅ Click the suggestion
- ✅ Date field updates to suggested date
- ✅ Validation passes

---

### **TEST 4: Date Validation - Non-Working Day**

**Objective**: Verify cannot schedule on Sunday (if not working day)

**Steps**:
1. In follow-up modal
2. Change date to a Sunday
3. Observe validation message

**Expected Result**:
- ❌ Red error message appears:
  ```
  ⊗ Sunday is not a working day.
  → Use 2026-07-20  [Clickable suggestion]
  ```
- ✅ Click suggestion to auto-fill next working day

---

### **TEST 5: Time Validation - Outside Office Hours**

**Objective**: Verify cannot schedule before office start or after office end

**Steps**:
1. In follow-up modal
2. Set valid date (tomorrow)
3. Set time to **08:00** (before office start at 09:00)
4. Observe validation message

**Expected Result**:
- ❌ Red error message appears:
  ```
  ⊗ Time must be between 09:00 and 18:00.
  → Suggestion: 09:00
  ```

**Repeat with**:
- Time **18:30** (after office end)
- Should show same error

---

### **TEST 6: Time Validation - During Break**

**Objective**: Verify warning for break time

**Steps**:
1. In follow-up modal
2. Set valid date (tomorrow)
3. Set time to **13:15** (during lunch break 13:00-14:00)
4. Observe validation message

**Expected Result**:
- ⚠️ Yellow warning message appears:
  ```
  ⚠ Cannot schedule during break time: Lunch Break (13:00 - 14:00).
  ```
- ℹ️ Note: This is a WARNING, not an error (follows spec)

---

### **TEST 7: Successful Follow-up Creation**

**Objective**: Complete follow-up scheduling successfully

**Steps**:
1. In follow-up modal
2. Set date: Tomorrow
3. Set time: **15:00** (valid time)
4. Select contact method: **WhatsApp**
5. Select preferred time: **Afternoon**
6. Add remark: "Discuss pricing for 5 containers"
7. Click "Schedule Follow-up"

**Expected Result**:
- ✅ Green success message shown briefly
- ✅ Follow-up modal closes
- ✅ Status modal also closes
- ✅ Toast notification appears:
  ```
  Follow-up scheduled for [date] at 15:00.
  ```
- ✅ Lead status changed to "Call Back Later"
- ✅ Lead updated in table

---

### **TEST 8: Timeline Entry Created**

**Objective**: Verify timeline records follow-up

**Steps**:
1. After TEST 7, open the same lead
2. Click "History" button (🕐 icon)
3. View contact history

**Expected Result**:
- ✅ Latest entry shows:
  ```
  [Status: Call Back Later]
  [Note text if provided]
  
  📅 Follow-up scheduled:
  Date: [date] at 15:00
  Method: WhatsApp
  Preferred: Afternoon
  Remark: Discuss pricing for 5 containers
  
  Updated by: [Your Name]
  [Timestamp]
  ```

---

### **TEST 9: Dashboard KPI Cards**

**Objective**: Verify follow-up KPIs appear in dashboard

**Steps**:
1. Navigate to **Dashboard** (Admin/Super Admin only)
2. Scroll to KPI cards section
3. Locate follow-up cards

**Expected Result**:
- ✅ 10 KPI cards total (6 existing + 4 new):
  
**New Cards**:
- 📅 **Today's Follow-ups**: Shows count if any scheduled for today
- ⏰ **Due Now**: Shows count if any currently due
- ⚠️ **Overdue**: Shows count if any overdue by 15+ min
- ✅ **Completed Today**: Shows count of completed today

**Values**:
- After TEST 7, if scheduled for tomorrow → "Today's Follow-ups" = 0
- Change lead's follow-up date to today in Firestore → Count increases

---

### **TEST 10: Urgent Actions Integration**

**Objective**: Verify due follow-ups appear in Urgent Actions

**Steps**:
1. Create a follow-up scheduled for TODAY at current time - 10 minutes
2. Navigate to **Urgent Actions**
3. Verify lead appears

**Expected Result**:
- ✅ Lead appears in Urgent Actions with:
  - Priority badge (yellow/orange/red based on delay)
  - "Overdue X min" pill
  - Customer name and company
  - **Follow-up details box**:
    ```
    📅 Follow-up: [date] at [time]
    💬 Remark: Discuss pricing for 5 containers
    ```
  - All action buttons (Call, Update, AI Pitch, WhatsApp, History)

---

### **TEST 11: Auto-Cancel on Final Status**

**Objective**: Verify follow-up cancelled when moving to final status

**Steps**:
1. Open lead with pending follow-up (from TEST 7)
2. Click "Update Status"
3. Change status to **"Interested"** (final status)
4. Add note: "Customer agreed to proceed"
5. Click "Save Update"

**Expected Result**:
- ✅ Status updated to "Interested"
- ✅ Follow-up automatically cancelled
- ✅ Lead removed from Urgent Actions
- ✅ Timeline entry added:
  ```
  Follow-up Cancelled: Lead moved to "Interested" status.
  Original follow-up was scheduled for [date] at [time].
  ```

---

### **TEST 12: Cancel Follow-up Scheduling**

**Objective**: Verify cancelling modal returns to status selection

**Steps**:
1. Open any lead
2. Click "Update Status"
3. Select "Call Back Later"
4. Click "Save Update" → Follow-up modal opens
5. Click "❌ Cancel" button

**Expected Result**:
- ✅ Follow-up modal closes
- ℹ️ Status NOT saved (still original status)
- ⚠️ Note: User can re-open status modal and try again

---

### **TEST 13: Multiple Follow-ups (Edge Case)**

**Objective**: Verify only one active follow-up per lead

**Steps**:
1. Create follow-up for lead (TEST 7)
2. Open same lead again
3. Change status back to "Contacted" (clear previous)
4. Change status to "Call Back Later" again
5. Schedule new follow-up with different details

**Expected Result**:
- ✅ New follow-up overwrites previous
- ✅ Only latest follow-up stored in lead document
- ✅ Timeline shows both entries (history preserved)

---

### **TEST 14: Validation Edge Cases**

#### **A. Recursive Holiday Check**

**Setup**: Add recurring holiday (e.g., Dec 25)

**Steps**:
1. Schedule follow-up for Dec 25, 2026
2. Schedule follow-up for Dec 25, 2027

**Expected Result**:
- ❌ Both blocked with same error message
- ✅ Recurring holiday recognized across years

#### **B. Suggested Date on Non-Working Day**

**Steps**:
1. Set date to Sunday
2. Verify suggestion is Monday (not Saturday if Saturday is working day)

**Expected Result**:
- ✅ Suggestion skips all non-working days until valid day found

#### **C. Multiple Breaks**

**Steps**:
1. Try time 11:05 (if Morning Break: 11:00-11:15)
2. Try time 13:30 (if Lunch Break: 13:00-14:00)
3. Try time 16:35 (if Evening Break: 16:30-16:45)

**Expected Result**:
- ⚠️ Warning shown for each break period

---

### **TEST 15: Role-Based Display**

#### **A. Sales Member View**

**Login as**: Sales Member

**Steps**:
1. Create follow-up for own lead
2. Navigate to **Urgent Actions**

**Expected Result**:
- ✅ Shows "My Urgent Actions" title
- ✅ Only shows own urgent leads with follow-ups
- ✅ Follow-up details displayed

#### **B. Admin View**

**Login as**: Admin

**Steps**:
1. Navigate to **Dashboard**
2. Navigate to **Urgent Actions**

**Expected Result**:
- ✅ Dashboard shows all 10 KPI cards including follow-up cards
- ✅ Urgent Actions shows all team's overdue follow-ups
- ✅ Can see assigned member name in cards

---

## 🐛 Negative Test Cases

### **TEST N1: Missing Remark**

**Steps**:
1. Open follow-up modal
2. Set valid date and time
3. Leave remark field **empty**
4. Click "Schedule Follow-up"

**Expected Result**:
- ❌ Form validation fails
- ⚠️ Toast: "Please provide a remark for the follow-up."

---

### **TEST N2: Invalid Date Format**

**Steps**:
1. Manually edit date input to invalid format (browser allows this)
2. Try to submit

**Expected Result**:
- ❌ HTML5 validation prevents submission
- ℹ️ Browser shows "Please enter a valid date"

---

### **TEST N3: Network Failure During Save**

**Steps**:
1. Open DevTools → Network tab
2. Set offline mode
3. Try to schedule follow-up

**Expected Result**:
- ⚠️ Toast: "Failed to schedule follow-up. Please try again."
- ℹ️ Submit button re-enabled
- ℹ️ Modal remains open

---

## 📊 Data Verification

### **Verify in Firestore Console**

After TEST 7, check lead document:

```javascript
{
  // ... other fields ...
  
  status: "Call Back Later",
  hasPendingFollowUp: true,
  nextFollowUpAt: Timestamp(2026-07-16 15:00:00),
  
  followUp: {
    status: "Pending",
    scheduledDate: "2026-07-16",
    scheduledTime: "15:00",
    scheduledTimestamp: Timestamp(2026-07-16 15:00:00),
    contactMethod: "WhatsApp",
    preferredTime: "Afternoon",
    remark: "Discuss pricing for 5 containers",
    assignedTo: "[your-uid]",
    assignedToName: "[Your Name]",
    createdBy: "[your-uid]",
    createdByName: "[Your Name]",
    createdAt: Timestamp([now]),
    completedAt: null,
    completedBy: null,
    completedByName: null
  },
  
  history: [
    // ... previous entries ...
    {
      text: "[Note]\n\n📅 Follow-up scheduled:\nDate: 2026-07-16 at 15:00\nMethod: WhatsApp\nPreferred: Afternoon\nRemark: Discuss pricing for 5 containers",
      statusAtTime: "Call Back Later",
      updatedBy: "[your-uid]",
      updatedByName: "[Your Name]",
      timestamp: "[ISO string]",
      followUp: { /* embedded copy */ }
    }
  ]
}
```

---

## ✅ Sign-Off Checklist

Mark each when verified:

**Core Functionality**:
- [ ] TEST 1: Mandatory modal works
- [ ] TEST 2: Past date validation
- [ ] TEST 3: Holiday validation
- [ ] TEST 4: Non-working day validation
- [ ] TEST 5: Office hours validation
- [ ] TEST 6: Break time validation
- [ ] TEST 7: Successful creation
- [ ] TEST 8: Timeline entry created

**Integration**:
- [ ] TEST 9: Dashboard KPIs show counts
- [ ] TEST 10: Urgent Actions displays follow-ups
- [ ] TEST 11: Auto-cancel on final status
- [ ] TEST 12: Cancel button works

**Edge Cases**:
- [ ] TEST 13: Multiple follow-ups
- [ ] TEST 14: Validation edge cases

**Roles**:
- [ ] TEST 15A: Sales Member view
- [ ] TEST 15B: Admin view

**Negative Tests**:
- [ ] TEST N1: Missing remark
- [ ] TEST N2: Invalid format
- [ ] TEST N3: Network failure

**Data**:
- [ ] Firestore structure correct

---

## 🚀 Performance Testing

### **Load Test**

**Scenario**: 100 leads with follow-ups

**Steps**:
1. Create 100 test leads
2. Add pending follow-ups to 50 leads
3. Navigate to Dashboard
4. Navigate to Urgent Actions

**Expected Result**:
- ✅ Dashboard loads within 2 seconds
- ✅ Urgent Actions renders without lag
- ✅ No console errors
- ✅ Smooth scrolling

---

## 📝 Bug Report Template

If you find a bug, report it with:

```
**Bug Title**: [Short description]

**Severity**: Critical / High / Medium / Low

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. ...

**Expected Result**:
[What should happen]

**Actual Result**:
[What actually happened]

**Screenshots**:
[Attach if applicable]

**Browser**: [Chrome/Firefox/Safari]
**Role**: [Super Admin/Admin/Member]
**Console Errors**: [Copy from DevTools]
```

---

## ✅ Testing Complete

Once all tests pass, the Follow-up Scheduling System is **production-ready**!

**Next Steps**:
1. Train team on new workflow
2. Monitor usage for 1 week
3. Gather feedback
4. Implement Phase 2 features (notifications, reports)

---

**Document Version**: 1.0  
**Created**: January 2025  
**Purpose**: Comprehensive testing guide for Follow-up System

