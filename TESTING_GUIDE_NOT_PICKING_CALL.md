# Testing Guide: Not Picking Call Attempt Tracking

## 🧪 Quick Test Script

Follow this guide to verify the "Not Picking Call" attempt tracking works correctly.

---

## ✅ Pre-Test Setup

### **1. Verify CRM Settings**
1. Login as **Super Admin**
2. Navigate to **CRM Settings**
3. Locate **"Not Picking Call Rule"** section
4. Note current values:
   - Max attempts: ____ (default: 3)
   - Auto Move to Not Interested: ☑ (default: enabled)

### **2. Create Test Lead**
1. Navigate to **Leads**
2. Click **Add Lead**
3. Fill in test data:
   - Full Name: "Test Not Picking"
   - Phone: "1234567890"
   - Campaign: Any
4. Lead should be auto-assigned

---

## 🔬 Test Case 1: Auto Move Enabled (Default Behavior)

### **Objective**: Verify automatic conversion to "Not Interested" at max attempts

### **Steps:**

#### **Attempt 1/3**
1. Open the test lead
2. Click **Update Status**
3. Select: **"Not Picking Call"**
4. Add note: "First attempt - no answer"
5. Click **Save**

**Expected Results:**
- ✅ Status saved as "Not Picking Call"
- ✅ Toast: Status updated successfully
- ✅ Follow-up scheduled for 4 hours later
- ✅ No error messages

**Verification:**
- Open **Lead Details** → Should show "Not Picking Call Attempts: 1/3"
- Open **History** → Entry shows: "Not Picking Call - Attempt 1/3. Note: First attempt - no answer"
- Check badge: ⚠️ Yellow "Attempt 1/3"

---

#### **Attempt 2/3**
1. Open the same lead again
2. Click **Update Status**
3. Select: **"Not Picking Call"**
4. Add note: "Second attempt - still no answer"
5. Click **Save**

**Expected Results:**
- ✅ Status saved as "Not Picking Call"
- ✅ Counter increments to 2/3
- ✅ Follow-up scheduled for 4 hours later

**Verification:**
- Lead Details → "Not Picking Call Attempts: 2/3"
- History → Entry shows: "Not Picking Call - Attempt 2/3. Note: Second attempt..."
- Badge: ⚠️ Yellow "Attempt 2/3"

---

#### **Attempt 3/3 (Max Reached)**
1. Open the same lead again
2. Click **Update Status**
3. Select: **"Not Picking Call"**
4. Add note: "Third attempt - giving up"
5. Click **Save**

**Expected Results:**
- ✅ **Status automatically changes to "Not Interested"**
- ✅ Toast: "Lead automatically moved to 'Not Interested' after 3 attempts."
- ✅ No follow-up scheduled (status is final)
- ✅ Counter: 3/3 (final)

**Verification:**
- Lead Details → Status shows **"Not Interested"**
- Lead Details → "Not Picking Call Attempts: 3/3"
- History → Entry shows: "Not Picking Call - Attempt 3/3. Automatically moved to 'Not Interested' per CRM Settings. Note: Third attempt..."
- Badge: 🔴 Red "Attempt 3/3"
- Status badge in leads table: "Not Interested"

**✅ TEST PASSED** if all expected results match

---

## 🔬 Test Case 2: Auto Move Disabled

### **Objective**: Verify blocking behavior when auto-move is off

### **Steps:**

#### **Setup: Disable Auto Move**
1. Login as **Super Admin**
2. Navigate to **CRM Settings**
3. Locate **"Auto Status Rules"**
4. Uncheck: ☐ **"Auto Move to Not Interested"**
5. Click **Save All Settings**
6. Confirm: Toast shows "Settings saved"

#### **Create New Test Lead**
- Follow "Create Test Lead" steps above
- Name: "Test Blocking"

#### **Attempt 1/3 and 2/3**
- Follow same steps as Test Case 1
- Should work normally (no difference)

#### **Attempt 3/3 (Max Reached - Blocking Test)**
1. Open the lead
2. Click **Update Status**
3. Select: **"Not Picking Call"**
4. Add note: "Third attempt"
5. Click **Save**

