import { db } from '../firebase';
// FIX: Changed from named imports to a namespace import to resolve module resolution issues.
import * as firestore from 'firebase/firestore';
import { InterviewResult } from '../types';

export const saveInterviewReport = async (userId: string, result: InterviewResult) => {
    try {
        // FIX: Prefixed firestore functions with the 'firestore' namespace.
        await firestore.addDoc(firestore.collection(db, 'users', userId, 'interviews'), {
            ...result,
            createdAt: firestore.serverTimestamp()
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
        // FIX: Prefixed firestore functions with the 'firestore' namespace.
        const q = firestore.query(firestore.collection(db, 'users', userId, 'interviews'), firestore.orderBy('createdAt', 'desc'));
        const querySnapshot = await firestore.getDocs(q);
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
        const historyCollection = firestore.collection(db, 'users', userId, 'interviews');
        const snapshot = await firestore.getDocs(historyCollection);
        
        if (snapshot.empty) return;

        const batch = firestore.writeBatch(db);
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
    } catch (error) {
        console.error("Error clearing interview history:", error);
        throw error; // Re-throw to be handled by the caller
    }
};