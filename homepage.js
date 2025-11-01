import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { auth } from "./firebase/config.js";

// ✅ Check if the user is logged in
onAuthStateChanged(auth, (user) => {
  if (!user) {
    // Not logged in → redirect to login page
    window.location.href = "index.html";
  } else {
    // Show welcome message
    const welcome = document.getElementById("welcome");
    if (welcome) {
      welcome.innerText = `Welcome, ${user.displayName || user.email}!`;
    }
  }
});

// ✅ Logout button event listener
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  try {
    await signOut(auth); // Sign out the user
    alert("You’ve been logged out!");
    window.location.href = "index.html"; // Redirect to login page
  } catch (error) {
    alert("Error logging out: " + error.message);
  }
});
