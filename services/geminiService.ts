


import { GoogleGenAI, Type, Modality } from "@google/genai";
import { InterviewType, InterviewTurn, PerformanceFeedback, EmotionData } from '../types';
import { decode, decodeAudioData } from './audioService';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  // A check to ensure the API key is available.
  // In a real app, this might be handled more gracefully.
  console.error("API_KEY environment variable not set.");
}
const ai = new GoogleGenAI({ apiKey: API_KEY! });

const model = "gemini-2.5-pro";
const ttsModel = "gemini-2.5-flash-preview-tts";

const getSystemInstruction = (interviewType: InterviewType): string => {
  switch (interviewType) {
    case 'Job':
      return "You are a senior hiring manager conducting a professional job interview. Ask relevant, role-specific questions. Start with an introductory question.";
    case 'School':
      return "You are an admissions officer for a prestigious university. You are interviewing a prospective student. Focus on academic achievements, personal growth, and future aspirations. Start with a friendly ice-breaker.";
    case 'Casual':
      return "You are a friendly stranger making small talk. Keep the conversation light, engaging, and casual. Ask open-ended questions to get to know the person. Start with a simple greeting.";
  }
};

export const generateQuestion = async (interviewType: InterviewType, history: InterviewTurn[], context?: string): Promise<string> => {
  try {
    const contextPrompt = context ? `The interview is for this role: "${context}". Tailor your questions accordingly.` : '';
    
    const prompt = `
      ${contextPrompt}
      Based on the interview type "${interviewType}" and the following conversation history, ask the next logical and relevant interview question.
      Do not repeat questions. Keep the questions concise.
      If the history is empty, ask the first question.

      History:
      ${history.map(turn => `Interviewer: ${turn.question}\nCandidate: ${turn.answer}`).join('\n\n')}

      Next Question:
    `;
    
    const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
            systemInstruction: getSystemInstruction(interviewType),
            temperature: 0.8,
        }
    });

    return response.text.trim();
  } catch (error) {
    console.error("Error generating question:", error);
    return "I'm sorry, I encountered an issue. Let's try that again. Can you tell me about yourself?";
  }
};


const feedbackSchema = {
    type: Type.OBJECT,
    properties: {
        clarity: { type: Type.NUMBER, description: "Score from 1-10 on the clarity of the candidate's speech." },
        confidence: { type: Type.NUMBER, description: "Score from 1-10 on the candidate's perceived confidence based on verbal and non-verbal cues." },
        engagement: { type: Type.NUMBER, description: "Score from 1-10 based on facial expressions and overall engagement." },
        answerQuality: { type: Type.NUMBER, description: "Score from 1-10 on the quality and relevance of the answers." },
        strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of key strengths observed during the interview." },
        areasForImprovement: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of areas where the candidate can improve." },
        overallFeedback: { type: Type.STRING, description: "A comprehensive summary of the candidate's performance, integrating verbal and non-verbal analysis." }
    },
    required: ["clarity", "confidence", "engagement", "answerQuality", "strengths", "areasForImprovement", "overallFeedback"]
};


export const evaluatePerformance = async (interviewType: InterviewType, log: InterviewTurn[], context?: string): Promise<PerformanceFeedback> => {
    try {
        const contextPrompt = context ? `The candidate was interviewing for this role: "${context}". Evaluate their answers and performance based on suitability for this specific role.` : '';

        // Function to summarize emotion data
        const formatEmotions = (emotionData: EmotionData[] | undefined): string => {
            if (!emotionData || emotionData.length === 0) {
                return "No facial expression data captured.";
            }
            // Calculate average emotions for the turn
            const avgEmotions: { [key: string]: number } = { neutral: 0, happy: 0, sad: 0, angry: 0, fearful: 0, disgusted: 0, surprised: 0 };
            emotionData.forEach(snapshot => {
                for (const [key, value] of Object.entries(snapshot)) {
                    avgEmotions[key] = (avgEmotions[key] || 0) + value;
                }
            });
            
            for (const key in avgEmotions) {
                avgEmotions[key] /= emotionData.length;
            }

            // Find the most dominant emotions to report
            const dominantEmotions = Object.entries(avgEmotions)
                .filter(([, value]) => value > 0.1) // Only show emotions with some presence
                .sort((a, b) => b[1] - a[1])
                .map(([key, value]) => `${key}: ${(value * 100).toFixed(0)}%`)
                .join(', ');

            return `Average emotional expression: ${dominantEmotions || 'Neutral'}.`;
        };

        const prompt = `
            Analyze the following interview transcript and provide a comprehensive performance evaluation.
            Interview Type: ${interviewType}
            ${contextPrompt}

            For each turn, I will provide the candidate's answer and a summary of their non-verbal cues derived from facial expression analysis.
            Use this multi-modal information to provide a holistic analysis. A 'happy' or 'neutral' expression generally indicates confidence and engagement, while excessive 'sad', 'angry', or 'fearful' expressions might suggest nervousness or a lack of confidence.

            Transcript with Non-Verbal Analysis:
            ${log.map(turn => `
                Interviewer: ${turn.question}
                Candidate's Answer: ${turn.answer}
                Candidate's Non-Verbal Cues: ${formatEmotions(turn.emotionData)}
            `).join('\n---\n')}

            Based on all of this, provide feedback in the required JSON format.
        `;

        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: feedbackSchema,
                systemInstruction: "You are an expert interview coach providing constructive feedback on both verbal and non-verbal communication."
            }
        });
        
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error evaluating performance:", error);
        // Return a default error feedback object
        return {
            clarity: 0,
            confidence: 0,
            engagement: 0,
            answerQuality: 0,
            strengths: ["Error during evaluation."],
            areasForImprovement: ["Could not generate feedback due to an API error."],
            overallFeedback: "An error occurred while analyzing the interview. Please try again."
        };
    }
};

export const textToSpeech = async (text: string): Promise<AudioBuffer | null> => {
    try {
        const response = await ai.models.generateContent({
            model: ttsModel,
            contents: [{ parts: [{ text: `Say with a clear and professional tone: ${text}` }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                },
            },
        });
        
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) return null;
        
        const decodedBytes = decode(base64Audio);
        const audioBuffer = await decodeAudioData(
            decodedBytes,
            24000,
            1,
        );

        return audioBuffer;
    } catch (error) {
        console.error("Error with Text-to-Speech:", error);
        return null;
    }
}
