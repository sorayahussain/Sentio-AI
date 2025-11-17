import { db } from '../firebase';
// FIX: Changed from a namespace import to named imports to resolve "property does not exist" errors.
import { doc, getDoc, serverTimestamp, setDoc, addDoc, collection, query, orderBy, getDocs, writeBatch } from 'firebase/firestore';
import { InterviewResult } from '../types';
// FIX: Changed to a standard import for the User type to ensure it's resolved correctly.
import { User } from 'firebase/auth';

export const createUserProfile = async (user: User, additionalData: { firstName: string, lastName: string }) => {
    if (!user) return;
    // Create a reference to the user document with the user's UID as the document ID
    const userRef = doc(db, 'users', user.uid);
    
    // Check if the document already exists to avoid overwriting
    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) {
        const { email } = user;
        const { firstName, lastName } = additionalData;
        const timestamp = serverTimestamp();
        try {
            // Note: We are NOT storing the password here. Firebase Auth handles that securely.
            // The structure here matches the screenshot provided, minus the insecure password field.
            await setDoc(userRef, {
                firstName,
                lastName,
                email,
                createdAt: timestamp,
                updatedAt: timestamp,
            });
        } catch (error) {
            console.error("Error creating user profile in Firestore: ", error);
        }
    }
};

export const saveInterviewReport = async (userId: string, result: InterviewResult) => {
    try {
        // FIX: Prefixed firestore functions with the 'firestore' namespace.
        await addDoc(collection(db, 'users', userId, 'interviews'), {
            ...result,
            createdAt: serverTimestamp()
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
        const q = query(collection(db, 'users', userId, 'interviews'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
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
        const historyCollection = collection(db, 'users', userId, 'interviews');
        const snapshot = await getDocs(historyCollection);
        
        if (snapshot.empty) return;

        const batch = writeBatch(db);
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
    } catch (error) {
        console.error("Error clearing interview history:", error);
        throw error; // Re-throw to be handled by the caller
    }
};
