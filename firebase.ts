import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// FIX: Changed from named import to namespace import to resolve module resolution issues.
import * as firestore from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDPshKZFP7neD1yzkxugfRQWVl11Z5iv5Q",
  authDomain: "sentio-interview-app.firebaseapp.com",
  projectId: "sentio-interview-app",
  storageBucket: "sentio-interview-app.firebasestorage.app",
  messagingSenderId: "134520592401",
  appId: "1:134520592401:web:286c12de99fec0339ab9b0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// FIX: Use the namespace to call getFirestore.
export const db = firestore.getFirestore(app);