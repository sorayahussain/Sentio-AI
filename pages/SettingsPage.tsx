import React, { useContext, useState } from 'react';
import { AppContext } from '../App';
import useSettings from '../hooks/useSettings';
import Button from '../components/Button';
import { AIVoice, AIPersonality } from '../types';
import { clearInterviewHistory } from '../services/firebaseService';
import { auth } from '../firebase';
import { sendPasswordResetEmail, deleteUser } from 'firebase/auth';

const SettingsPage: React.FC = () => {
    const { navigateTo, user, logout } = useContext(AppContext);
    const { settings, updateSettings } = useSettings();
    const [statusMessage, setStatusMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

    const handleSaveAISettings = (e: React.FormEvent) => {
        e.preventDefault();
        // The settings are already updated on change by the updateSettings hook.
        // This function is here to provide user feedback.
        setStatusMessage({type: 'success', text: 'AI settings saved successfully!'});
        setTimeout(() => setStatusMessage(null), 3000);
    };

    const handlePasswordReset = async () => {
        if (user?.email) {
            try {
                await sendPasswordResetEmail(auth, user.email);
                setStatusMessage({type: 'success', text: 'Password reset email sent. Please check your inbox.'});
            } catch (error) {
                console.error("Error sending password reset email:", error);
                setStatusMessage({type: 'error', text: 'Failed to send password reset email.'});
            }
        }
    };
    
    const handleClearHistory = async () => {
        if (user && window.confirm("Are you sure you want to delete all your interview history? This action cannot be undone.")) {
            try {
                await clearInterviewHistory(user.uid);
                setStatusMessage({type: 'success', text: 'Interview history cleared.'});
            } catch (error) {
                setStatusMessage({type: 'error', text: 'Failed to clear history.'});
            }
        }
    };

    const handleDeleteAccount = async () => {
        if (user && window.confirm("Are you absolutely sure you want to delete your account and all associated data? This is irreversible.")) {
           try {
               await clearInterviewHistory(user.uid); // Clear data first
               await deleteUser(user);
               // onAuthStateChanged in App.tsx will redirect to auth page
           } catch (error: any) {
               console.error("Error deleting account:", error);
               if (error.code === 'auth/requires-recent-login') {
                    setStatusMessage({ type: 'error', text: 'This is a sensitive operation. Please log out and log back in before deleting your account.' });
               } else {
                    setStatusMessage({ type: 'error', text: 'Failed to delete account.' });
               }
           }
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 to-purple-900/30 p-4 sm:p-6 md:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center mb-8">
                    <Button onClick={() => navigateTo('interview')} variant="secondary" className="p-2 !rounded-full !shadow-none mr-4">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                       </svg>
                    </Button>
                    <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                        Settings
                    </h1>
                </div>
                
                {statusMessage && (
                    <div className={`p-3 rounded-lg mb-6 text-center text-sm ${statusMessage.type === 'success' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
                        {statusMessage.text}
                    </div>
                )}
                
                <div className="space-y-8">
                    {/* AI Interviewer Settings */}
                    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                        <h2 className="text-xl font-bold mb-4">AI Interviewer Customization</h2>
                        <form onSubmit={handleSaveAISettings} className="space-y-4">
                            <div>
                                <label htmlFor="aiVoice" className="block text-sm font-medium text-gray-300 mb-1">Interviewer Voice</label>
                                <select 
                                    id="aiVoice" 
                                    value={settings.voice} 
                                    onChange={(e) => updateSettings({ voice: e.target.value as AIVoice })}
                                    className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                                >
                                    {(['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'] as AIVoice[]).map(voice => 
                                        <option key={voice} value={voice}>{voice}</option>
                                    )}
                                </select>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Interviewer Personality</label>
                                <div className="grid grid-cols-3 gap-2 rounded-lg bg-gray-700 p-1">
                                    {(['Friendly', 'Professional', 'Strict'] as AIPersonality[]).map(p => (
                                        <button 
                                            key={p} 
                                            type="button" 
                                            onClick={() => updateSettings({ personality: p })}
                                            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${settings.personality === p ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="text-right">
                                <Button type="submit">Save AI Settings</Button>
                            </div>
                        </form>
                    </div>

                    {/* Account Settings */}
                    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                         <h2 className="text-xl font-bold mb-4">Account</h2>
                         <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <p className="text-gray-300">Email: <span className="font-mono text-purple-300">{user?.email}</span></p>
                                <Button onClick={logout} variant="secondary">Logout</Button>
                            </div>
                            <div className="flex justify-between items-center">
                                <p className="text-gray-300">Reset your password.</p>
                                <Button onClick={handlePasswordReset} variant="secondary">Send Reset Email</Button>
                            </div>
                         </div>
                    </div>
                    
                    {/* Data & Danger Zone */}
                    <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-6">
                        <h2 className="text-xl font-bold mb-4 text-red-300">Danger Zone</h2>
                        <div className="space-y-4">
                           <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
                                <div className="mb-2 sm:mb-0">
                                    <h3 className="font-semibold text-red-200">Clear Interview History</h3>
                                    <p className="text-sm text-red-200/80">Permanently delete all of your past interview reports.</p>
                                </div>
                                <Button onClick={handleClearHistory} variant="danger">Clear History</Button>
                           </div>
                           <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
                                <div className="mb-2 sm:mb-0">
                                    <h3 className="font-semibold text-red-200">Delete Account</h3>
                                    <p className="text-sm text-red-200/80">Permanently delete your account and all associated data.</p>
                                </div>
                                <Button onClick={handleDeleteAccount} variant="danger">Delete Account</Button>
                           </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
