import React, { useState, useEffect, useRef } from 'react';
import { EmotionData } from '../types';

// face-api.js is loaded via a script tag in index.html, so we need to declare the global.
declare const faceapi: any;

// The previous CDN URL for model weights was incorrect, causing 404 errors.
// This updated URL points to the models hosted on jsDelivr via the official GitHub repository.
const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';

// FIX: Added React import to resolve `React.RefObject` type error.
const useFaceApi = (videoRef: React.RefObject<HTMLVideoElement>, isRunning: boolean) => {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null); // For user feedback
  const [emotions, setEmotions] = useState<EmotionData>({ neutral: 1, happy: 0, sad: 0, angry: 0, fearful: 0, disgusted: 0, surprised: 0 });
  const emotionHistoryRef = useRef<EmotionData[]>([]);
  const intervalId = useRef<number | null>(null);

  useEffect(() => {
    let scriptCheckInterval: number;
    const loadModels = async () => {
      // Prevent multiple loads
      if (isLoadingModels || modelsLoaded) return;

      setIsLoadingModels(true);
      setModelError(null); // Reset error on new attempt
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
      } catch (error) {
        console.error("Failed to load face-api.js models:", error);
        setModelError("Failed to load analysis models. Please check your internet connection and reload.");
      } finally {
        setIsLoadingModels(false);
      }
    };
    
    // Check if faceapi is available on window
    if (typeof faceapi !== 'undefined') {
        loadModels();
    } else {
        // If not, it might still be loading, so check periodically
        scriptCheckInterval = window.setInterval(() => {
            if (typeof faceapi !== 'undefined') {
                clearInterval(scriptCheckInterval);
                loadModels();
            }
        }, 100);
    }
    return () => {
        if (scriptCheckInterval) {
            clearInterval(scriptCheckInterval);
        }
    }
  }, []); // Empty dependency array ensures this runs only once on mount.

  const detectEmotions = async () => {
    if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended && videoRef.current.readyState >= 3) {
      try {
        const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceExpressions();
        if (detections.length > 0 && detections[0].expressions) {
          // FIX: Convert the FaceExpressions class instance from face-api.js into a plain JavaScript object
          // to ensure it can be correctly serialized by Firestore.
          const { neutral, happy, sad, angry, fearful, disgusted, surprised } = detections[0].expressions;
          const plainEmotions: EmotionData = { neutral, happy, sad, angry, fearful, disgusted, surprised };

          setEmotions(plainEmotions);
          emotionHistoryRef.current.push(plainEmotions);
        } else {
          const neutralState = { neutral: 1, happy: 0, sad: 0, angry: 0, fearful: 0, disgusted: 0, surprised: 0 };
          setEmotions(neutralState);
        }
      } catch (error) {
        console.error("Error during face detection:", error);
      }
    }
  };
  
  useEffect(() => {
    if (isRunning && modelsLoaded) {
      emotionHistoryRef.current = []; // Reset history when detection starts
      intervalId.current = window.setInterval(detectEmotions, 500); // Detect every 500ms
    } else {
      if (intervalId.current) {
        clearInterval(intervalId.current);
        intervalId.current = null;
      }
    }
    return () => {
      if (intervalId.current) {
        clearInterval(intervalId.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, modelsLoaded]);

  const getEmotionHistory = () => {
    return emotionHistoryRef.current;
  };

  return { modelsLoaded, emotions, isLoadingModels, getEmotionHistory, modelError };
};

export default useFaceApi;