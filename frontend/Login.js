// 🔥 FINAL LOGIN + LOGOUT + EMAIL SAVE SCRIPT

import { auth } from "./firebase/config.js";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

/* ----------------------------------------------------
   GOOGLE SIGN-IN
----------------------------------------------------- */
const googleBtn = document.getElementById('googleSignInBtn');

if (googleBtn) {
  googleBtn.addEventListener('click', async (e) => {
    e.preventDefault();

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      await signOut(auth); // Clear old session
      const result = await signInWithPopup(auth, provider);

      // 🔥 Save email for Gmail notifications
      localStorage.setItem("user_email", result.user.email);

      alert("Google Sign-In Successful! Welcome: " + result.user.displayName);
      window.location.href = "homePage.html";
    } catch (error) {
      alert(error.message);
    }
  });
}

/* ----------------------------------------------------
   EMAIL + PASSWORD LOGIN
----------------------------------------------------- */
const loginBtn = document.getElementById("loginBtn");

if (loginBtn) {
  loginBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    if (googleBtn) googleBtn.disabled = true;

    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    try {
      const result = await signInWithEmailAndPassword(auth, email, password);

      // 🔥 Save email for Gmail price alerts
      localStorage.setItem("user_email", result.user.email);

      alert("Login successful!");
      window.location.href = "homePage.html";
    } catch (error) {
      alert(error.message);
    }
  });
}

/* ----------------------------------------------------
   UNIVERSAL LOGOUT BUTTON HANDLER (HomePage + Product)
----------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutBtn");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await signOut(auth);

        // 🔥 Clear stored email + push token
        localStorage.removeItem("user_email");
        localStorage.removeItem("fcmToken");

        alert("Logged out successfully!");

        // Redirect to login page
        window.location.href = "index.html"; 
      } catch (error) {
        console.error("Logout failed:", error);
        alert("Error logging out.");
      }
    });
  }
});