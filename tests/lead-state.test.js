const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

(async () => {
const assignmentPath = path.join(__dirname, '..', 'js', 'assignment.js');
const source = fs.readFileSync(assignmentPath, 'utf8');

const pendingLeadDocs = [
  {
    id: 'lead-1',
    data: {
      id: 'lead-1',
      slNo: 101,
      status: 'Not Open',
      assignedTo: null,
      assignedToName: null,
      assignmentPending: true,
      assignmentRole: 'member',
      createdAt: { toMillis: () => Date.now() - 60 * 60 * 1000 }
    }
  }
];

const context = {
  console,
  window: {},
  db: {
    collection: (name) => {
      if (name === 'assignmentQueue') {
        return {
          doc: () => ({ delete: async () => {} }),
          orderBy: () => ({ get: async () => ({ empty: true, forEach: () => {} }) })
        };
      }
      if (name === 'auditLog') {
        return {
          add: async () => {}
      };
      }
      if (name === 'leaves') {
        return {
          where: () => ({
            where: () => ({
              get: async () => ({ forEach: () => {} })
            })
          })
        };
      }
      return {};
    }
  },
  firebase: {
    firestore: {
      Timestamp: {
        now: () => ({ toMillis: () => Date.now() }),
        fromDate: (date) => ({ toMillis: () => date.getTime() })
      },
      FieldValue: {
        arrayUnion: (value) => value
      }
    }
  },
  metaRef: {
    doc: () => ({
      get: async () => ({ exists: false, data: () => ({}) }),
      set: async () => {}
    })
  },
  leadsRef: {
    get: async () => ({
      empty: false,
      forEach: (callback) => pendingLeadDocs.forEach(doc => callback({ id: doc.id, data: () => doc.data }))
    }),
    doc: (id) => ({
      get: async () => ({
        exists: true,
        data: () => pendingLeadDocs.find(doc => doc.id === id)?.data || {}
      }),
      update: async (data) => {
        const lead = pendingLeadDocs.find(doc => doc.id === id);
        if (lead) Object.assign(lead.data, data);
      }
    })
  },
  CURRENT_USER: { uid: 'u1', name: 'Tester', email: 'tester@example.com' },
  DEFAULT_ASSIGNMENT_ROLE: 'member',
  ASSIGNMENT_ROLE_LABELS: { member: 'Sales Member' },
  ACTIVE_MEMBERS: [{ id: 'member-1', name: 'Member One', email: 'member1@example.com' }],
  ALL_CAMPAIGNS: [],
  toast: () => {},
  isHolidayToday: () => false,
  isOfficeHoursNow: () => true,
  isBreakTimeNow: () => false,
  refreshActiveMembers: async () => {},
  refreshActiveHR: async () => {},
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

await context.assignPendingLeads();
assert.strictEqual(pendingLeadDocs[0].data.assignedTo, 'member-1');
assert.strictEqual(pendingLeadDocs[0].data.assignmentPending, false);
assert.strictEqual(pendingLeadDocs[0].data.assignmentStatus, 'assigned');

console.log('lead-state tests passed');
})();
