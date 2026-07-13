// ============================================================
// AUTH.JS — Login, logout, forgot password
// Only users with a matching document in the "users" collection
// (created by Super Admin) are allowed into the app.
// ============================================================

function showError(elId, msg) {
  const el = document.getElementById(elId);
  if (el) {
    el.textContent = msg;
    el.classList.remove("d-none");
  }
}

function hideError(elId) {
  const el = document.getElementById(elId);
  if (el) {
    el.classList.add("d-none");
  }
}

function resetLoginBtn() {
  const btn = document.getElementById("loginBtn");
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = "Sign In";
  }
}

// ---------------- LOGIN ----------------
(function() {
  const loginForm = document.getElementById("loginForm");
  if (!loginForm) return;
  
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError("loginError");
    
    const emailEl = document.getElementById("loginEmail");
    const passwordEl = document.getElementById("loginPassword");
    const btn = document.getElementById("loginBtn");
    
    if (!emailEl || !passwordEl || !btn) {
      console.error('Login form elements not found');
      return;
    }
    
    const email = emailEl.value.trim();
    const password = passwordEl.value;
    
    // Client-side validation
    if (!email || !email.includes('@')) {
      showError("loginError", "Please enter a valid email address.");
      return;
    }
    if (!password || password.length === 0) {
      showError("loginError", "Please enter your password.");
      return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Signing in...';
    
    // Check if services are available
    if (!window.isAuthAvailable()) {
      showError("loginError", "Authentication service is temporarily unavailable. Please refresh the page.");
      resetLoginBtn();
      return;
    }
    if (!window.usersRef) {
      showError("loginError", "Database connection error. Please refresh the page.");
      resetLoginBtn();
      return;
    }
    
    try {
      const cred = await window.auth.signInWithEmailAndPassword(email, password);
      const uid = cred.user.uid;
      
      // Verify this user was provisioned by Super Admin
      const userDoc = await window.usersRef.doc(uid).get();
      
      if (!userDoc.exists) {
        await window.auth.signOut();
        showError("loginError", "This account is not authorized for the CRM. Contact your Super Admin.");
        resetLoginBtn();
        return;
      }
      
      const userData = userDoc.data();
      if (userData.active === false) {
        await window.auth.signOut();
        showError("loginError", "Your account has been deactivated. Contact your Super Admin.");
        resetLoginBtn();
        return;
      }
      
      // Store role locally for quick access, redirect to dashboard
      window.location.href = "dashboard.html";
    } catch (err) {
      console.error('Login error:', err);
      
      let msg = "Login failed. Check your email and password.";
      
      if (err.code) {
        const errorMessages = {
          'auth/user-not-found': 'Incorrect email or password.',
          'auth/wrong-password': 'Incorrect email or password.',
          'auth/invalid-credential': 'Incorrect email or password.',
          'auth/invalid-email': 'Please enter a valid email address.',
          'auth/too-many-requests': 'Too many failed attempts. Try again later or reset your password.',
          'auth/network-request-failed': 'Network error. Check your internet connection and try again.',
          'auth/user-disabled': 'This account has been disabled. Contact your Super Admin.',
          'auth/operation-not-allowed': 'Sign-in is temporarily disabled. Contact administrator.',
          'auth/popup-closed-by-user': 'Sign-in was cancelled.',
          'auth/cancelled-popup-request': 'Sign-in was cancelled.'
        };
        msg = errorMessages[err.code] || window.logFirebaseError('Login', err) || msg;
      } else if (err.message) {
        // Handle non-Firebase errors
        if (err.message.includes('password')) {
          msg = "Please enter a valid password.";
        }
      }
      
      showError("loginError", msg);
      resetLoginBtn();
    }
  });
})();

// ---------------- FORGOT PASSWORD ----------------
(function() {
  const resetForm = document.getElementById("resetForm");
  if (!resetForm) return;
  
  resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError("resetError");
    
    const emailEl = document.getElementById("resetEmail");
    const btn = document.getElementById("resetBtn");
    
    if (!emailEl || !btn) return;
    
    const email = emailEl.value.trim();
    
    if (!email || !email.includes('@')) {
      showError("resetError", "Please enter a valid email address.");
      return;
    }
    
    if (!window.isAuthAvailable() || !window.usersRef) {
      showError("resetError", "Service temporarily unavailable. Please try again later.");
      return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Checking...';
    
    try {
      // Only allow reset for emails that exist in our users collection
      const snap = await window.usersRef.where("email", "==", email).limit(1).get();
      
      if (snap.empty) {
        showError("resetError", "No CRM account found for this email. Contact your Super Admin.");
        btn.disabled = false;
        btn.innerHTML = "Send Reset Link";
        return;
      }
      
      await window.auth.sendPasswordResetEmail(email);
      
      const successEl = document.getElementById("resetSuccess");
      if (successEl) {
        successEl.classList.remove("d-none");
      }
      resetForm.classList.add("d-none");
    } catch (err) {
      console.error('Password reset error:', err);
      
      let msg = "Something went wrong. Please try again.";
      if (err.code === 'auth/user-not-found') {
        msg = "No account found with this email.";
      } else if (err.code === 'auth/network-request-failed') {
        msg = "Network error. Check your connection and try again.";
      } else if (err.code === 'auth/too-many-requests') {
        msg = "Too many requests. Please wait a moment and try again.";
      }
      
      showError("resetError", msg);
      btn.disabled = false;
      btn.innerHTML = "Send Reset Link";
    }
  });
})();

// ---------------- ROUTE GUARD (used on dashboard.html) ----------------
// Resolves with { uid, email, name, role } once confirmed, else redirects to login.
function requireAuth() {
  return new Promise((resolve, reject) => {
    // Check if auth is available
    if (!window.isAuthAvailable() || !window.usersRef) {
      console.error('Auth services not available');
      window.location.href = "index.html";
      reject(new Error('Auth services not available'));
      return;
    }
    
    window.auth.onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = "index.html";
        reject(new Error('Not authenticated'));
        return;
      }
      
      try {
        const userDoc = await window.usersRef.doc(user.uid).get();
        
        if (!userDoc.exists) {
          await window.auth.signOut();
          window.location.href = "index.html";
          reject(new Error('User not found in database'));
          return;
        }
        
        const userData = userDoc.data();
        if (userData.active === false) {
          await window.auth.signOut();
          window.location.href = "index.html";
          reject(new Error('User account is deactivated'));
          return;
        }
        
        resolve({ 
          uid: user.uid, 
          email: user.email, 
          ...userData 
        });
      } catch (err) {
        console.error('Auth state check error:', err);
        await window.auth.signOut();
        window.location.href = "index.html";
        reject(err);
      }
    });
  });
}

function logout() {
  if (window.isAuthAvailable()) {
    window.auth.signOut().then(() => {
      window.location.href = "index.html";
    }).catch(err => {
      console.error('Logout error:', err);
      // Still redirect even if signOut fails
      window.location.href = "index.html";
    });
  } else {
    window.location.href = "index.html";
  }
}
