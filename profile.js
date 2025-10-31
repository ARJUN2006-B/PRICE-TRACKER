// Example user data (replace this with actual login user data)
const user = {
  displayName: "John Doe",
  email: "johndoe@gmail.com",
  photoURL: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
};

function showProfilePopup(user) {
  document.getElementById('profilePic').src = user.photoURL || 'default.png';
  document.getElementById('profileName').textContent = user.displayName || "No Name";
  document.getElementById('profileEmail').textContent = user.email || "No Email";
  document.getElementById('profilePopup').style.display = "block";
}

function hideProfilePopup() {
  document.getElementById('profilePopup').style.display = "none";
}

// When clicking on Profile link
document.getElementById('profileNavTrigger').addEventListener('click', function (e) {
  e.preventDefault();
  const popup = document.getElementById('profilePopup');
  if (popup.style.display === "block") {
    hideProfilePopup();
  } else {
    showProfilePopup(user);
  }
});

// Optional: Hide popup when clicking outside
document.addEventListener('click', function (e) {
  const popup = document.getElementById('profilePopup');
  const trigger = document.getElementById('profileNavTrigger');
  if (!popup.contains(e.target) && e.target !== trigger) {
    hideProfilePopup();
  }
});
