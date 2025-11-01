import { auth } from "./firebase/config.js";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const googleBtn = document.getElementById('googleSignInBtn');
if (googleBtn) {
  googleBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      await signOut(auth); // optional, ensures clean state
      const result = await signInWithPopup(auth, provider);
      alert("Google Sign-In Successful! Welcome: " + result.user.displayName);
      window.location.href = "homePage.html";
    } catch (error) {
      alert(error.message);
    }
  });
}

document.getElementById("loginBtn").addEventListener("click", async (e) => {
  e.preventDefault();
   googleBtn.disabled = true; // prevent multiple clicks
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    alert("Login successful!");
    window.location.href = "homePage.html";
  } catch (error) {
    alert(error.message);
  }
});
