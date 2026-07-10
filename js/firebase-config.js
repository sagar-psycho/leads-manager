// ============================================================
// FIREBASE CONFIGURATION
// ============================================================
// 1. Go to https://console.firebase.google.com
// 2. Create a project (or use an existing Abra Group project)
// 3. Enable: Authentication > Sign-in method > Email/Password
// 4. Enable: Firestore Database (start in production mode)
// 5. Project settings > General > Your apps > Web app > copy config below
// ============================================================

  const firebaseConfig = {
    apiKey: "AIzaSyDVOShmPyTevg2dn26YGZc4NzPHOP8_III",
    authDomain: "crm-leads-manager-236be.firebaseapp.com",
    projectId: "crm-leads-manager-236be",
    storageBucket: "crm-leads-manager-236be.firebasestorage.app",
    messagingSenderId: "732928013180",
    appId: "1:732928013180:web:d7d568f4fac1444e35eaf9"
  };

// Initialize Firebase (using compat SDK for simplicity with vanilla JS)
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// Collection references
const usersRef = db.collection("users");
const leadsRef = db.collection("leads");
const metaRef = db.collection("meta");
