
import { db } from '../firebase';
// FIX: Switched to Firebase Compat SDK imports.
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { InterviewResult } from '../types';

// FIX: Use firebase.User from compat SDK.
export const createUserProfile = async (user: firebase.User, additionalData: { firstName: string, lastName: string }) => {
    if (!user) return;
    // Create a reference to the user document with the user's UID as the document ID
    // FIX: Use compat chaining syntax `db.collection(...).doc(...)`.
    const userRef = db.collection('users').doc(user.uid);
    
    // Check if the document already exists to avoid overwriting
    const snapshot = await userRef.get();

    if (!snapshot.exists) {
        const { email } = user;
        const { firstName, lastName } = additionalData;
        try {
            // Note: We are NOT storing the password here. Firebase Auth handles that securely.
            // FIX: Use `firebase.firestore.FieldValue.serverTimestamp()` for compat SDK.
            await userRef.set({
                firstName,
                lastName,
                email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
        } catch (error) {
            console.error("Error creating user profile in Firestore: ", error);
        }
    }
};

export const saveInterviewReport = async (userId: string, result: InterviewResult) => {
    try {
        // FIX: Use compat chaining syntax `db.collection(...).add(...)`.
        await db.collection('users').doc(userId).collection('interviews').add({
            ...result,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error("Error saving interview report: ", error);
    }
};

export const getInterviewHistory = async (userId: string): Promise<InterviewResult[]> => {
    // DEVELOPER NOTE: If you see a "Missing or insufficient permissions" error in the console
    // for this function, it's because your Firestore security rules are not configured
    // to allow users to read their own data. This is a backend configuration issue.
    //
    // To fix this, go to your Firebase project -> Firestore Database -> Rules
    // and replace the default rules with the following:
    //
    // rules_version = '2';
    // service cloud.firestore {
    //   match /databases/{database}/documents {
    //     // Allow users to read and write their own documents in the 'users' collection.
    //     match /users/{userId}/{documents=**} {
    //       allow read, write: if request.auth != null && request.auth.uid == userId;
    //     }
    //   }
    // }
    //
    // This will ensure that only the authenticated user can access their own interview history.
    try {
        // FIX: Use compat chaining syntax for query.
        const q = db.collection('users').doc(userId).collection('interviews').orderBy('createdAt', 'desc');
        const querySnapshot = await q.get();
        const history: InterviewResult[] = [];
        querySnapshot.forEach((doc) => {
            history.push({ id: doc.id, ...doc.data() } as InterviewResult);
        });
        return history;
    } catch (error) {
        console.error("Error fetching interview history: ", error);
        // Re-throw the error to be handled by the calling component
        throw error;
    }
};

export const clearInterviewHistory = async (userId: string) => {
    try {
        // FIX: Use compat chaining syntax.
        const historyCollection = db.collection('users').doc(userId).collection('interviews');
        const snapshot = await historyCollection.get();
        
        if (snapshot.empty) return;

        // FIX: Use compat `db.batch()` syntax.
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
    } catch (error) {
        console.error("Error clearing interview history:", error);
        throw error; // Re-throw to be handled by the caller
    }
};
