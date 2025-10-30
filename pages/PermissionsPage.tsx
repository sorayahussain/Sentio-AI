import React, { useContext, useState } from 'react';
import { AppContext } from '../App';
import Button from '../components/Button';
import Loader from '../components/Loader';

const PermissionsPage: React.FC = () => {
    const { navigateTo } = useContext(AppContext);
    const [status, setStatus] = useState<'idle' | 'pending' | 'denied'>('idle');

    const handleRequestPermissions = async () => {
        setStatus('pending');
        try {
            // Request both camera and microphone permissions
            await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            // If successful, navigate to the interview page
            navigateTo('interview');
        } catch (err) {
            console.error("Permission denied:", err);
            setStatus('denied');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-purple-900/50 p-4">
            <div className="max-w-xl w-full bg-gray-800 bg-opacity-70 rounded-2xl shadow-2xl p-8 text-center backdrop-blur-lg border border-gray-700">
                <div className="flex justify-center gap-4 mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9A2.25 2.25 0 0 0 13.5 5.25h-9A2.25 2.25 0 0 0 2.25 7.5v9A2.25 2.25 0 0 0 4.5 18.75Z" />
                    </svg>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 0 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                    </svg>
                </div>
                <h2 className="text-3xl font-bold text-white mb-3">Permissions Required</h2>
                <p className="text-gray-300 mb-8 max-w-md mx-auto">
                    To provide real-time feedback on your performance, Sentio AI needs access to your camera for emotion analysis and your microphone for speech-to-text.
                </p>

                {status === 'idle' && (
                    <Button onClick={handleRequestPermissions} className="w-full max-w-xs mx-auto">
                        Grant Permissions
                    </Button>
                )}
                
                {status === 'pending' && <Loader text="Awaiting permission..." />}

                {status === 'denied' && (
                    <div className="bg-red-900/30 p-4 rounded-lg">
                        <p className="font-semibold text-red-400">Permissions Denied</p>
                        <p className="text-red-300 text-sm mt-2">
                            You have denied access to your camera and/or microphone. You may need to grant these permissions in your browser's settings to use the core features of the app.
                        </p>
                        <div className="mt-4 flex justify-center gap-4">
                            <Button onClick={handleRequestPermissions} variant="secondary">
                                Try Again
                            </Button>
                            <Button onClick={() => navigateTo('interview')}>
                                Continue Anyway
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PermissionsPage;