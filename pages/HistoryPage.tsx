import React, { useState, useEffect, useContext } from 'react';
import { AppContext } from '../App';
import { getInterviewHistory } from '../services/firebaseService';
import { InterviewResult } from '../types';
import Loader from '../components/Loader';
import Button from '../components/Button';
import { JOB_ICON, SCHOOL_ICON, CHAT_ICON } from '../constants';

const HistoryPage: React.FC = () => {
    const [history, setHistory] = useState<InterviewResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { user, showReport, navigateTo } = useContext(AppContext);

    useEffect(() => {
        const fetchHistory = async () => {
            if (user) {
                try {
                    setError(null);
                    const userHistory = await getInterviewHistory(user.uid);
                    setHistory(userHistory);
                } catch (e: any) {
                    // This error is commonly caused by incorrect Firestore security rules.
                    // See the developer note in `services/firebaseService.ts` for the fix.
                    console.error("Error fetching interview history:", e);
                     if (e.message && e.message.toLowerCase().includes("permission")) {
                        setError("Could not load history due to a permissions issue. This is likely a backend configuration problem. See the developer note in `services/firebaseService.ts` for instructions on configuring Firestore rules.");
                    } else {
                        setError("An unexpected error occurred while fetching your history.");
                    }
                }
            }
            setLoading(false);
        };
        fetchHistory();
    }, [user]);

    const getIcon = (type: string) => {
        switch (type) {
            case 'Job': return JOB_ICON;
            case 'School': return SCHOOL_ICON;
            case 'Casual': return CHAT_ICON;
            default: return CHAT_ICON;
        }
    };
    
    const calculateOverallScore = (feedback: InterviewResult['feedback']) => {
        const { clarity, confidence, engagement, answerQuality } = feedback;
        return ((clarity + confidence + engagement + answerQuality) / 4).toFixed(1);
    }

    if (loading) {
        return <div className="flex items-center justify-center min-h-screen"><Loader text="Loading History..." /></div>;
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 to-purple-900/30 p-4 sm:p-6 md:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                        Interview History
                    </h1>
                    <p className="text-gray-400 mt-2">Review your past sessions and track your progress.</p>
                </div>
                
                {error ? (
                     <div className="text-center bg-red-900/30 border border-red-500 rounded-xl p-8">
                        <h2 className="text-2xl font-bold text-red-300">Error Loading History</h2>
                        <p className="text-red-200 mt-2 mb-6 max-w-xl mx-auto">{error}</p>
                        <Button onClick={() => navigateTo('interview', 'Job')} variant="secondary">Back to Interview</Button>
                    </div>
                ) : history.length === 0 ? (
                    <div className="text-center bg-gray-800/50 border border-gray-700 rounded-xl p-8">
                        <h2 className="text-2xl font-bold">No History Found</h2>
                        <p className="text-gray-400 mt-2 mb-6">You haven't completed any interviews yet. Start practicing to see your reports here.</p>
                        <Button onClick={() => navigateTo('interview', 'Job')}>Start First Interview</Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {history.map((item) => (
                             <div key={item.id} onClick={() => showReport(item)} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 flex items-center justify-between hover:bg-gray-700/50 cursor-pointer transition-colors duration-200">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-gray-700 rounded-full">
                                        {getIcon(item.interviewType)}
                                    </div>
                                    <div>
                                        <p className="font-bold text-lg">{item.interviewType} Interview</p>
                                        <p className="text-gray-400 text-sm">
                                            {item.createdAt?.toDate ? new Date(item.createdAt.toDate()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Date not available'}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                     <p className="text-gray-400 text-sm">Overall Score</p>
                                     <p className="text-2xl font-bold text-purple-400">{calculateOverallScore(item.feedback)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                 <div className="text-center mt-8">
                    <Button onClick={() => navigateTo('interview')} variant="secondary">Back to Interview</Button>
                </div>
            </div>
        </div>
    );
};

export default HistoryPage;