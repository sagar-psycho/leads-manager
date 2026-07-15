# Super Admin Guide: Settings-Driven Assignment & Leave Management

## 🎯 Quick Start

You now have **complete control** over how leads are assigned and when employees work. All business rules are configured through the CRM interface - no code changes needed.

---

## 🔧 CRM Settings (Your Control Panel)

### **Access**: Navigation → CRM Settings

### **What You Control:**

#### **1. Working Days**
Select which days your team works:
- ☑ Monday ☑ Tuesday ☑ Wednesday ☑ Thursday ☑ Friday ☑ Saturday ☐ Sunday
- **Effect**: Leads created on non-working days are queued for the next working day
- **Example**: Uncheck Saturday → No assignments on Saturdays

#### **2. Office Hours**
Set your business hours:
- **Start Time**: e.g., 09:00
- **End Time**: e.g., 18:00
- **Effect**: Leads created outside these hours wait until office opens
- **Example**: Lead at 20:00 → Assigned at 09:00 next morning

#### **3. Break Timings**
Add all your break periods:
- Morning Break: 11:00 - 11:15
- Lunch Break: 13:00 - 14:00
- Evening Break: 16:30 - 16:45
- **Effect**: No leads assigned during breaks
- **Actions**: Add Break, Delete Break

#### **4. Holidays**
Manage company holidays:
- Date: 2026-01-01
- Name: New Year
- Type: National / Regional / Company
- ☑ Recurring (every year)
- **Effect**: No assignments on holidays
- **Actions**: Add Holiday, Delete Holiday

#### **5. Assignment Rules**
Fine-tune how leads are distributed:
- **First Reminder After**: 30 minutes (after lead creation)
- **Reminder Frequency**: 30 minutes
- **Uncontacted Alert After**: 30 minutes
- **Max Reminder Count**: 5
- **Assignment Interval**: 30 minutes (gradual dispatch)
- **Lunch Start**: 13:00 (half-day boundary)

#### **6. Auto Status Rules**
Enable/disable automatic behaviors:
- ☑ Auto Move to Not Interested (after max attempts)
- ☑ Auto Follow-up Scheduling
- ☑ Auto Reminder Toasts
- ☐ Auto Escalation to Admin

---

## 👥 Leave Management (Your Approval Center)

### **Access**: Navigation → Leave Management

### **Your Interface: 4 Tabs**

#### **Tab 1: Pending Requests** (Action Required)
Shows all leave applications awaiting your approval:
- Employee name
- Date(s)
- Leave type
- Reason
- **Actions**: 
  - ✅ **Approve** → Member becomes unavailable
  - ❌ **Reject** → Member remains available

#### **Tab 2: Approved Leaves**
Historical record of approved leaves:
- View who's been approved
- Check past leave patterns
- **No actions** (already approved)

#### **Tab 3: Rejected Leaves**
Record of rejected applications:
- View rejection history
- See rejection reasons
- **No actions** (already rejected)

#### **Tab 4: All Leaves**
Complete leave history:
- All statuses combined
- Comprehensive view
- Export/reporting

---

## 🎛️ How Leave Affects Assignment

### **Leave Types & Rules**

| Leave Type | Morning Availability | Afternoon Availability | Notes |
|-----------|---------------------|----------------------|-------|
| **Full Day** | ❌ Unavailable | ❌ Unavailable | No leads assigned all day |
| **Half Day Morning** | ❌ Unavailable | ✅ Available after lunch | Lunch boundary: Your CRM Settings |
| **Half Day Afternoon** | ✅ Available before lunch | ❌ Unavailable | Lunch boundary: Your CRM Settings |
| **Multiple Days** | ❌ Unavailable | ❌ Unavailable | Entire date range |
| **Work From Home** | ✅ Available | ✅ Available | Receives leads normally |
| **Sick Leave** | ❌ Unavailable | ❌ Unavailable | No leads assigned |
| **Emergency Leave** | ❌ Unavailable | ❌ Unavailable | No leads assigned |

### **Critical Rule:**
✅ **Only APPROVED leaves block assignment**  
⚠️ Pending leaves = Employee still available  
❌ Rejected leaves = Employee still available

---

## 📊 Dashboard Overview

### **Team Availability Cards**

#### **Working Today**
- **Shows**: Members not on full-day leave
- **Calculation**: Total members - Full day leaves
- **Updates**: Real-time

#### **On Leave Today**
- **Shows**: All approved leaves (full + half + multiple days)
- **Includes**: All leave types except Work From Home
- **Updates**: Real-time

#### **Half Day Leave**
- **Shows**: Half Day Morning + Half Day Afternoon count
- **Purpose**: Quick glance at partial availability
- **Updates**: Real-time

#### **Available Now**
- **Shows**: Members available for assignment RIGHT NOW
- **Considers**: Current time, office hours, breaks, leaves
- **Most Important**: This is your real-time assignment pool
- **Updates**: Every minute

#### **Pending Assignment**
- **Shows**: Leads waiting to be assigned
- **Reasons**: Holiday, outside hours, break, no members
- **Action**: Will auto-assign when conditions met

