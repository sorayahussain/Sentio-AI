
// FIX: Switched to Firebase Compat SDK to resolve "no exported member" errors in the current environment.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDPshKZFP7neD1yzkxugfRQWVl11Z5iv5Q",
  authDomain: "sentio-interview-app.firebaseapp.com",
  projectId: "sentio-interview-app",
  storageBucket: "sentio-interview-app.firebasestorage.app",
  messagingSenderId: "134520592401",
  appId: "1:134520592401:web:286c12de99fec0339ab9b0"
};

// Initialize Firebase
// Use compat initialization
const app = firebase.initializeApp(firebaseConfig);

// Export auth and db instances using compat API
export const auth = app.auth();
export const db = app.firestore();

export default app;
