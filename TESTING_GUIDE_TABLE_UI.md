# Testing Guide: Enterprise Leads Table UI

## Quick Start Testing

### 1. Open the Application
1. Navigate to `dashboard.html` in your browser
2. Log in with your credentials
3. Navigate to the **Leads** section

### 2. Visual Inspection

**Expected Results:**
- ✅ Table has 8 columns (Sl.No, Date, Customer, Phone, Campaign, Assigned To, Status, Actions)
- ✅ No horizontal scrolling needed (columns fit on screen)
- ✅ Table header is sticky (stays at top when scrolling)
- ✅ Filter bar is sticky (stays at top when scrolling page)
- ✅ Table height is fixed around 650px
- ✅ Only table body scrolls, not entire page
- ✅ Customer names truncated at 25 chars with "..."
- ✅ Campaign names truncated at 20 chars with "..."
- ✅ Company name appears as small gray text under customer name
- ✅ Status badges are uniform height
- ✅ Action buttons are small square icons (32x32px)
- ✅ Phone numbers are clickable blue links

### 3. Test Table Preferences

**Steps:**
1. Click the **⚙️ Sliders icon** in the top-right of Leads section
2. Table Preferences modal should open

**Test Toggles:**
1. Uncheck **"Campaign"** → Campaign column should disappear
2. Check **"Campaign"** again → Column should reappear
3. Uncheck **"Assigned To"** → Assigned To column should disappear
4. Check **"Assigned To"** again → Column should reappear

**Test Table Density:**
1. Select **"Compact"** → Row padding should decrease
2. Select **"Spacious"** → Row padding should increase
3. Select **"Comfortable"** → Back to normal padding

**Test Page Size:**
1. Select **"50 leads per page"**
2. Click **"Save Preferences"**
3. Table should reload showing 50 leads
4. Pagination info should update (e.g., "Showing 1 – 50 of 250")

**Test Save & Reload:**
1. Change multiple preferences
2. Click **"Save Preferences"**
3. Refresh the page (F5)
4. Navigate back to Leads section
5. Your preferences should be restored ✅

**Test Reset:**
1. Click **"Reset to Default"**
2. All preferences should return to defaults
3. Campaign: ✅ Checked
4. Assigned To: ✅ Checked
5. Density: Comfortable
6. Page Size: 25

### 4. Test Action Buttons

**Hover over each icon button - tooltip should appear:**
1. 👁️ Eye icon → "View Details" tooltip
2. ✏️ Pencil icon → "Update Status" tooltip
3. 📞 Phone icon → "Call" tooltip
4. 💬 WhatsApp icon → "WhatsApp" tooltip
5. 🕘 Clock icon → "History" tooltip
6. 🤖 Robot icon → "AI Sales Pitch" tooltip
7. 🗑️ Trash icon → "Delete" tooltip (Super Admin only)

**Click each button:**
1. **View** → Lead Details modal opens ✅
2. **Update Status** → Status Update modal opens ✅
3. **Call** → Phone dialer opens (mobile) or prompts to call ✅
4. **WhatsApp** → WhatsApp Web opens in new tab ✅
5. **History** → Lead History modal opens ✅
6. **AI Pitch** → AI Sales Pitch modal opens ✅
7. **Delete** → Confirmation prompt, then deletes ✅

### 5. Test Truncated Text

**Long Customer Names:**
1. Find a lead with a long name (>25 characters)
2. Name should be truncated with "..."
3. Hover over name → Tooltip shows full name ✅

**Long Campaign Names:**
1. Find a lead with a long campaign name (>20 characters)
2. Name should be truncated with "..."
3. Hover over campaign → Tooltip shows full name ✅

### 6. Test Status Badges

**Not Picking Call:**
1. Find a lead with "Not Picking Call" status
2. Should show orange badge
3. Should show attempt counter below: "Attempt 2/3" ✅

**No Response:**
1. Find a lead with "No Response" status
2. Should show gray badge
3. Should show "System Generated" badge below ✅

### 7. Test Sticky Behavior

**Sticky Header:**
1. Scroll down the table
2. Column headers should stay at top ✅
3. Sl.No, Date, Customer, etc. should remain visible ✅

**Sticky Filters:**
1. Scroll down the entire page (past the Leads section)
2. Filter bar should remain visible at top ✅
3. Should be able to change filters without scrolling back ✅

### 8. Test Responsive Design

**Desktop (>768px):**
- Table should display normally
- All 8 columns visible
- Fixed column widths

**Tablet (≤768px):**
- Table might have horizontal scroll
- All features still accessible

**Mobile (<768px):**
- Table headers should be hidden
- Each lead should display as a card
- All information visible in card format
- Action buttons stacked or wrapped

**To Test:**
1. Open browser DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select different device sizes
4. Verify responsive behavior

### 9. Test Loading States

**Skeleton Loaders:**
1. Reload page or change filters
2. Should see 5 skeleton rows with shimmer animation ✅
3. Skeleton should match column count (hide Campaign/Assigned if toggled off)

### 10. Test Empty State

**No Leads:**
1. Apply filters that return no results
2. Should see inbox icon and message
3. Should see "Clear All Filters" button ✅
4. Click button → Filters clear and leads reload ✅

### 11. Test Error State

**Simulate Error:**
1. Disconnect from internet
2. Try to reload leads
3. Should see error icon and message
4. Should see "Retry" button ✅
5. Reconnect internet
6. Click Retry → Leads should load ✅

### 12. Test Pagination

**Navigation:**
1. Click **"Next"** button → Go to page 2 ✅
2. Click **"Previous"** button → Go back to page 1 ✅
3. Previous button should be disabled on page 1 ✅
4. Next button should be disabled on last page ✅

