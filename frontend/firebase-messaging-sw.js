// firebase-messaging-sw.js (use compat version)
importScripts("https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js");

// Initialize the Firebase app in the service worker by passing config (same as product.html)
firebase.initializeApp({
  apiKey: "AIzaSyCQCNF4VysLczP6DropCtDRv_UtgVbacLU",
  authDomain: "price-tracker-5b9dd.firebaseapp.com",
  projectId: "price-tracker-5b9dd",
  storageBucket: "price-tracker-5b9dd.firebasestorage.app",
  messagingSenderId: "665235138",
  appId: "1:665235138:web:f5ef61e7620950f470555b"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log("[firebase-messaging-sw.js] Received background message ", payload);
  const notificationTitle = payload.notification?.title || "Price Alert";
  const notificationOptions = {
    body: payload.notification?.body || "",
    icon: payload.notification?.image || "/images/Amazon_logo.png",
    data: payload.data || {}
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