#### **In Assignment Queue**
- **Shows**: Leads queued for gradual dispatch
- **Interval**: Your "Assignment Interval" setting
- **Purpose**: Prevent overwhelming members

---

## 🎯 Common Scenarios & Actions

### **Scenario 1: Holiday Tomorrow**
**Action**: Add holiday in CRM Settings
- Date: Tomorrow's date
- Name: "Company Event"
- Type: Company
- Save
**Result**: All leads tomorrow marked pending, assigned day after

---

### **Scenario 2: Change Office Hours**
**Action**: Modify in CRM Settings
- Office Start: 10:00 (instead of 09:00)
- Save
**Result**: Immediate effect, leads before 10:00 now pending

---

### **Scenario 3: Employee Applies Leave**
**Action**: Check Leave Management → Pending Requests
1. Review: Date, Type, Reason
2. Decide: Approve or Reject
3. Click: ✅ Approve or ❌ Reject
**Result**: 
- Approved → Employee unavailable, notification sent
- Rejected → Employee remains available, notification sent

---

### **Scenario 4: Multiple Employees on Leave**
**Example**: 
- Rahul: Full Day leave (Approved)
- Jamuna: Half Day Afternoon (Approved)
- Priya: Working

**What Happens**:
- **Morning**: Leads go to Jamuna or Priya (Rahul unavailable)
- **After Lunch**: Leads go to Priya only (Rahul + Jamuna unavailable)
- **Assignment Engine**: Automatically skips unavailable members

---

### **Scenario 5: No One Available**
**Situation**: All members on leave or outside office hours
**What Happens**:
- Lead marked "Pending Assignment"
- Reason: "No available sales members"
- Added to queue
- Auto-assigned when someone becomes available
**You See**: Pending Assignment count increases on dashboard

---

### **Scenario 6: Change Lunch Boundary**
**Current**: Lunch at 13:00
**Action**: Change to 12:30
**Effect**: 
- Half Day Morning leaves: Available from 12:30 (not 13:00)
- Half Day Afternoon leaves: Unavailable from 12:30 (not 13:00)
**Result**: Immediate - assignment engine uses new time

---

## ⚡ Pro Tips

### **Tip 1: Assignment Interval**
- **Low (10-15 min)**: Fast assignment, members may feel rushed
- **Medium (30 min)**: Balanced, recommended
- **High (45-60 min)**: Gradual, good for large lead imports

### **Tip 2: Break Management**
- Add all breaks (tea, lunch, prayers)
- Engine respects them automatically
- Members appreciate no interruptions during breaks

### **Tip 3: Leave Approval Strategy**
- Approve early (gives members certainty)
- Check dashboard "Available Now" before approving
- Ensure minimum coverage

### **Tip 4: Recurring Holidays**
- Use for national holidays (New Year, Independence Day)
- Set once, works every year
- No need to re-add annually

### **Tip 5: Monitor Dashboard**
- Check "Available Now" regularly
- If zero → investigate (leaves, holidays, hours)
- "Pending Assignment" should auto-resolve

---

## 🔒 Your Unique Powers

As Super Admin, ONLY YOU can:
1. ✅ Change CRM Settings (all other roles: read-only)
2. ✅ Approve/Reject leave requests
3. ✅ Configure working days, office hours, breaks
4. ✅ Manage holidays
5. ✅ Set assignment intervals
6. ✅ Control auto-status rules

**Note**: You don't need to apply for leave (no approval needed for you)

---

## 📞 Quick Reference: Assignment Decision Tree

```
Lead Created
    ↓
Is it a Working Day? (Your CRM Settings)
    ↓ No → Pending Assignment
    ↓ Yes
Is it Office Hours? (Your CRM Settings)
    ↓ No → Pending Assignment
    ↓ Yes
Is it a Holiday? (Your Holiday List)
    ↓ Yes → Pending Assignment
    ↓ No
Is it Break Time? (Your Break Timings)
    ↓ Yes → Pending Assignment
    ↓ No
Any Member Available? (Checks Approved Leaves)
    ↓ No → Pending Assignment
    ↓ Yes → Assign to Next Member (Round Robin)
```

---

## ✅ Best Practices

1. **Configure Once, Works Forever**
   - Set working days, office hours, breaks once
   - System respects them automatically
   - Update only when business rules change

2. **Approve Leaves Promptly**
   - Pending requests don't block assignment
   - Approve early for employee certainty
   - Ensures accurate "Available Now" count

3. **Monitor Dashboard Daily**
   - Check "Available Now" metric
   - Review "Pending Assignment" reasons
   - Ensure smooth operations

4. **Use Recurring for Annual Events**
   - National holidays
   - Company founding day
   - Regular annual closures

5. **Test Changes Safely**
   - Settings apply immediately
   - Test during low-traffic hours
   - Revert if needed (previous values visible)

---

## 🚀 Result

You now have **complete, real-time control** over:
- ✅ When leads are assigned (days, hours, breaks)
- ✅ How leads are assigned (intervals, rules)
- ✅ Who gets leads (leave management, availability)
- ✅ All without touching code

**Everything happens automatically based on your configuration.**

---

**Need Help?** Check the full implementation guide: `LEAVE_MANAGEMENT_IMPLEMENTATION.md`

**Last Updated**: January 2026
