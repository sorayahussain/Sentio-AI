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