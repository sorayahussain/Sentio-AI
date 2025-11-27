

import { useState, useEffect, useRef } from 'react';

// FIX: Add type definitions for SpeechRecognition API which may not be present in default TS lib
interface SpeechRecognitionResult {
    isFinal: boolean;
    [index: number]: SpeechRecognitionAlternative;
    length: number;
}
interface SpeechRecognitionAlternative {
    transcript: string;
}
interface SpeechRecognitionResultList {
    [index: number]: SpeechRecognitionResult;
    length: number;
}
interface SpeechRecognitionEvent extends Event {
    resultIndex: number;
    results: SpeechRecognitionResultList;
}

interface SpeechRecognition {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: (event: SpeechRecognitionEvent) => void;
    start: () => void;
    stop: () => void;
}

const useSpeechRecognition = () => {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const accumulatedTranscriptRef = useRef(''); // Stores text committed before a pause/mute
  const currentTranscriptRef = useRef(''); // Ref to track current state for toggleMute closure

  // Update ref whenever state changes so helper functions have latest value
  useEffect(() => {
    currentTranscriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // FIX: Cast window to `any` to access non-standard SpeechRecognition properties.
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';
      
      // We iterate over the results of the *current* session
      for (let i = 0; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      // Combine history (from before mute/pause) with current session
      setTranscript(accumulatedTranscriptRef.current + finalTranscript + interimTranscript);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, []);

  const startListening = () => {
    if (recognitionRef.current) {
      // NOTE: We do NOT clear transcript here. This allows us to resume listening (unmute)
      // without losing what was already said. Use clearTranscript() explicitly for new questions.
      try {
        recognitionRef.current.start();
        setIsListening(true);
        setIsMuted(false);
      } catch (e) {
          console.error("Error starting recognition:", e);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
    return transcript;
  };

  const toggleMute = () => {
      if (isMuted) {
          // Unmute: Resume listening
          setIsMuted(false);
          startListening();
      } else {
          // Mute: Stop listening but preserve state
          // Save what we have so far into the accumulator
          accumulatedTranscriptRef.current = currentTranscriptRef.current;
          stopListening();
          setIsMuted(true);
      }
  };
  
  const clearTranscript = () => {
      setTranscript('');
      accumulatedTranscriptRef.current = '';
  }

  return { transcript, isListening, isMuted, startListening, stopListening, toggleMute, clearTranscript };
};

export default useSpeechRecognition;