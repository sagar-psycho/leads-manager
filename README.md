# Abra Logistics — Sales CRM

A lightweight, role-based CRM for managing raw leads through to conversion, built with HTML/CSS/JS + Bootstrap 5 and Firebase (Auth + Firestore).

## 1. Setup

1. Create/open a Firebase project → console.firebase.google.com
2. **Authentication** → Sign-in method → enable **Email/Password**
3. **Firestore Database** → Create database (production mode, closest region e.g. `asia-south1` for Bengaluru)
4. **Project settings → General → Your apps → Web app** → copy the config object
5. Paste it into `js/firebase-config.js` (replace the placeholder values)
6. Deploy `firestore.rules` via Firebase Console → Firestore → Rules (paste contents in), or via Firebase CLI: `firebase deploy --only firestore:rules`
7. **Create the first Super Admin manually** (one-time, since there's no signup form):
   - Firebase Console → Authentication → Add user → `kothakulasagar2002@gmail.com` + a password
   - Firebase Console → Firestore → create collection `users` → document ID = that user's UID (copy from Authentication tab) → fields:
     ```
     name: "Sagar"
     email: "kothakulasagar2002@gmail.com"
     role: "superadmin"
     active: true
     createdAt: (timestamp, now)
     createdBy: "system"
     ```
8. Open `index.html` (host on Firebase Hosting, or any static host — GitHub Pages, Netlify, etc.)

From here on, **all Admins and Members are added from inside the app** (Manage Team, Super Admin only) — no one else can ever sign up.

## 2. File structure

```
abra-sales-crm/
├── index.html              Login page
├── forgot-password.html    Self-serve password reset (only for provisioned emails)
├── dashboard.html           Main app shell (Leads / Follow-ups / Urgent / Manage Team)
├── firestore.rules          Security rules — enforces the role permission table below
├── css/style.css
└── js/
    ├── firebase-config.js   Your Firebase project keys
    ├── auth.js              Login, logout, reset password, route guard
    ├── app.js                Shell: nav rendering, view switching, toasts
    ├── leads.js              Lead CRUD, round-robin, status/history, reminders
    └── users.js              Super Admin: add/manage team (secondary-app trick)
```

## 3. Data model

**`users/{uid}`**
`name, email, role (superadmin|admin|member), active (bool), createdBy, createdAt`

**`leads/{leadId}`**
`slNo (auto), serviceNeeded, email, fullName, phoneNumber, companyName, status, assignedTo (uid), assignedToName, createdBy, createdByName, createdAt, lastContactedAt, nextFollowUpAt, history[] ({text, statusAtTime, updatedBy, updatedByName, timestamp})`

**`meta/leadCounter`** → `{ count }` — powers auto Sl.No
**`meta/roundRobin`** → `{ lastIndex }` — powers round-robin assignment

**`deletedLeadsAudit/{id}`** — snapshot of any lead a Super Admin deletes, kept forever for accountability.

## 4. Role permission summary

| Action | Super Admin | Admin | Member |
|---|---|---|---|
| Manage team (add/role/deactivate) | ✅ | ❌ | ❌ |
| Add leads | ✅ | ✅ | ❌ |
| Edit/delete leads | ✅ | ❌ | ❌ |
| View leads | All | All | Own assigned only |
| Update status/notes | ✅ | ✅ | ✅ (own only) |
| Manage Team page | ✅ | ❌ | ❌ |

## 5. Status workflow

- **Not Open** (default on creation) → untouched 30 min → toast + Urgent Actions panel (Admin/Super Admin) and a personal nudge toast (Member)
- **Busy** → resurfaces in the Member's Follow-ups list after 1 hr
- **Not Picking Call** → resurfaces after 4 hrs
- **Interested / Not Interested / Job Seeker / Driver / Transporter** → no auto reminder, still fully editable with notes

## 6. Notes on the "secondary app" trick

Firebase's client SDK automatically signs you in as whichever user you just created with `createUserWithEmailAndPassword`. To let a Super Admin add a team member without being logged out themselves, `users.js` spins up a temporary second Firebase app instance, creates the account there, then discards that instance. No Cloud Functions or paid (Blaze) plan needed — this works entirely on the free Spark plan.

## 7. Known limitations / good next steps

- Reminders and toasts only fire while someone has the dashboard open in a browser tab (no server-side push). If you want true push notifications even when the app is closed, that would need Firebase Cloud Messaging + a Cloud Function — a natural v2 addition.
- Bulk CSV lead upload isn't included yet (you've done this pattern before in the Sales Call CRM — happy to add it here too).
- No pagination yet on the leads table — fine for hundreds of leads, worth adding if volume grows into the thousands.

## 8. Campaign Form Builder (new)

Super Admin can create/edit/delete/activate/deactivate **Campaigns** (e.g. Freight Services,
Warehousing, Sea Freight) from the new **Campaign Form Builder** sidebar item, and build a
custom lead-capture form per campaign — no code or JSON files involved, everything is done
through the CRM UI and stored in Firestore.

**Fixed system fields** — Full Name, Mobile Number, Email — always appear on every Add Lead
form and are never part of the Campaign Form Builder; they can't be edited, reordered, or
deleted.

When an Admin clicks **+ Add Lead**, they first pick a **Campaign Type**. The matching custom
fields render instantly (no page refresh) below the system fields. Selecting **General / No
Campaign** falls back to the original Service Needed / Company Name fields for backward
compatibility with the existing lead workflow.

New Firestore collections:
- `campaigns/{campaignId}` → `name, active, createdAt, updatedAt, createdBy`
- `campaignFields/{fieldId}` → `campaignId, fieldLabel, fieldType, required, placeholder, options[], displayOrder, helpText, defaultValue`

Leads created through a campaign additionally store:
- `campaignId`, `campaignName`
- `campaignData` → `{ fieldId: value }`
- `campaignFieldsMeta` → a **snapshot** of each field's label/type at the moment the lead was
  created, so editing or deleting a campaign's fields later never changes how existing leads
  display their data.

Editing a campaign's fields only affects **future** leads — existing leads keep the exact
values (and labels) they were created with. Deleting a campaign removes its field definitions
but leads already created under it keep their `campaignData` untouched.

Permissions: Super Admin manages campaigns/fields; Admins select a campaign and fill the form
when adding a lead; Members only ever see the finished lead (via the 👁 View button, which
opens a clean label/value Lead Details modal — Campaign Type, system fields, campaign details,
then assignment/status info).
