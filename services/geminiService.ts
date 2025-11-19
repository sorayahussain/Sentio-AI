
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { InterviewType, InterviewTurn, PerformanceFeedback, EmotionData, AIVoice, AIPersonality } from '../types';
import { decode, decodeAudioData } from './audioService';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY environment variable not set.");
}
const ai = new GoogleGenAI({ apiKey: API_KEY! });

// Latency Optimization: Use Flash for the conversational loop
const fastModel = "gemini-2.5-flash"; 
// Quality Optimization: Use Pro for the final detailed report
const complexModel = "gemini-3-pro-preview";
const ttsModel = "gemini-2.5-flash-preview-tts";

const getSystemInstruction = (interviewType: InterviewType, personality: AIPersonality = 'Professional'): string => {
  let roleInstruction = "";
  switch (interviewType) {
    case 'Job':
      roleInstruction = "You are a hiring manager.";
      break;
    case 'School':
      roleInstruction = "You are an admissions officer.";
      break;
    case 'Casual':
      roleInstruction = "You are a friend. Chat casually.";
      break;
    default:
      roleInstruction = "You are an interviewer.";
  }

  let toneInstruction = "";
  switch (personality) {
    case 'Friendly':
      toneInstruction = "Tone: Warm.";
      break;
    case 'Strict':
      toneInstruction = "Tone: Strict. Challenge user.";
      break;
    case 'Professional':
    default:
      toneInstruction = "Tone: Professional.";
      break;
  }
  
  // Prompt Engineering: Explicit instruction to be concise to save output tokens and time.
  return `${roleInstruction} ${toneInstruction} Ask ONE short question. React to emotions.`;
};

// Helper for formatting emotions efficiently
const formatEmotions = (emotionData: EmotionData[] | undefined): string => {
    if (!emotionData || emotionData.length === 0) return "No data";
    const avg: {[key: string]: number} = {};
    emotionData.forEach(snap => {
        Object.entries(snap).forEach(([k, v]) => avg[k] = (avg[k] || 0) + v);
    });
    const dominant = Object.entries(avg)
        .map(([k, v]) => ({k, v: v / emotionData.length}))
        .filter(item => item.v > 0.2) // Only show significant emotions
        .sort((a, b) => b.v - a.v)
        .map(item => item.k)
        .join(', ');
    return dominant || "Neutral";
};

export const generateQuestion = async (
    interviewType: InterviewType, 
    history: InterviewTurn[], 
    personality: AIPersonality, 
    context?: string,
    description?: string,
    url?: string,
    pdfBase64?: string
): Promise<string> => {
  try {
    const isFirstQuestion = history.length === 0;
    
    // Prompt Engineering: Simplify the input context to reduce input token count
    let contextSummary = "";
    if (context) contextSummary += `Role/Topic: ${context}.\n`;
    if (description) contextSummary += `Info: ${description.substring(0, 1000)}...\n`; 
    
    // Optimization: Reduce history lookback to 3 turns to save tokens and latency
    const recentHistory = history.slice(-3);

    let promptText = `
      ${contextSummary}
      ${url ? `Ref: ${url}` : ''}
      
      History:
      ${recentHistory.map(turn => `AI: ${turn.question}\nUser: ${turn.answer}\n(Emotions: ${formatEmotions(turn.emotionData)})`).join('\n')}
      
      ${isFirstQuestion ? "Ask an opening question." : "Ask a follow-up. If user is Fearful/Disgusted/Surprised, react appropriately (e.g. reassure or clarify)."}
    `;

    const tools = [];
    if (url) {
        tools.push({ googleSearch: {} });
    }

    const parts: any[] = [];
    
    // Add PDF if available
    if (pdfBase64) {
        parts.push({
            inlineData: {
                mimeType: 'application/pdf',
                data: pdfBase64
            }
        });
    }

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
        model: fastModel, // Switching to Flash for speed
        contents: { parts: parts },
        config: {
            systemInstruction: getSystemInstruction(interviewType, personality),
            temperature: 0.7, 
            maxOutputTokens: 100, // Reduced token limit for faster generation
            tools: tools.length > 0 ? tools : undefined,
        }
    });

    if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
        console.log("Grounding Metadata:", response.candidates[0].groundingMetadata.groundingChunks);
    }

    return response.text.trim();
  } catch (error) {
    console.error("Error generating question:", error);
    return "Tell me more about that.";
  }
};


const feedbackSchema = {
    type: Type.OBJECT,
    properties: {
        clarity: { type: Type.NUMBER, description: "Score 1-10 clarity." },
        confidence: { type: Type.NUMBER, description: "Score 1-10 confidence." },
        engagement: { type: Type.NUMBER, description: "Score 1-10 engagement." },
        answerQuality: { type: Type.NUMBER, description: "Score 1-10 quality." },
        strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List strengths." },
        areasForImprovement: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List improvements." },
        overallFeedback: { type: Type.STRING, description: "Summary feedback." }
    },
    required: ["clarity", "confidence", "engagement", "answerQuality", "strengths", "areasForImprovement", "overallFeedback"]
};

export const evaluatePerformance = async (
    interviewType: InterviewType, 
    log: InterviewTurn[], 
    context?: string,
    description?: string,
    pdfBase64?: string
): Promise<PerformanceFeedback> => {
    let systemInstruction: string;
    let evaluationCriteria: string;

    switch (interviewType) {
        case 'Job':
            systemInstruction = "You are a career coach. Evaluate job interview performance.";
            evaluationCriteria = "Assess professionalism, STAR method, and clarity.";
            break;
        case 'School':
            systemInstruction = "You are an admissions officer. Evaluate a student interview.";
            evaluationCriteria = "Assess motivation, intellect, and sincerity.";
            break;
        case 'Casual':
        default:
            systemInstruction = "You are a communication expert. Evaluate casual conversation.";
            evaluationCriteria = "Assess flow, friendliness, and engagement.";
            break;
    }

    try {
        // Prepare a compact transcript for the prompt
        const transcript = log.map(turn => `
            Q: ${turn.question}
            A: ${turn.answer}
            Emotions: ${formatEmotions(turn.emotionData)}
        `).join('\n\n');

        const prompt = `
            Evaluate this ${interviewType} interview.
            Context: ${context || 'General'}
            ${description ? `Description provided.` : ''}
            
            Criteria: ${evaluationCriteria}

            Transcript:
            ${transcript}

            Provide feedback in JSON format.
        `;

        const parts: any[] = [];
        
        if (pdfBase64) {
            parts.push({
                inlineData: {
                    mimeType: 'application/pdf',
                    data: pdfBase64
                }
            });
        }
        // Add text description if no PDF or as supplement, but truncated to avoid token limits if massive
        if (description && !pdfBase64) {
             parts.push({ text: `Context Description: ${description}` });
        }
        
        parts.push({ text: prompt });

        const response = await ai.models.generateContent({
            model: complexModel, // Keep Pro for high-quality evaluation
            contents: { parts: parts },
            config: {
                responseMimeType: 'application/json',
                responseSchema: feedbackSchema,
                systemInstruction: systemInstruction
            }
        });
        
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error evaluating performance:", error);
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

export const textToSpeech = async (text: string, voice: AIVoice = 'Kore'): Promise<AudioBuffer | null> => {
    try {
        const response = await ai.models.generateContent({
            model: ttsModel,
            contents: [{ parts: [{ text: text }] }], 
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voice },
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
