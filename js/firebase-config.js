// ============================================================
// FIREBASE CONFIGURATION
// ============================================================
// 1. Go to https://console.firebase.google.com
// 2. Create a project (or use an existing Abra Group project)
// 3. Enable: Authentication > Sign-in method > Email/Password
// 4. Enable: Firestore Database (start in production mode)
// 5. Project settings > General > Your apps > Web app > copy config below
// 6. Enable: Firebase Storage for call recordings
// ============================================================

(function() {
  'use strict';
  
  const firebaseConfig = {
    apiKey: "AIzaSyDVOShmPyTevg2dn26YGZc4NzPHOP8_III",
    authDomain: "crm-leads-manager-236be.firebaseapp.com",
    projectId: "crm-leads-manager-236be",
    storageBucket: "crm-leads-manager-236be.firebasestorage.app",
    messagingSenderId: "732928013180",
    appId: "1:732928013180:web:d7d568f4fac1444e35eaf9"
  };

  // Initialize Firebase
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  // Initialize services with error handling
  let auth, db, storage;
  let storageAvailable = false;
  let firestoreAvailable = false;
  let authAvailable = false;

  try {
    auth = firebase.auth();
    authAvailable = true;
  } catch (err) {
    console.error('Firebase Auth initialization error:', err);
  }

  try {
    db = firebase.firestore();
    firestoreAvailable = true;
  } catch (err) {
    console.error('Firebase Firestore initialization error:', err);
  }

  try {
    storage = firebase.storage();
    storageAvailable = true;
  } catch (err) {
    console.error('Firebase Storage initialization error:', err);
    console.warn('Firebase Storage is not available. Call recording features will be disabled.');
  }

  // Export services globally
  window.auth = auth;
  window.db = db;
  window.storage = storage;

  // Collection references
  const usersRef = firestoreAvailable ? db.collection("users") : null;
  const leadsRef = firestoreAvailable ? db.collection("leads") : null;
  const metaRef = firestoreAvailable ? db.collection("meta") : null;
  const callAuditsRef = firestoreAvailable ? db.collection("callAudits") : null;
  const notificationsRef = firestoreAvailable ? db.collection("notifications") : null;
  const assignmentQueueRef = firestoreAvailable ? db.collection("assignmentQueue") : null;
  const auditLogRef = firestoreAvailable ? db.collection("auditLog") : null;
  const leavesRef = firestoreAvailable ? db.collection("leaves") : null;

  // Firebase Storage references
  let storageRef, callRecordingsRef;
  if (storageAvailable) {
    try {
      storageRef = storage.ref();
      callRecordingsRef = storageRef.child("call-recordings");
    } catch (err) {
      console.error('Firebase Storage refs error:', err);
    }
  }

  // Export all references globally
  window.usersRef = usersRef;
  window.leadsRef = leadsRef;
  window.metaRef = metaRef;
  window.callAuditsRef = callAuditsRef;
  window.notificationsRef = notificationsRef;
  window.assignmentQueueRef = assignmentQueueRef;
  window.auditLogRef = auditLogRef;
  window.leavesRef = leavesRef;
  window.storageRef = storageRef;
  window.callRecordingsRef = callRecordingsRef;

  // Utility functions for checking service availability
  window.isStorageAvailable = function() { return storageAvailable; };
  window.isFirestoreAvailable = function() { return firestoreAvailable; };
  window.isAuthAvailable = function() { return authAvailable; };

  // Error logging helper
  window.logFirebaseError = function(context, err) {
    console.error(`Firebase Error [${context}]:`, err.code || err.message);
    if (err.code) {
      const userMessages = {
        'auth/user-not-found': 'User account not found. Contact your Super Admin.',
        'auth/wrong-password': 'Incorrect password.',
        'auth/invalid-email': 'Invalid email address.',
        'auth/too-many-requests': 'Too many attempts. Try again later or reset your password.',
        'auth/network-request-failed': 'Network error. Check your connection.',
        'storage/unauthorized': 'Storage access denied. Contact administrator.',
        'storage/quota-exceeded': 'Storage quota exceeded.',
        'firestore/unavailable': 'Database temporarily unavailable. Please try again.',
        'firestore/permission-denied': 'You do not have permission for this action.'
      };
      return userMessages[err.code] || 'An error occurred. Please try again.';
    }
    return 'An unexpected error occurred.';
  };
})();
