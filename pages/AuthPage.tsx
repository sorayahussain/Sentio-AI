import React, { useState } from 'react';
import Button from '../components/Button';
import { auth } from '../firebase';
// FIX: Changed to namespace import to resolve module resolution issues for auth functions.
import * as authFunctions from 'firebase/auth';
import { createUserProfile } from '../services/firebaseService';

const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        await authFunctions.signInWithEmailAndPassword(auth, email, password);
      } else {
        if (!firstName.trim() || !lastName.trim()) {
            setError("Please provide your first and last name.");
            setLoading(false);
            return;
        }
        const userCredential = await authFunctions.createUserWithEmailAndPassword(auth, email, password);
        // After user is created in Auth, create their profile in Firestore
        await createUserProfile(userCredential.user, { firstName, lastName });
      }
      // The onAuthStateChanged listener in App.tsx will handle navigation
    } catch (err) {
      // FIX: Cast error to 'any' to safely access the 'code' property,
      // as the default 'AuthError' type might not expose it depending on the SDK version.
      const authError = err as any;
      // Make error message more user-friendly
      if (authError.code === 'auth/invalid-credential') {
        setError('Invalid email or password. Please try again.');
      } else if (authError.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.');
      } else {
        setError('An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-purple-900/50 p-4">
      <div className="max-w-md w-full bg-gray-800 bg-opacity-70 rounded-2xl shadow-2xl p-8 backdrop-blur-lg border border-gray-700">
        <h2 className="text-3xl font-bold text-center text-white mb-2">
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h2>
        <p className="text-center text-gray-400 mb-8">
          {isLogin ? 'Sign in to continue your journey' : 'Start your journey with Sentio'}
        </p>
        <form onSubmit={handleSubmit} className="space-y-6">
          {!isLogin && (
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                    <label htmlFor="firstName" className="text-sm font-bold text-gray-400 block mb-2">First Name</label>
                    <input type="text" id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none" placeholder="Jane" required />
                </div>
                <div className="flex-1">
                    <label htmlFor="lastName" className="text-sm font-bold text-gray-400 block mb-2">Last Name</label>
                    <input type="text" id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none" placeholder="Doe" required />
                </div>
            </div>
          )}
          <div>
            <label htmlFor="email" className="text-sm font-bold text-gray-400 block mb-2">Email Address</label>
            <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none" placeholder="you@example.com" required />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-bold text-gray-400 block mb-2">Password</label>
            <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none" placeholder="••••••••" required />
          </div>

          {error && <p className="text-red-400 text-sm text-center bg-red-900/30 p-2 rounded-md">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (isLogin ? 'Logging in...' : 'Signing up...') : (isLogin ? 'Login' : 'Sign Up')}
          </Button>
        </form>
        <p className="text-center text-gray-400 mt-6">
          {isLogin ? "Don't have an account?" : "Already have an account?"}
          <button onClick={() => { setIsLogin(!isLogin); setError(null); }} className="font-bold text-purple-400 hover:underline ml-2">
            {isLogin ? 'Sign Up' : 'Login'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
