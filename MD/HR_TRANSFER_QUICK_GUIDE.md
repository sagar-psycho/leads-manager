# HR Transfer System - Quick Guide

## For Sales Members

### When to Use
When a lead is identified as a potential **Driver** candidate who wants to join as a driver.

### How to Create HR Transfer
1. Open the lead
2. Update status to **"Driver"**
3. Add note about why they're suitable (optional)
4. Click **Update Status**
5. ✅ Transfer request automatically created
6. You'll see: *"HR Transfer request created. Pending admin approval."*

### What Happens Next
- Admins will review your request
- If approved, the lead transfers to HR
- If rejected, you'll receive a notification with reason
- You can view the lead but cannot edit HR workflow

---

## For Admins / Super Admins

### Accessing HR Transfers
1. Click **"HR Transfers"** in sidebar
2. View dashboard with pending transfers

### One-Time Migration (First Time Only)
1. Click **"Migrate Legacy Drivers"** button
2. Confirm migration
3. Wait for completion message
4. All existing Driver leads now in HR Transfers

### Approving Transfer
1. Find transfer in "Pending Approval"
2. Click **✓ (Approve)** button
3. Confirm approval
4. System will:
   - Check office hours
   - Check HR availability
   - Check holidays and leave
   - Assign to HR OR add to pending queue
5. HR and Sales member get notified

### Rejecting Transfer
1. Find transfer in "Pending Approval"
2. Click **✗ (Reject)** button
3. Enter rejection reason
4. Confirm rejection
5. Sales member gets notified

### Viewing Details
1. Click **"View"** button on any transfer
2. See complete timeline and information

---

## Understanding Statuses

### Pending Approval
- Transfer requested but not yet reviewed
- **Action Required**: Admin needs to approve or reject

### Approved
- Transfer approved by admin
- Lead now moving to HR

### Rejected
- Transfer rejected by admin
- Lead stays with sales member
- Check rejection reason in details

### Waiting Assignment
- Transfer approved
- Waiting for HR to become available
- Reasons:
  - Outside office hours
  - Holiday
  - All HR on leave
  - No HR available right now

### Assigned to HR
- Transfer complete
- Lead now owned by HR member
- HR will handle recruitment process

---

## How Assignment Works

### Immediate Assignment (Office Hours)
```
Approve → HR Available → Assign Immediately ✅
```

### Pending Assignment (Outside Hours)
```
Approve → Outside Office Hours → Queue for Morning ⏰
```

### Holiday
```
Approve → Holiday Today → Queue for Next Working Day 📅
```

### No HR Available
```
Approve → All HR Busy/Leave → Queue Until Available 👥
```

The system automatically assigns when conditions are met. No manual intervention needed!

---

## Filters

### Status Filter
- All Status
- Pending
- Approved
- Rejected
- Waiting Assignment
- Assigned to HR

### Sales Member Filter
- Filter by who requested the transfer

### HR Member Filter
- Filter by who got assigned

### Campaign Filter
- Filter by lead campaign

### Date Filters
- From Date: Start date
- To Date: End date
- Shows transfers requested in this range

### Search
- Search by:
  - Lead number
  - Customer name
  - Phone number
  - Company name

---

## Common Questions

### Q: Who can see HR Transfers?
**A**: Only Admin and Super Admin

### Q: What happens to old Driver leads?
**A**: Run "Migrate Legacy Drivers" once. They all become transfer requests.

### Q: Can I approve outside office hours?
**A**: Yes! System will queue and auto-assign when office opens.

### Q: What if no HR users exist?
**A**: Transfers will stay in "Waiting Assignment" until HR user is created.

### Q: Can Sales member see transferred lead?
**A**: Yes, but read-only. They can view timeline and history.

### Q: How do I know when HR is assigned?
**A**: Check "Assigned to HR" status badge. HR member name shows in table.

### Q: What if I accidentally approve wrong transfer?
**A**: Contact Super Admin. They can manually reassign in leads.

### Q: Does this affect existing assignment engine?
**A**: No! Uses existing engine. No conflicts.

---

## Notifications

### You'll Get Notified When:

**Sales Member**:
- ✉️ Transfer approved
- ✉️ Transfer rejected (with reason)

**Admin/Super Admin**:
- ✉️ New transfer requested

**HR Member**:
- ✉️ New lead assigned to you

---

## Best Practices

### For Sales
1. ✅ Add detailed notes when setting Driver status
2. ✅ Include why candidate is suitable
3. ✅ Mention any special requirements
4. ⚠️ Don't change status back and forth (creates duplicate requests)

### For Admins
1. ✅ Review transfers daily
2. ✅ Provide clear rejection reasons
3. ✅ Check pending assignments regularly
4. ✅ Ensure at least one HR user is always available

### For HR
1. ✅ Check new assignments daily
2. ✅ Update interview status in lead notes
3. ✅ Keep lead history updated

---

## Troubleshooting

### Transfer not appearing?
- Refresh the page
- Check if status is actually "Driver"
- Check browser console for errors

### Approval not assigning?
- Check if it's office hours
- Check if it's a holiday
- Check if HR users exist
- Check HR leave status
- Transfer will auto-assign when conditions are met

### Can't see HR Transfers menu?
- Only Admin/Super Admin can see this
- Check your role in top-right corner

### Old Driver leads not showing?
- Run "Migrate Legacy Drivers" (once)
- Only Super Admin can run migration

---

## Support

For issues or questions:
1. Check this guide first
2. Check `HR_TRANSFER_IMPLEMENTATION_SUMMARY.md` for technical details
3. Contact system administrator

---

## Quick Reference

| Action | Who | Where |
|--------|-----|-------|
| Set Driver Status | Sales Member | Lead Details |
| View Transfers | Admin/Super Admin | HR Transfers (sidebar) |
| Approve Transfer | Admin/Super Admin | HR Transfers > Approve button |
| Reject Transfer | Admin/Super Admin | HR Transfers > Reject button |
| View Details | Admin/Super Admin | HR Transfers > View button |
| Migrate Legacy | Super Admin | HR Transfers > Migrate button |

---

**Last Updated**: July 17, 2026
**Version**: 1.0
**Status**: Production Ready ✅

