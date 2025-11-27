

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
  const transcriptHistoryRef = useRef('');

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
      // FIX: The original loop started from `event.resultIndex`, which caused it to miss
      // previous final results when reconstructing the transcript. The correct approach
      // is to iterate over the entire `event.results` list to build the full transcript
      // on every update, as it contains all recognized parts for the current session.
      for (let i = 0; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      setTranscript(transcriptHistoryRef.current + finalTranscript + interimTranscript);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, []);

  const startListening = () => {
    if (recognitionRef.current) {
      // NOTE: We do not clear the transcript here anymore. 
      // It is the responsibility of the caller to call clearTranscript() when starting a fresh session if needed.
      try {
        recognitionRef.current.start();
        setIsListening(true);
        setIsMuted(false);
      } catch (e) {
        console.error("Speech recognition already started", e);
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
          if (recognitionRef.current) {
              try {
                  recognitionRef.current.start();
                  setIsListening(true);
                  setIsMuted(false);
              } catch(e) { console.error(e) }
          }
      } else {
          // Mute: Stop listening but preserve state
          if (recognitionRef.current) {
              recognitionRef.current.stop();
              setIsListening(false);
              setIsMuted(true);
              // Save current transcript to history so when we restart (unmute), we start appending
              transcriptHistoryRef.current = transcript + ' ';
          }
      }
  };
  
  const clearTranscript = () => {
      setTranscript('');
      transcriptHistoryRef.current = '';
  }

  return { transcript, isListening, startListening, stopListening, clearTranscript, isMuted, toggleMute };
};

export default useSpeechRecognition;