



import React, { useState, useRef, useContext, useEffect, useCallback } from 'react';
import useFaceApi from '../../hooks/useFaceApi';
import useSpeechRecognition from '../../hooks/useSpeechRecognition';
import useSettings from '../../hooks/useSettings';
import { generateQuestion, evaluatePerformance, textToSpeech } from '../../services/geminiService';
import { playAudio, resumeAudioContext } from '../../services/audioService';
import { saveInterviewReport } from '../../services/firebaseService';
import { AppContext } from '../../App';
// FIX: Import AppContextType to use for type assertion on useContext.
import { InterviewTurn, InterviewResult, InterviewType, AppContextType } from '../../types';
import Button from '../../components/Button';
import Loader from '../../components/Loader';
import { JOB_ICON, SCHOOL_ICON, CHAT_ICON, HISTORY_ICON, SETTINGS_ICON, LOGOUT_ICON, MIC_ICON, AI_INTERVIEWER_ICON } from '../../constants';

// Helper component for the progress bars in the analysis panel
const ExpressionBar: React.FC<{ label: string; value: number; colorClass?: string }> = ({ label, value, colorClass = "bg-purple-500" }) => (
    <div className="flex items-center justify-between text-sm mb-3">
        <span className="text-gray-400 w-20">{label}</span>
        <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden mx-3">
            <div 
                className={`h-full rounded-full transition-all duration-500 ease-out ${colorClass}`}
                style={{ width: `${Math.min(Math.max(value * 100, 5), 100)}%` }} // Min 5% for visibility
            ></div>
        </div>
    </div>
);

