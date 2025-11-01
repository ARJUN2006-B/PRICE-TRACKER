
import { auth } from "./firebase/config.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

document.getElementById("signupBtn").addEventListener("click", async (e) => {
  e.preventDefault();
  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;
  const confirmPassword = document.getElementById("signup-confirm-password").value;

  if (password !== confirmPassword) {
    alert("Passwords do not match!");
    return;
  }

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    alert("Signup successful!");
    window.location.href = "index.html"; // redirect after signup
  } catch (error) {
    alert(error.message);
  }
});
