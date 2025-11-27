// FIX: Changed from incorrect namespace import to named import for 'initializeApp'.
import { initializeApp } from "firebase/app";
// FIX: Changed from incorrect namespace import to named import for 'getAuth'.
import { getAuth } from "firebase/auth";
// FIX: Changed from namespace import to named import to resolve property 'getFirestore' not existing on the namespace.
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDPshKZFP7neD1yzkxugfRQWVl11Z5iv5Q",
  authDomain: "sentio-interview-app.firebaseapp.com",
  projectId: "sentio-interview-app",
  storageBucket: "sentio-interview-app.firebasestorage.app",
  messagingSenderId: "134520592401",
  appId: "1:134520592401:web:286c12de99fec0339ab9b0"
};

// Initialize Firebase
// FIX: Call 'initializeApp' directly as a function.
const app = initializeApp(firebaseConfig);
// FIX: Call 'getAuth' directly as a function.
export const auth = getAuth(app);
// FIX: Use the named import of getFirestore directly.
export const db = getFirestore(app);