const InterviewPage: React.FC = () => {
  // FIX: Use a type assertion to resolve a type inference failure caused by a circular module dependency.
  const { interviewType, navigateTo, showReport, user, logout } = useContext(AppContext) as AppContextType;
  // Differentiate between just having the camera on (monitoring) vs actually being in an interview active state
  const [status, setStatus] = useState<'idle' | 'starting' | 'listening' | 'thinking' | 'speaking' | 'ending'>('idle');
  const [interviewLog, setInterviewLog] = useState<InterviewTurn[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [jobContext, setJobContext] = useState('');
  const [cameraAccess, setCameraAccess] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(300); 
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const { settings } = useSettings();

  const { transcript, startListening, stopListening, clearTranscript } = useSpeechRecognition();
  // Run FaceAPI whenever camera is granted, so user can see preview before starting
  const { modelsLoaded, emotions, isLoadingModels, getEmotionHistory, modelError } = useFaceApi(videoRef, cameraAccess === 'granted');

  const enableCamera = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          setMediaStream(stream);
          setCameraAccess('granted');
      // FIX: Removed incorrect arrow function syntax from a `catch` block. The `catch (err) => {` syntax is invalid; it should be `catch (err) {`. This single syntax error was the root cause of all subsequent "Cannot find name" errors in this file.
      } catch (err) {
          console.error("Camera permission failed:", err);
          setCameraAccess('denied');
      }
  };

  // Cleanup webcam on unmount
  useEffect(() => {
    return () => {
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
        }
    };
  }, [mediaStream]);

  // Attach stream to video element when it's available and play it
  useEffect(() => {
    if (cameraAccess === 'granted' && mediaStream && videoRef.current) {
      if (videoRef.current.srcObject !== mediaStream) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(e => console.error("Error playing video stream:", e));
      }
    }
  }, [cameraAccess, mediaStream]);

  const handleEndInterview = useCallback(async (finalLog: InterviewTurn[]) => {
    setStatus('ending');
    stopListening();

    if (finalLog.length === 0) {
        // If they didn't even answer one question, just reset.
        setStatus('idle');
        return;
    }
    
    const feedback = await evaluatePerformance(interviewType, finalLog, interviewType === 'Job' ? jobContext : undefined);
    const result: InterviewResult = { interviewType, log: finalLog, feedback };
    
    if (user) {
        await saveInterviewReport(user.uid, result);
    }

    showReport(result);
  }, [interviewType, jobContext, showReport, stopListening, user]);

  const askNextQuestion = useCallback(async () => {
    setStatus('thinking');
    const question = await generateQuestion(interviewType, interviewLog, settings.personality, interviewType === 'Job' ? jobContext : undefined);
    setCurrentQuestion(question);
    const audioBuffer = await textToSpeech(question, settings.voice);
    setStatus('speaking');

    const handlePlaybackEnd = () => {
        clearTranscript();
        startListening();
        setTimeRemaining(300); // Reset timer for each new question
        setStatus('listening');
    };

    if (audioBuffer) {
      playAudio(audioBuffer, handlePlaybackEnd);
    } else {
      handlePlaybackEnd();
    }
  }, [interviewType, interviewLog, jobContext, clearTranscript, startListening, settings]);

  const handleNextQuestion = useCallback((fromTimer = false) => {
    const answer = stopListening();
    let answerText = answer || "(No answer provided)";
    if (fromTimer && answer && answer.trim().length > 0) {
        answerText = answer + " (Time's up)";
    }

    const newTurn: InterviewTurn = { 
      question: currentQuestion, 
      answer: answerText, 
      emotionData: getEmotionHistory()
    };

    const updatedLog = [...interviewLog, newTurn];
    setInterviewLog(updatedLog);
    
    if (updatedLog.length < 5) {
        askNextQuestion();
    } else {
        handleEndInterview(updatedLog);
    }
  }, [stopListening, currentQuestion, interviewLog, askNextQuestion, handleEndInterview, getEmotionHistory]);

  const handleManualEnd = useCallback(() => {
    let finalLog = [...interviewLog];
    if (status === 'listening') {
        const answer = stopListening();
        if (answer && answer.trim().length > 0) {
            finalLog.push({
                question: currentQuestion,
                answer: answer,
                emotionData: getEmotionHistory()
            });
        }
    }
    handleEndInterview(finalLog);
  }, [handleEndInterview, interviewLog, status, stopListening, currentQuestion, getEmotionHistory]);
  
  // Timer Countdown Logic
  useEffect(() => {
    let interval: number;
    if (status === 'listening' && timeRemaining > 0) {
        interval = window.setInterval(() => {
            setTimeRemaining(prev => Math.max(0, prev - 1));
        }, 1000);
    }
    return () => clearInterval(interval);
  }, [status, timeRemaining]);

  // Auto-next question on timer expiration
  useEffect(() => {
      if (timeRemaining === 0 && status === 'listening') {
           handleNextQuestion(true);
      }
  }, [timeRemaining, status, handleNextQuestion]);

  const handleStartInterview = () => {
    if(interviewType === 'Job' && !jobContext.trim()) {
        alert("Please enter the Role & Company you are interviewing for.");
        return;
    }
    if (cameraAccess !== 'granted' || !modelsLoaded) {
        alert("Please enable your camera and wait for analysis models to load before starting.");
        return;
    }
    resumeAudioContext();
    setStatus('starting');
    setInterviewLog([]);
    askNextQuestion();
  };

  const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const SidebarItem: React.FC<{ icon: React.ReactNode; label: string; type?: InterviewType; active?: boolean; onClick?: () => void }> = ({ icon, label, type, active, onClick }) => (
      <button 
          onClick={onClick ? onClick : () => type && navigateTo('interview', type)}
          className={`flex items-center gap-3 w-full p-3 rounded-lg transition-all duration-200 group ${active ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
      >
          <div className={`w-6 h-6 ${active ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`}>{icon}</div>
          <span className="font-medium">{label}</span>
      </button>
  );

  // Main Render
  return (
    <div className="flex h-screen bg-[#0F111A] text-white font-sans overflow-hidden">
        {/* New Sidebar matching screenshot */}
        <aside className="w-64 bg-[#151823] flex flex-col border-r border-gray-800/50">
            <div className="p-6">
                <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-500">
                    Sentio AI
                </h1>
            </div>
            
            <nav className="flex-1 px-4 space-y-2">
                <div className="mb-8 space-y-2">
                    <SidebarItem icon={JOB_ICON} label="Job Interview" type="Job" active={interviewType === 'Job'} />
                    <SidebarItem icon={SCHOOL_ICON} label="School Interview" type="School" active={interviewType === 'School'} />
                    <SidebarItem icon={CHAT_ICON} label="Casual Interview" type="Casual" active={interviewType === 'Casual'} />
                </div>
            </nav>

            <div className="p-4 space-y-2 border-t border-gray-800/50">
                <SidebarItem icon={HISTORY_ICON} label="History" onClick={() => navigateTo('history')} active={false} />
                <SidebarItem icon={SETTINGS_ICON} label="Settings" onClick={() => navigateTo('settings')} active={false} />
                <SidebarItem icon={LOGOUT_ICON} label="Logout" onClick={logout} active={false} />
            </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex p-6 gap-6 overflow-hidden">
            
            {/* LEFT COLUMN: Camera & Analysis */}
            <div className="w-5/12 flex flex-col gap-6">
                {/* Video Feed Container */}
                <div className="relative bg-black rounded-2xl overflow-hidden aspect-video flex items-center justify-center border border-gray-800 shadow-2xl">
                    {cameraAccess === 'granted' ? (
                         <>
                            <video ref={videoRef} muted autoPlay playsInline className="w-full h-full object-cover transform scale-x-[-1]" />
                            {/* Status Indicators Overlay */}
                            <div className="absolute top-4 left-4 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full text-xs font-medium text-white/70 border border-white/10 flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${status === 'listening' ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                                {status === 'listening' ? 'LISTENING' : 'CAMERA ACTIVE'}
                            </div>
                             {/* Timer if active */}
                            {status !== 'idle' && status !== 'ending' && (
                                <div className="absolute top-4 right-4 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full text-sm font-mono font-bold border border-purple-500/30 text-purple-300">
                                    {formatTime(timeRemaining)}
                                </div>
                            )}
                         </>
                    ) : (
                        <div className="flex flex-col items-center text-gray-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                            <p className="text-lg font-medium">Camera is off</p>
                        </div>
                    )}
                </div>

                {/* Camera Status Panel */}
                <div className="bg-[#1A1D2B] rounded-xl p-4 flex items-center justify-between border border-gray-800 shadow-lg">
                     <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${cameraAccess === 'granted' ? 'bg-green-400' : 'bg-gray-600'}`}></div>
                        <div>
                            <p className="text-sm text-gray-400 font-medium">Camera Status</p>
                            <p className={`text-sm font-bold ${cameraAccess === 'granted' ? 'text-green-400' : 'text-yellow-500'}`}>
                                {cameraAccess === 'granted' ? 'Active' : 'Inactive'}
                            </p>
                        </div>
                     </div>
                     {cameraAccess !== 'granted' && (
                        <button 
                            onClick={enableCamera}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors"
                        >
                            Enable Camera
                        </button>
                     )}
                </div>

                {/* Real-time Expression Analysis Panel */}
                <div className="bg-[#1A1D2B] rounded-xl p-5 border border-gray-800 shadow-lg flex-1">
                    <h3 className="text-white font-bold mb-6">Real-time Expression Analysis</h3>
                    {cameraAccess === 'granted' && modelsLoaded ? (
                        <div className="space-y-4">
                            <ExpressionBar label="Neutral" value={emotions.neutral} colorClass="bg-purple-500" />
                            <ExpressionBar label="Happy" value={emotions.happy} colorClass="bg-green-500" />
                            <ExpressionBar label="Sad" value={emotions.sad} colorClass="bg-blue-500" />
                            <ExpressionBar label="Angry" value={emotions.angry} colorClass="bg-red-500" />
                            {/* Hidden but tracked: Fearful, Disgusted, Surprised */}
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                            {cameraAccess !== 'granted' ? 'Enable camera to see analysis' : 'Loading AI models...'}
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT COLUMN: Interaction Area */}
            <div className="w-7/12 bg-[#151823] rounded-3xl border border-gray-800/50 p-8 flex flex-col justify-center items-center relative overflow-hidden">
                
                {/* Background decoration */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-purple-900/10 rounded-full filter blur-3xl -z-0 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-900/10 rounded-full filter blur-3xl -z-0 pointer-events-none"></div>

                <div className="relative z-10 max-w-md w-full text-center">
                    
                    {status === 'idle' ? (
                        // IDLE STATE: Start Screen
                        <>
                            <h2 className="text-3xl font-bold text-white mb-3">{interviewType} Interview Practice</h2>
                            <p className="text-gray-400 mb-8">
                                {cameraAccess === 'granted' 
                                    ? "Camera ready. Fill in the details below and press Start." 
                                    : "Enable your camera, then press Start to begin your session."}
                            </p>
                            
                            <div className="space-y-6">
                                {interviewType === 'Job' && (
                                    <div className="text-left">
                                        <label className="block text-gray-500 text-sm font-bold mb-2 ml-1">Role & Company</label>
                                        <input 
                                            type="text"
                                            value={jobContext}
                                            onChange={(e) => setJobContext(e.target.value)}
                                            placeholder="e.g., Software Engineer at Google"
                                            className="w-full p-4 bg-[#1E2235] rounded-xl border border-gray-700 focus:border-purple-500 focus:outline-none text-white placeholder-gray-500 transition-all"
                                        />
                                    </div>
                                )}
                                
                                <Button 
                                    onClick={handleStartInterview} 
                                    disabled={cameraAccess !== 'granted' || !modelsLoaded}
                                    className="w-full py-4 text-lg shadow-purple-900/20"
                                >
                                    Start Interview
                                </Button>
                            </div>
                        </>
                    ) : (
                        // ACTIVE INTERVIEW STATE
                        <div className="flex flex-col items-center h-full justify-center w-full">
                             {/* Status Text or Question */}
                             <div className="min-h-[120px] flex items-center justify-center w-full my-8">
                                {status === 'starting' && <Loader text="Preparing your session..." />}
                                {status === 'thinking' && <p className="text-xl text-purple-300 animate-pulse">AI is thinking...</p>}
                                {status === 'speaking' && <h3 className="text-2xl font-medium text-white leading-relaxed">"{currentQuestion}"</h3>}
                                {status === 'listening' && (
                                     <div className="flex flex-col items-center gap-4 w-full">
                                         <div className="p-4 bg-red-500/20 rounded-full animate-pulse">
                                             <div className="w-8 h-8 text-red-400">{MIC_ICON}</div>
                                         </div>
                                         <p className="text-xl text-gray-300">Listening...</p>
                                         <p className="text-lg text-gray-400 min-h-[56px] w-full p-2 bg-gray-900/50 rounded-md border border-gray-700 text-left whitespace-pre-wrap">
                                            {transcript || <span className="text-gray-600">...</span>}
                                        </p>
                                     </div>
                                )}
                                {status === 'ending' && <Loader text="Finalizing report..." />}
                             </div>

                             {/* Controls */}
                             {status === 'listening' && (
                                 <div className="flex gap-4 w-full max-w-sm">
                                     <Button onClick={() => handleNextQuestion(false)} className="flex-1 py-3" variant="primary">
                                         Next Question
                                     </Button>
                                     <button 
                                        onClick={handleManualEnd} 
                                        className="px-6 py-3 rounded-lg font-bold border-2 border-red-900/50 text-red-400 hover:bg-red-900/20 transition-colors"
                                     >
                                         End
                                     </button>
                                 </div>
                             )}
                        </div>
                    )}

                </div>
            </div>

        </main>
    </div>
  );
};

export default InterviewPage;