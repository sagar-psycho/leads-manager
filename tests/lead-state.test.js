const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const assignmentPath = path.join(__dirname, '..', 'js', 'assignment.js');
const source = fs.readFileSync(assignmentPath, 'utf8');

const context = {
  console,
  window: {},
  db: {
    collection: () => ({})
  },
  firebase: {
    firestore: {
      Timestamp: {
        now: () => ({}),
        fromDate: (date) => ({ toMillis: () => date.getTime() })
      },
      FieldValue: {
        arrayUnion: () => ({})
      }
    }
  },
  metaRef: { doc: () => ({}) },
  leadsRef: { doc: () => ({}) },
  CURRENT_USER: { uid: 'u1', name: 'Tester', email: 'tester@example.com' },
  DEFAULT_ASSIGNMENT_ROLE: 'member',
  ASSIGNMENT_ROLE_LABELS: { member: 'Sales Member' },
  ALL_CAMPAIGNS: [],
  toast: () => {},
  isHolidayToday: () => false,
  isOfficeHoursNow: () => true,
  isBreakTimeNow: () => false,
  getCRMSetting: (key) => ({
    'leadRules.uncontactedAlertMinutes': 30,
    'reminderAfterMinutes': 30,
    'reminderFreqMinutes': 30,
    'maxReminderCount': 5,
    'assignmentIntervalMinutes': 30,
    'toastNotifications': true
  }[key])
};

vm.createContext(context);
vm.runInContext(source, context);

const now = Date.now();
const pendingLead = {
  status: 'Not Open',
  assignedTo: 'Pending',
  assignmentPending: true,
  createdAt: { toMillis: () => now - 10 * 60 * 1000 }
};

const pendingState = context.recalculateLeadState(pendingLead);
assert.strictEqual(pendingState.isOverdue, false);
assert.strictEqual(pendingState.reminderSent, false);
assert.strictEqual(pendingState.dueTime, null);
assert.strictEqual(pendingState.nextReminder, null);

const assignedLead = {
  status: 'Not Open',
  assignedTo: 'member-1',
  assignmentPending: false,
  assignedAt: { toMillis: () => now - 40 * 60 * 1000 },
  createdAt: { toMillis: () => now - 40 * 60 * 1000 }
};
const assignedState = context.recalculateLeadState(assignedLead);
assert.strictEqual(assignedState.isOverdue, true);
assert.ok(assignedState.dueTime !== null);
assert.ok(assignedState.nextReminder !== null);

console.log('lead-state tests passed');
