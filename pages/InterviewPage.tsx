

import React, { useState, useRef, useContext, useEffect, useCallback } from 'react';
import useFaceApi from '../hooks/useFaceApi';
import useSpeechRecognition from '../hooks/useSpeechRecognition';
import { generateQuestion, evaluatePerformance, textToSpeech } from '../services/geminiService';
import { playAudio, resumeAudioContext } from '../services/audioService';
import { saveInterviewReport } from '../services/firebaseService';
import { AppContext } from '../App';
import { InterviewTurn, InterviewResult } from '../types';
import Button from '../components/Button';
import Loader from '../components/Loader';
import { JOB_ICON, SCHOOL_ICON, CHAT_ICON, HISTORY_ICON, SETTINGS_ICON, LOGOUT_ICON, MIC_ICON } from '../constants';

const EmotionIndicator: React.FC<{ label: string; value: number }> = ({ label, value }) => (
    <div className="flex items-center gap-3">
        <span className="text-xs capitalize w-20 text-right text-gray-400">{label}</span>
        <div className="w-full bg-gray-700 rounded-full h-2.5">
            <div 
                className="bg-purple-500 h-2.5 rounded-full transition-all duration-300 ease-in-out" 
                style={{ width: `${Math.min(value, 1) * 100}%` }}
            ></div>
        </div>
    </div>
);


