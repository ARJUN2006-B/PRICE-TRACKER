import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCQCNF4VysLczP6DropCtDRv_UtgVbacLU",
  authDomain: "price-tracker-5b9dd.firebaseapp.com",
  projectId: "price-tracker-5b9dd",
  storageBucket: "price-tracker-5b9dd.firebasestorage.app",
  messagingSenderId: "665235138",
  appId: "1:665235138:web:f5ef61e7620950f470555b"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);