**Info Display:**
- Should show: "Showing 1 – 25 of 150 Leads" (or similar) ✅
- Should update when navigating pages ✅
- Should update when changing page size ✅

### 13. Test Filters (Existing Functionality)

**Status Filter:**
1. Select a status → Table filters ✅
2. Clear status → All leads show ✅

**Assigned Member Filter:**
1. Select a member → Table filters ✅
2. Clear member → All leads show ✅

**Campaign Filter:**
1. Select a campaign → Table filters ✅
2. Clear campaign → All leads show ✅

**Search:**
1. Type in search box → Results filter after 300ms ✅
2. Clear search → All leads show ✅

**Date Range:**
1. Select from/to dates → Table filters ✅
2. Clear dates → All leads show ✅

### 14. Test Existing Features Still Work

**View Lead Modal:**
1. Click View button (eye icon)
2. Modal opens
3. **Company** field should be visible ✅
4. **Email** field should be visible ✅
5. All other lead details visible

**Update Status:**
1. Click Update button (pencil icon)
2. Status modal opens
3. Can change status ✅
4. Can add note ✅
5. Follow-up scheduling works (if "Call Back Later") ✅

**Call Audit Workflow:**
1. Select "Not Interested" status
2. Should require call audit ✅
3. Upload audio → Pending Approval ✅

**Follow-up System:**
1. Select "Call Back Later" status
2. Follow-up modal appears ✅
3. Can schedule follow-up ✅
4. Validation works (holidays, hours, breaks) ✅

**AI Sales Pitch:**
1. Click robot icon
2. AI Pitch modal opens ✅
3. Generates pitch using AI ✅

**WhatsApp Link:**
1. Click WhatsApp icon
2. Opens WhatsApp Web with phone number pre-filled ✅

**Call Link:**
1. Click phone number link
2. Opens phone dialer (mobile) or prompts ✅

### 15. Performance Testing

**Large Datasets:**
1. Navigate to page with 100 leads (change page size to 100)
2. Should load in <2 seconds ✅
3. Scrolling should be smooth ✅
4. No lag when hovering buttons ✅

**Preference Changes:**
1. Toggle column visibility → Should be instant ✅
2. Change table density → Should be instant ✅
3. Save preferences → Should complete in <1 second ✅

### 16. Cross-Browser Testing

Test in multiple browsers:
- ✅ Google Chrome (latest)
- ✅ Mozilla Firefox (latest)
- ✅ Microsoft Edge (latest)
- ✅ Safari (if available)

**Expected: All features work consistently across browsers**

---

## Common Issues & Solutions

### Issue: Tooltips Not Showing
**Solution:** Check Bootstrap 5 is loaded. Tooltips initialize after table renders.

### Issue: Preferences Not Saving
**Solution:** Check Firestore rules allow user document updates. Check console for errors.

### Issue: Column Widths Overlapping
**Solution:** Hard refresh (Ctrl+F5) to reload CSS. Check table class is `leads-table`.

### Issue: Sticky Header Not Working
**Solution:** Check CSS loaded. Verify container has `overflow-y: auto`.

### Issue: Mobile Cards Not Showing
**Solution:** Resize browser below 768px. Check responsive CSS loaded.

---

## Checklist Summary

Copy and paste this checklist:

```
[ ] Table has 8 columns with fixed widths
[ ] No horizontal scrolling on desktop
[ ] Sticky table header works
[ ] Sticky filter bar works
[ ] Table height fixed at ~650px
[ ] Truncated text shows tooltips on hover
[ ] Company name appears as subtitle
[ ] Status badges consistent height
[ ] Attempt counter on "Not Picking Call"
[ ] System badge on "No Response"
[ ] Icon buttons are 32x32px
[ ] Phone numbers are clickable links
[ ] Table Preferences modal opens
[ ] Toggle Campaign column works
[ ] Toggle Assigned To column works
[ ] Table density changes work
[ ] Page size changes work
[ ] Preferences save to Firestore
[ ] Preferences load on refresh
[ ] Reset to defaults works
[ ] All action buttons open correct modals
[ ] Tooltips appear on button hover
[ ] View Lead shows Company & Email
[ ] Status update still works
[ ] Follow-up scheduling still works
[ ] Call audit workflow still works
[ ] AI Pitch still works
[ ] WhatsApp link works
[ ] Call link works
[ ] History modal works
[ ] Skeleton loaders animate
[ ] Empty state shows correctly
[ ] Error state shows correctly
[ ] Pagination navigation works
[ ] Pagination info displays correctly
[ ] All filters work
[ ] Search works (debounced)
[ ] Responsive design works on mobile
[ ] Performance is smooth
[ ] Cross-browser compatibility verified
```

---

## Bug Reporting Template

If you find any issues, report them using this format:

```
**Issue:** [Brief description]

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Result:**
[What should happen]

**Actual Result:**
[What actually happens]

**Browser:** [Chrome/Firefox/Edge/Safari + version]
**Device:** [Desktop/Tablet/Mobile]
**Screenshot:** [If applicable]
**Console Errors:** [Copy from DevTools console]
```

---

## Success Criteria

The implementation is successful if:

✅ **Visual**: Table looks clean and professional  
✅ **Functional**: All features work as expected  
✅ **Performance**: No lag or slowness  
✅ **Responsive**: Works on all screen sizes  
✅ **Accessible**: Keyboard and screen reader friendly  
✅ **Persistent**: Preferences save and load correctly  
✅ **Compatible**: Works in all major browsers  
✅ **Stable**: No errors in console  
✅ **Complete**: No broken existing features  

---

**Happy Testing! 🎉**

If everything passes, the Enterprise Leads Table UI is ready for production use.