**Expected Results:**
- ❌ **Update BLOCKED**
- ❌ Toast (red): "Maximum 'Not Picking Call' attempts (3) reached. Please select another status or contact admin."
- ❌ Status does NOT change
- ❌ Counter stays at 2/3
- ❌ No new history entry

**Verification:**
- Lead Details → Status shows **previous status** (not "Not Picking Call")
- Lead Details → "Not Picking Call Attempts: 2/3" (unchanged)
- History → **No new entry** for 3rd attempt
- Modal stays open (update rejected)

**✅ TEST PASSED** if update is blocked with error message

#### **Manual Resolution**
1. Still in Update Status modal
2. Select: **"Not Interested"** (manually)
3. Add note: "Manually marked after 3 attempts"
4. Click **Save**

**Expected Results:**
- ✅ Status saved as "Not Interested"
- ✅ Counter **resets to 0** (different status)
- ✅ History entry created normally

**✅ TEST PASSED** if manual status change works

#### **Cleanup: Re-enable Auto Move**
1. CRM Settings → Check: ☑ "Auto Move to Not Interested"
2. Save settings

---

## 🔬 Test Case 3: Counter Reset

### **Objective**: Verify counter resets when status changes to something other than "Not Picking Call"

### **Steps:**

#### **Setup**
- Create new test lead: "Test Reset"

#### **Build Counter**
1. Update to "Not Picking Call" (counter: 1/3)
2. Verify: Lead Details shows 1/3

#### **Change to "Busy"**
1. Open lead
2. Update Status → **"Busy"**
3. Add note: "Customer said call back later"
4. Save

**Expected Results:**
- ✅ Status saved as "Busy"
- ✅ Counter **resets to 0**
- ✅ Lead Details → Counter no longer shown (or shows 0/3)

#### **Try "Not Picking Call" Again**
1. Open lead
2. Update Status → **"Not Picking Call"**
3. Save

**Expected Results:**
- ✅ Counter starts fresh at **1/3** (not 2/3)
- ✅ History shows "Attempt 1/3"

**✅ TEST PASSED** if counter reset after "Busy" status

---

## 🔬 Test Case 4: Settings Change Mid-Flow

### **Objective**: Verify settings changes apply immediately to in-progress leads

### **Steps:**

#### **Setup**
- Create test lead: "Test Settings Change"
- Update to "Not Picking Call" twice (counter: 2/3)

#### **Change Max Attempts**
1. Super Admin → CRM Settings
2. Change "Max attempts" from 3 to **5**
3. Save settings

#### **Next Attempt**
1. Open the test lead
2. Update to "Not Picking Call" (3rd time)

**Expected Results:**
- ✅ Counter shows **3/5** (new max applied)
- ✅ Badge shows "Attempt 3/5"
- ✅ Status remains "Not Picking Call" (not auto-moved)
- ✅ Follow-up scheduled

**Verification:**
- Lead Details → "Not Picking Call Attempts: 3/5"
- History → "Attempt 3/5" (new max)

#### **Reach New Max**
1. Update to "Not Picking Call" (4th time) → 4/5
2. Update to "Not Picking Call" (5th time) → **5/5**

**Expected Results:**
- ✅ 5th attempt auto-converts to "Not Interested"
- ✅ Badge shows red "Attempt 5/5"

**✅ TEST PASSED** if new max setting is respected

#### **Cleanup: Reset Max**
1. CRM Settings → Change max back to **3**
2. Save settings

---

## 🔬 Test Case 5: History Timeline Display

### **Objective**: Verify visual badges and attempt info in history

### **Steps:**

1. Create lead with full attempt cycle:
   - Attempt 1/3 → "Not Picking Call"
   - Attempt 2/3 → "Not Picking Call"
   - Attempt 3/3 → Auto-moved to "Not Interested"

2. Open **History** modal

**Expected Visual Results:**

```
┌────────────────────────────────────────────────┐
│ Entry 3 (Most Recent):                         │
│ Status: Not Interested [🔴 Attempt 3/3]        │
│ "Not Picking Call - Attempt 3/3. Automatically │
│  moved to 'Not Interested' per CRM Settings"   │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│ Entry 2:                                        │
│ Status: Not Picking Call [⚠️ Attempt 2/3]      │
│ "Not Picking Call - Attempt 2/3. Note: ..."    │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│ Entry 1:                                        │
│ Status: Not Picking Call [⚠️ Attempt 1/3]      │
│ "Not Picking Call - Attempt 1/3. Note: ..."    │
└────────────────────────────────────────────────┘
```

