// ============================================================
// AUTH.JS — Login, logout, forgot password
// Only users with a matching document in the "users" collection
// (created by Super Admin) are allowed into the app.
// ============================================================

function showError(elId, msg) {
  const el = document.getElementById(elId);
  el.textContent = msg;
  el.classList.remove("d-none");
}

function hideError(elId) {
  document.getElementById(elId).classList.add("d-none");
}

// ---------------- LOGIN ----------------
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError("loginError");
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const btn = document.getElementById("loginBtn");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Signing in...';

    try {
      const cred = await auth.signInWithEmailAndPassword(email, password);
      const uid = cred.user.uid;

      // Verify this user was provisioned by Super Admin
      const userDoc = await usersRef.doc(uid).get();
      if (!userDoc.exists) {
        await auth.signOut();
        showError("loginError", "This account is not authorized for the CRM. Contact your Super Admin.");
        resetLoginBtn();
        return;
      }
      const userData = userDoc.data();
      if (userData.active === false) {
        await auth.signOut();
        showError("loginError", "Your account has been deactivated. Contact your Super Admin.");
        resetLoginBtn();
        return;
      }

      // Store role locally for quick access, redirect to dashboard
      window.location.href = "dashboard.html";
    } catch (err) {
      console.error(err);
      let msg = "Login failed. Check your email and password.";
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        msg = "Incorrect email or password.";
      } else if (err.code === "auth/too-many-requests") {
        msg = "Too many attempts. Try again later or reset your password.";
      }
      showError("loginError", msg);
      resetLoginBtn();
    }
  });
}

function resetLoginBtn() {
  const btn = document.getElementById("loginBtn");
  btn.disabled = false;
  btn.innerHTML = "Sign In";
}

// ---------------- FORGOT PASSWORD ----------------
const resetForm = document.getElementById("resetForm");
if (resetForm) {
  resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError("resetError");
    const email = document.getElementById("resetEmail").value.trim();
    const btn = document.getElementById("resetBtn");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Checking...';

    try {
      // Only allow reset for emails that exist in our users collection
      const snap = await usersRef.where("email", "==", email).limit(1).get();
      if (snap.empty) {
        showError("resetError", "No CRM account found for this email. Contact your Super Admin.");
        btn.disabled = false;
        btn.innerHTML = "Send Reset Link";
        return;
      }
      await auth.sendPasswordResetEmail(email);
      document.getElementById("resetSuccess").classList.remove("d-none");
      resetForm.classList.add("d-none");
    } catch (err) {
      console.error(err);
      showError("resetError", "Something went wrong. Please try again.");
      btn.disabled = false;
      btn.innerHTML = "Send Reset Link";
    }
  });
}

// ---------------- ROUTE GUARD (used on dashboard.html) ----------------
// Resolves with { uid, email, name, role } once confirmed, else redirects to login.
function requireAuth() {
  return new Promise((resolve) => {
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = "index.html";
        return;
      }
      const userDoc = await usersRef.doc(user.uid).get();
      if (!userDoc.exists || userDoc.data().active === false) {
        await auth.signOut();
        window.location.href = "index.html";
        return;
      }
      resolve({ uid: user.uid, email: user.email, ...userDoc.data() });
    });
  });
}

function logout() {
  auth.signOut().then(() => (window.location.href = "index.html"));
}