const InterviewPage: React.FC = () => {
  const { interviewType, navigateTo, showReport, user, logout } = useContext(AppContext);
  const [status, setStatus] = useState<'idle' | 'starting' | 'listening' | 'thinking' | 'speaking' | 'ending'>('idle');
  const [interviewLog, setInterviewLog] = useState<InterviewTurn[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [jobContext, setJobContext] = useState('');
  const [cameraAccess, setCameraAccess] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  const { transcript, startListening, stopListening, clearTranscript } = useSpeechRecognition();
  const { modelsLoaded, emotions, isLoadingModels, getEmotionHistory, modelError } = useFaceApi(videoRef, status === 'listening' && cameraAccess === 'granted');

  // Attempt to activate camera on component load if permissions were already granted
  useEffect(() => {
    const attemptAutoCameraStart = async () => {
      if (cameraAccess === 'idle') {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          setMediaStream(stream);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(err => console.error("Error playing video:", err));
          }
          setCameraAccess('granted');
        } catch (err) {
          console.log("Auto-starting camera failed. Waiting for user to enable manually.");
          setCameraAccess('denied');
        }
      }
    };
    attemptAutoCameraStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup webcam on component unmount
  useEffect(() => {
    return () => {
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
        }
    };
  }, [mediaStream]);

  const handleToggleCamera = async () => {
    if (mediaStream) { // If camera is on, turn it off
        mediaStream.getTracks().forEach(track => track.stop());
        setMediaStream(null);
        if (videoRef.current) videoRef.current.srcObject = null;
        setCameraAccess('denied');
    } else { // If camera is off, turn it on
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            setMediaStream(stream);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play().catch(err => console.error("Error playing video:", err));
            }
            setCameraAccess('granted');
        } catch (err) {
            console.error("Error accessing webcam:", err);
            alert("Could not access webcam. Please check permissions and try again. You may need to grant access in your browser settings.");
            setCameraAccess('denied');
        }
    }
  };


  const askNextQuestion = useCallback(async () => {
    setStatus('thinking');
    const question = await generateQuestion(interviewType, interviewLog, interviewType === 'Job' ? jobContext : undefined);
    setCurrentQuestion(question);
    const audioBuffer = await textToSpeech(question);
    setStatus('speaking');

    const handlePlaybackEnd = () => {
        clearTranscript();
        startListening();
        setStatus('listening');
    };

    if (audioBuffer) {
      playAudio(audioBuffer, handlePlaybackEnd);
    } else {
      // Fallback if TTS fails
      handlePlaybackEnd();
    }
  }, [interviewType, interviewLog, jobContext, clearTranscript, startListening]);

  const handleStartInterview = () => {
    if(interviewType === 'Job' && !jobContext) {
        alert("Please specify the role you're practicing for.");
        return;
    }
    if (cameraAccess !== 'granted' || !modelsLoaded) {
        alert("Please enable your camera and wait for analysis models to load before starting.");
        return;
    }
    // Resume audio context on first user gesture
    resumeAudioContext();
    setStatus('starting');
    setInterviewLog([]);
    askNextQuestion();
  };
  
    const handleEndInterview = useCallback(async (finalLog: InterviewTurn[]) => {
    setStatus('ending');
    stopListening();

    if (finalLog.length === 0) {
        navigateTo('interview');
        return;
    }
    
    const feedback = await evaluatePerformance(interviewType, finalLog, interviewType === 'Job' ? jobContext : undefined);

    const result: InterviewResult = { interviewType, log: finalLog, feedback };
    
    if (user) {
        await saveInterviewReport(user.uid, result);
    }

    showReport(result);
  }, [interviewType, jobContext, navigateTo, showReport, stopListening, user]);


  const handleNextQuestion = useCallback(() => {
    const answer = stopListening();
    
    const newTurn: InterviewTurn = { 
      question: currentQuestion, 
      answer, 
      emotionData: getEmotionHistory()
    };

    const updatedLog = [...interviewLog, newTurn];
    setInterviewLog(updatedLog);
    
    if (updatedLog.length < 5) { // 5 questions total
        askNextQuestion();
    } else {
        handleEndInterview(updatedLog);
    }
  }, [stopListening, currentQuestion, interviewLog, askNextQuestion, handleEndInterview, getEmotionHistory]);
  
  const handleEarlyEnd = useCallback(() => {
      const answer = stopListening();
      let finalLog = [...interviewLog];
      if (currentQuestion && (answer || transcript)) {
          finalLog.push({
              question: currentQuestion,
              answer: answer || transcript, // Use final or interim transcript
              emotionData: getEmotionHistory()
          });
      }
      handleEndInterview(finalLog);
  }, [stopListening, interviewLog, currentQuestion, transcript, handleEndInterview, getEmotionHistory]);

  
  const Sidebar: React.FC = () => (
    <aside className="w-16 md:w-64 bg-gray-900/70 backdrop-blur-md p-2 md:p-4 flex flex-col items-center md:items-start">
        <h1 className="text-xl md:text-2xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">Sentio AI</h1>
        <nav className="flex-grow space-y-2">
            {(['Job', 'School', 'Casual'] as const).map(type => (
                <button key={type} onClick={() => navigateTo('interview', type)} className={`w-full flex items-center p-2 rounded-lg transition-colors ${interviewType === type ? 'bg-purple-600/50 text-white' : 'hover:bg-gray-700/50 text-gray-400'}`}>
                    {type === 'Job' ? JOB_ICON : type === 'School' ? SCHOOL_ICON : CHAT_ICON}
                    <span className="hidden md:inline ml-4">{type} Interview</span>
                </button>
            ))}
        </nav>
        <div className="space-y-2">
             <button onClick={() => navigateTo('history')} className="w-full flex items-center p-2 rounded-lg hover:bg-gray-700/50 text-gray-400">
                {HISTORY_ICON}
                <span className="hidden md:inline ml-4">History</span>
             </button>
             <button className="w-full flex items-center p-2 rounded-lg hover:bg-gray-700/50 text-gray-400">
                {SETTINGS_ICON}
                <span className="hidden md:inline ml-4">Settings</span>
             </button>
             <button onClick={logout} className="w-full flex items-center p-2 rounded-lg hover:bg-gray-700/50 text-gray-400">
                {LOGOUT_ICON}
                <span className="hidden md:inline ml-4">Logout</span>
             </button>
        </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <Sidebar />
      <main className="flex-1 flex flex-col p-4 md:p-8 gap-8 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1">
          {/* Left Column: Video and Emotions */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-lg border border-gray-700 flex items-center justify-center">
              <video ref={videoRef} autoPlay muted playsInline className={`w-full h-full object-cover transform -scale-x-100 ${cameraAccess === 'granted' ? '' : 'hidden'}`}></video>
              {cameraAccess !== 'granted' && (
                <div className="text-center text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9A2.25 2.25 0 0 0 13.5 5.25h-9A2.25 2.25 0 0 0 2.25 7.5v9A2.25 2.25 0 0 0 4.5 18.75Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M1 1l22 22" />
                    </svg>
                    <p className="mt-2 font-semibold">Camera is off</p>
                </div>
              )}
              {isLoadingModels && (
                <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm p-2 flex items-center justify-center">
                    <Loader text="Initializing analysis models..." />
                </div>
              )}
              {modelError && !isLoadingModels && (
                <div className="absolute inset-0 bg-red-900/60 backdrop-blur-sm p-4 flex flex-col items-center justify-center text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="font-semibold text-red-300">Analysis Error</p>
                    <p className="text-red-200 text-sm mt-1">{modelError}</p>
                </div>
              )}
            </div>
            <div className="bg-gray-800/50 p-3 rounded-xl shadow-lg border border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${cameraAccess === 'granted' ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
                    <div>
                        <h3 className="font-bold text-sm">Camera Status</h3>
                        <p className={`text-xs ${cameraAccess === 'granted' ? 'text-green-400' : 'text-yellow-400'}`}>
                            {cameraAccess === 'granted' ? 'Active' : 'Inactive'}
                        </p>
                    </div>
                </div>
                <Button onClick={handleToggleCamera} variant={cameraAccess === 'granted' ? 'secondary' : 'primary'} className="py-2 px-4 text-sm">
                    {cameraAccess === 'granted' ? 'Disable Camera' : 'Enable Camera'}
                </Button>
            </div>
            <div className="bg-gray-800/50 p-4 rounded-xl shadow-lg border border-gray-700">
              <h3 className="font-bold mb-4">Real-time Expression Analysis</h3>
              <div className="space-y-2">
                {emotions && Object.entries(emotions)
                    // FIX: Ensure values are numbers before subtraction to avoid arithmetic errors on potentially `any` typed values.
                    .sort(([, valA], [, valB]) => Number(valB) - Number(valA))
                    .slice(0, 4)
                    .map(([emotion, value]) => (
                        <EmotionIndicator key={emotion} label={emotion} value={value as number} />
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Interviewer and Transcript */}
          <div className="lg:col-span-2 bg-gray-800/50 rounded-xl shadow-lg border border-gray-700 flex flex-col p-6">
             {status === 'idle' ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                    <h2 className="text-3xl font-bold mb-2">{interviewType} Interview Practice</h2>
                    <p className="text-gray-400 mb-6">Enable your camera, then press Start to begin your session.</p>
                    {interviewType === 'Job' && (
                        <div className="w-full max-w-sm mb-6">
                             <label htmlFor="jobContext" className="text-sm font-bold text-gray-400 block mb-2">Role & Company</label>
                             <input 
                                type="text" 
                                id="jobContext" 
                                value={jobContext}
                                onChange={(e) => setJobContext(e.target.value)}
                                className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none" 
                                placeholder="e.g., Software Engineer at Google" 
                            />
                        </div>
                    )}
                    <Button onClick={handleStartInterview} disabled={cameraAccess !== 'granted' || isLoadingModels || !modelsLoaded || !!modelError}>
                        {isLoadingModels ? 'Loading Models...' : modelError ? 'Analysis Unavailable' : 'Start Interview'}
                    </Button>
                </div>
             ) : (
                <>
                    <div className="flex-shrink-0 mb-4">
                        <div className="flex items-center gap-4">
                            <img src="https://picsum.photos/seed/ai/100" alt="AI Interviewer" className="w-16 h-16 rounded-full"/>
                            <div>
                                <h2 className="text-xl font-bold">AI Interviewer</h2>
                                <div className="flex items-center gap-2">
                                    <p className="text-purple-300">
                                        {status === 'thinking' && 'Thinking...'}
                                        {status === 'speaking' && 'Speaking...'}
                                        {status === 'listening' && 'Listening...'}
                                        {status === 'ending' && 'Finalizing...'}
                                    </p>
                                    {status === 'listening' && (
                                        <div className="w-5 h-5 text-purple-300 animate-pulse">
                                            {MIC_ICON}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 p-4 bg-gray-700/50 rounded-lg">
                           {status === 'thinking' || status === 'ending' ? <Loader text={status === 'ending' ? "Generating your report..." : "Preparing next question..."} /> : <p className="text-lg">{currentQuestion}</p>}
                        </div>
                    </div>
                    <div className="flex-grow bg-gray-900/50 rounded-lg p-4 overflow-y-auto">
                        <h3 className="font-bold mb-2 text-gray-400">Your Response:</h3>
                        <p className="text-gray-200 min-h-[100px]">{transcript}</p>
                    </div>
                    <div className="mt-6 flex justify-end gap-4">
                        <Button onClick={handleEarlyEnd} variant="secondary" disabled={status === 'ending'}>End Interview</Button>
                        <Button onClick={handleNextQuestion} disabled={status !== 'listening' || !transcript}>
                            {interviewLog.length < 4 ? 'Submit & Next' : 'Submit & Finish'}
                        </Button>
                    </div>
                </>
             )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default InterviewPage;