**Verification:**
- ✅ Badge colors: Yellow (1-2), Red (3)
- ✅ Attempt numbers: 1/3, 2/3, 3/3
- ✅ Auto-move text in 3rd entry
- ✅ Entries sorted newest first

**✅ TEST PASSED** if badges and text display correctly

---

## 🔬 Test Case 6: Lead Details Display

### **Objective**: Verify attempt counter in lead details modal

### **Steps:**

1. Create lead with 2 "Not Picking Call" attempts
2. Click **👁 View Details** button

**Expected Results:**

```
┌─────────────────────────────────────────┐
│ Lead Details                             │
├─────────────────────────────────────────┤
│ Campaign Type: General / No Campaign    │
│ ────────────────────────────────────── │
│ Full Name: Test Lead                    │
│ Mobile Number: 1234567890                │
│ ────────────────────────────────────── │
│ Assigned To: John Doe                    │
│ Status: Not Picking Call                 │
│ Not Picking Call Attempts: 2/3          │ ← THIS LINE
└─────────────────────────────────────────┘
```

**Verification:**
- ✅ Field shows: "Not Picking Call Attempts: 2/3"
- ✅ Location: After "Status" field
- ✅ Only shown when counter > 0

**✅ TEST PASSED** if counter displays in details

---

## 🔬 Test Case 7: Backward Compatibility

### **Objective**: Verify existing leads work without migration

### **Steps:**

#### **Simulate Old Lead (No Counter Field)**
1. Using browser console or Firestore UI:
   - Find any old lead
   - Confirm: `notPickingAttempts` field does NOT exist

2. Open this old lead in CRM
3. Click **Update Status**
4. Select: **"Not Picking Call"**
5. Save

**Expected Results:**
- ✅ Update works normally
- ✅ Counter initializes at **1/3** (not error)
- ✅ Field created: `notPickingAttempts: 1`
- ✅ No console errors

**✅ TEST PASSED** if old leads work without migration

---

## 📊 Test Results Summary

Use this checklist to track your testing:

| Test Case | Description | Status |
|-----------|-------------|--------|
| ☐ Case 1 | Auto Move Enabled (3 attempts) | _____ |
| ☐ Case 2 | Auto Move Disabled (blocking) | _____ |
| ☐ Case 3 | Counter Reset on "Busy" | _____ |
| ☐ Case 4 | Settings Change Mid-Flow | _____ |
| ☐ Case 5 | History Timeline Display | _____ |
| ☐ Case 6 | Lead Details Display | _____ |
| ☐ Case 7 | Backward Compatibility | _____ |

**Overall Status**: _____ (Pass/Fail)

---

## 🐛 Common Issues & Solutions

### **Issue 1: Counter Not Incrementing**
**Symptom**: Counter stays at 1/3 for multiple attempts

**Check:**
- Is `getCRMSetting()` function available?
- Are CRM Settings loaded? (Check console)
- Is `notPickingAttempts` field being updated in Firestore?

**Solution**: Ensure settings are subscribed before leads module loads

---

### **Issue 2: Auto-Move Not Working**
**Symptom**: 3rd attempt doesn't auto-convert

**Check:**
- Is "Auto Move to Not Interested" enabled in settings?
- Is max set to 3 (or current attempt at max)?
- Check console for error messages

**Solution**: Verify `autoMoveNotInterested` setting value

---

### **Issue 3: Badges Not Showing**
**Symptom**: No attempt badges in history

**Check:**
- Are `attemptCount` and `maxAttempts` in history entry?
- Check browser console for rendering errors

**Solution**: Ensure history entries include metadata

---

## ✅ Sign-Off

**Tester Name**: _____________________  
**Date**: _____________________  
**Environment**: _____________________ (Dev/Staging/Prod)  
**Result**: ☐ All Tests Passed  ☐ Issues Found (see notes)

**Notes**:
_______________________________________________
_______________________________________________
_______________________________________________

---

**Test Duration**: ~15-20 minutes  
**Recommended Frequency**: Before production deploy, after settings changes  
**Last Updated**: January 2026
