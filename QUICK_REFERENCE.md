# Quick Reference Card

## 🎯 For Sales Members

### **Not Picking Call - New Behavior**

**Before**: Unlimited attempts  
**Now**: Maximum attempts (usually 3)

#### **What You'll See**
```
Update 1 → "Not Picking Call" ✅ Saved (Attempt 1/3)
Update 2 → "Not Picking Call" ✅ Saved (Attempt 2/3)
Update 3 → "Not Picking Call" ✅ Auto-changed to "Not Interested"
```

#### **In Lead History**
- ⚠️ Yellow badge: Attempt 1/3, 2/3
- 🔴 Red badge: Attempt 3/3 (auto-moved)
- Clear text: "Automatically moved to 'Not Interested' per CRM Settings"

#### **How to Reset Counter**
Change to any other status:
- "Busy" → Counter resets to 0
- "Interested" → Counter resets to 0
- Then "Not Picking Call" starts fresh at 1/3

#### **Where to See Counter**
1. Lead Details (👁 View) → "Not Picking Call Attempts: 2/3"
2. History Timeline → Badges show "Attempt X/Y"

---

### **Leave Application - New Feature**

#### **How to Apply**
1. Navigation → **Leave Management**
2. Click **Apply for Leave**
3. Select:
   - Leave Type (Full Day, Half Day Morning, etc.)
   - Date (or date range for Multiple Days)
   - Reason
4. Submit → Status = **Pending**

#### **Leave Types**
| Type | Effect |
|------|--------|
| Full Day | Unavailable all day |
| Half Day Morning | Unavailable before lunch |
| Half Day Afternoon | Unavailable after lunch |
| Multiple Days | Unavailable for date range |
| Work From Home | Available (receive leads) |

#### **Track Your Requests**
- **Pending**: Yellow badge - awaiting approval
- **Approved**: Green badge - you're unavailable
- **Rejected**: Red badge - you remain available

#### **Cancel Pending Request**
- View your requests
- Click "Cancel" on pending items
- Status changes to Cancelled

---

## 🎛️ For Super Admin

### **CRM Settings - Your Control Panel**

#### **Working Schedule**
```
☑ Working Days: Mon-Sat (uncheck for closed days)
⏰ Office Hours: 09:00 - 18:00
☕ Breaks: Add unlimited (Lunch, Tea, etc.)
🗓️ Holidays: Add recurring or one-time
```

#### **Not Picking Call Rule**
```
Max Attempts: [3] ▼ (1-20 range)
☑ Auto Move to Not Interested
   → Enabled: Auto-converts at max
   → Disabled: Blocks and shows error
```

#### **Assignment Rules**
```
Assignment Interval: 30 min (gradual dispatch)
Lunch Boundary: 13:00 (half-day split)
Reminder After: 30 min (for "Busy")
Max Reminders: 5
```

#### **Leave Management**
```
4 Tabs:
├─ Pending Requests (badge shows count)
├─ Approved Leaves
├─ Rejected Leaves
└─ All Leaves

Actions:
├─ ✅ Approve → Member unavailable
├─ ❌ Reject → Member remains available
└─ 👁 View → See details
```

---

## 📊 Dashboard Metrics

### **Team Availability Cards (New)**

```
┌─────────────────┬─────────────────┬─────────────────┐
│ Working Today   │ On Leave Today  │ Available Now   │
│      8          │       2         │       6         │
└─────────────────┴─────────────────┴─────────────────┘
```

**Working Today**: Not on full-day leave  
**On Leave Today**: All leave types  
**Available Now**: Real-time check (most important)

### **Assignment Status**
```
Pending Assignment: Waiting for office hours/holiday
In Queue: Gradual dispatch (per interval setting)
```

---

## ⚡ Quick Actions

### **Change Max Attempts**
1. CRM Settings → "Not Picking Call Rule"
2. Change number (1-20)
3. Save → Applies immediately

### **Disable Auto-Move**
1. CRM Settings → "Auto Status Rules"
2. Uncheck "Auto Move to Not Interested"
3. Save → Now blocks at max instead

### **Add Holiday**
1. CRM Settings → "Holidays"
2. Click "Add Holiday"
3. Fill: Name, Date, Type
4. Check "Recurring" if annual
5. Save → No assignment on this date

### **Approve Leave**
1. Leave Management → "Pending Requests" tab
2. Review: Employee, Date, Type, Reason
3. Click ✅ **Approve**
4. Notification sent to employee

---

## 🔍 Troubleshooting

### **Problem**: Max attempts not working
**Check**: CRM Settings loaded? See console
**Fix**: Refresh page, verify settings saved

### **Problem**: Auto-move not happening
**Check**: Is "Auto Move" enabled in settings?
**Fix**: CRM Settings → Enable checkbox → Save

### **Problem**: Counter shows wrong max
**Check**: Was max changed recently?
**Fix**: New max applies immediately (check settings)

### **Problem**: Leave not blocking assignment
**Check**: Is leave status "Approved"?
**Fix**: Only approved leaves affect assignment

---

## 📚 Documentation Index

| Topic | Document |
|-------|----------|
| Complete technical spec | `LEAVE_MANAGEMENT_IMPLEMENTATION.md` |
| Requirement verification | `IMPLEMENTATION_VERIFICATION.md` |
| Super Admin guide | `SUPER_ADMIN_GUIDE.md` |
| Not Picking Call spec | `NOT_PICKING_CALL_IMPLEMENTATION.md` |
| Testing instructions | `TESTING_GUIDE_NOT_PICKING_CALL.md` |
| Overall summary | `IMPLEMENTATION_SUMMARY.md` |
| This card | `QUICK_REFERENCE.md` |

---

## 🎯 Key Takeaways

### **Everything is Settings-Driven**
- No hardcoded business rules
- Super Admin controls everything
- Changes apply immediately
- No code changes needed

### **Three Major Features**
1. **Smart Assignment** - Fully configurable
2. **Leave Management** - Approval workflow
3. **Not Picking Call** - Intelligent limits

### **Zero Breaking Changes**
- Existing leads work
- Existing campaigns work
- No migration needed
- Backward compatible

---

## 📞 Quick Contacts

**For Settings Questions**: Super Admin  
**For Technical Issues**: Check console, review docs  
**For Feature Requests**: Document and discuss with team

---

**Last Updated**: January 2026  
**Version**: 2.0 (Settings-Driven)  
**Print This**: Keep at your desk for quick reference
