// FIX: Changed to a standard import for the User type to ensure it's resolved correctly.
import { User } from 'firebase/auth';

export type Page = 'landing' | 'auth' | 'interview' | 'report' | 'history' | 'permissions' | 'settings';

export type InterviewType = 'Job' | 'School' | 'Casual';

export type AIVoice = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
export type AIPersonality = 'Friendly' | 'Professional' | 'Strict';

export interface InterviewerSettings {
    voice: AIVoice;
    personality: AIPersonality;
}

// Data structure for emotion analysis from face-api.js
export interface EmotionData {
  neutral: number;
  happy: number;
  sad: number;
  angry: number;
  fearful: number;
  disgusted: number;
  surprised: number;
}


export interface InterviewTurn {
  question: string;
  answer: string;
  emotionData?: EmotionData[]; // Array of emotion snapshots per answer
}

export interface PerformanceFeedback {
  clarity: number;
  confidence: number;
  engagement: number;
  answerQuality: number;
  strengths: string[];
  areasForImprovement: string[];
  overallFeedback: string;
}

export interface InterviewResult {
  id?: string; // For Firestore document ID
  interviewType: InterviewType;
  log: InterviewTurn[];
  feedback: PerformanceFeedback;
  createdAt?: any; // For Firestore server timestamp
}

// FIX: Define a dedicated type for the AppContext.
// This helps break the circular dependency between App.tsx and other components,
// ensuring the context type is correctly inferred.
export interface AppContextType {
  navigateTo: (page: Page, interviewType?: InterviewType) => void;
  showReport: (result: InterviewResult) => void;
  interviewType: InterviewType;
  user: User | null;
  logout: () => void;
}
