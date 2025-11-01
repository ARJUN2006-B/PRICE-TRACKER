import { auth } from "./firebase/config.js";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// Google Sign-In button event listener (outside login button listener)
const googleBtn = document.getElementById('googleSignInBtn');
if (googleBtn) {
  googleBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      alert("Google Sign-In Successful! Welcome: " + result.user.displayName);
      window.location.href = "profile.html"; // redirect after Google login
    } catch (error) {
      alert(error.message);
    }
  });
}

// Email/password login button event listener
document.getElementById("loginBtn").addEventListener("click", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    alert("Login successful!");
    window.location.href = "homePage.html"; // redirect after email login
  } catch (error) {
    alert(error.message);
  }
});