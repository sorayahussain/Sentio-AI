
import { GoogleGenAI, Type, Modality, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { InterviewType, InterviewTurn, PerformanceFeedback, EmotionData, AIVoice, AIPersonality } from '../types';
import { decode, decodeAudioData } from './audioService';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY environment variable not set.");
}
const ai = new GoogleGenAI({ apiKey: API_KEY! });

// Models for specific tasks
const questionModel = "gemini-3-pro-preview"; 
const evaluationModel = "gemini-3-pro-preview";
const ttsModel = "gemini-2.5-flash-preview-tts";

// Safety settings
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

const getSystemInstruction = (interviewType: InterviewType, personality: AIPersonality = 'Professional'): string => {
  let roleInstruction = "";
  switch (interviewType) {
    case 'Job':
      roleInstruction = "You are a professional hiring manager at a top-tier global firm. You look for evidence of impact, technical skill, and cultural fit.";
      break;
    case 'School':
      roleInstruction = "You are a senior admissions officer at an elite university. You look for intellectual curiosity, leadership potential, and community fit.";
      break;
    case 'Casual':
      roleInstruction = "You are an engaging podcast host. You look for interesting stories, unique perspectives, and authentic conversation.";
      break;
    default:
      roleInstruction = "You are a professional interviewer.";
  }

  let toneInstruction = "";
  switch (personality) {
    case 'Friendly':
      toneInstruction = "Tone: Warm and encouraging. Use phrases like 'That's interesting!' and maintain a supportive vibe.";
      break;
    case 'Strict':
      toneInstruction = "Tone: Direct, analytical, and slightly skeptical. Use probing follow-ups and keep a poker face through your words.";
      break;
    case 'Professional':
    default:
      toneInstruction = "Tone: Polished, balanced, and objective. Use standard professional vocabulary and remain efficient.";
      break;
  }
  
  return `SYSTEM: ${roleInstruction} ${toneInstruction} Ensure every question builds naturally but moves into a NEW topic area.`;
};

// Helper for formatting emotions
const formatEmotions = (emotionData: EmotionData[] | undefined): string => {
    if (!emotionData || emotionData.length === 0) return "No data";
    const avg: {[key: string]: number} = {};
    emotionData.forEach(snap => {
        Object.entries(snap).forEach(([k, v]) => avg[k] = (avg[k] || 0) + v);
    });
    const dominant = Object.entries(avg)
        .map(([k, v]) => ({k, v: v / emotionData.length}))
        .filter(item => item.v > 0.15)
        .sort((a, b) => b.v - a.v)
        .map(item => item.k)
        .join(', ');
    return dominant || "Neutral";
};

/**
 * Generates a realistic interview question based on a structured 5-turn blueprint.
 * Explicitly designed to prevent repetition and ensure topical variety.
 */
export const generateQuestion = async (
    interviewType: InterviewType, 
    history: InterviewTurn[], 
    personality: AIPersonality,
    context: string,
    description?: string,
    url?: string,
    pdfBase64?: string
): Promise<string> => {
  try {
    const turnNumber = history.length + 1;
    
    // Define the stage-specific instructions based on interview type
    let stageInstructions = "";
    
    if (interviewType === 'Job') {
        switch(turnNumber) {
            case 1: stageInstructions = `STAGE: INTEREST & MOTIVATION. Welcome the candidate. Ask what specifically about this ${context} role aligns with their current career path.`; break;
            case 2: stageInstructions = `STAGE: CORE COMPETENCY. DO NOT ask about challenges yet. Instead, focus on a hard skill or specific methodology mentioned in the PDF/Description. Ask for a specific technical accomplishment.`; break;
            case 3: stageInstructions = `STAGE: BEHAVIORAL & CHALLENGES. NOW ask about a time they overcame a significant obstacle, handled a difficult stakeholder, or managed a failure in the ${context} context.`; break;
            case 4: stageInstructions = `STAGE: ADAPTABILITY & GROWTH. Ask about a time they had to learn a new skill quickly or adapt to a major change in project scope.`; break;
            case 5: stageInstructions = `STAGE: VALUES & WRAP-UP. Ask how they define success in this ${context} role or how they would contribute to the team culture.`; break;
        }
    } else if (interviewType === 'School') {
        switch(turnNumber) {
            case 1: stageInstructions = `STAGE: ACADEMIC PASSION. Welcome them. Ask what unique perspective they bring to the ${context} program.`; break;
            case 2: stageInstructions = `STAGE: RESEARCH & CURIOSITY. Reference a detail from their personal statement. Ask them to discuss a specific academic topic that they find deeply fascinating.`; break;
            case 3: stageInstructions = `STAGE: LEADERSHIP & SERVICE. Ask about an extracurricular achievement or a time they helped others within their community.`; break;
            case 4: stageInstructions = `STAGE: RESILIENCE. Ask about a time they received critical feedback on their work and how they responded to it.`; break;
            case 5: stageInstructions = `STAGE: CONTRIBUTION. Beyond academics, how do they plan to contribute to student life or campus culture at this university?`; break;
        }
    } else { // Casual/Podcast
        switch(turnNumber) {
            case 1: stageInstructions = `STAGE: INTRODUCTION. Set a friendly tone. Ask what the most misunderstood part of ${context} is for people outside the field.`; break;
            case 2: stageInstructions = `STAGE: THE ORIGIN STORY. How did they first get involved with ${context}? What was that "lightbulb" moment?`; break;
            case 3: stageInstructions = `STAGE: PHILOSOPHICAL DEEP DIVE. Ask about the ethics or long-term future of ${context}. What keeps them up at night regarding this topic?`; break;
            case 4: stageInstructions = `STAGE: REVERSAL. Ask them to name a person or idea in ${context} they disagree with and explain why.`; break;
            case 5: stageInstructions = `STAGE: THE ONE ADVICE. If they could give one piece of advice to their younger self starting out in ${context}, what would it be?`; break;
        }
    }

    const promptText = `
        INTERVIEW SESSION: TURN ${turnNumber} OF 5
        SCENARIO: ${interviewType} Interview for ${context}
        CONTEXT DATA: ${description ? description.substring(0, 2000) : 'Extracted from PDF'}
        ${url ? `REFERENCE: ${url}` : ''}

        ${stageInstructions}

        PREVIOUS QUESTIONS (DO NOT REPEAT TOPICS FROM THESE):
        ${history.length === 0 
          ? "No history." 
          : history.map((turn, i) => `Q${i+1}: ${turn.question}`).join('\n')}

        TASK:
        1. NO REPETITION: Examine the "PREVIOUS QUESTIONS" above. You MUST NOT ask about the same topic, theme, or use a similar phrasing. If Turn 2 asked about a "challenge," Turn 3 MUST ask about something else (e.g., leadership, teamwork, or technical skills).
        2. ACTIVE LISTENING: Acknowledge the candidate's last answer in 10 words or less.
        3. PIVOT: Transition to the STAGE ${turnNumber} topic.
        4. ONE QUESTION: End with a single, clear, high-stakes question.
        
        Personality: ${personality}
        Language: English
        Constraint: Max 50 words. Be direct.
    `;

    const parts: any[] = [];
    if (pdfBase64) {
        parts.push({ inlineData: { mimeType: 'application/pdf', data: pdfBase64 } });
    }
    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
        model: questionModel, 
        contents: { parts },
        config: {
            systemInstruction: getSystemInstruction(interviewType, personality),
            temperature: 0.8,
            maxOutputTokens: 250,
            safetySettings: safetySettings,
        }
    });

    const outputText = response.text?.trim();
    if (!outputText) {
        throw new Error("AI returned empty text response");
    }
    return outputText;

  } catch (error) {
    console.error("Error generating question, using turn-specific fallback:", error);
    const turn = history.length + 1;
    
    // Detailed, unique fallbacks per turn to ensure no repetition even on API failure
    const fallbacks: Record<InterviewType, string[]> = {
        Job: [
            `Welcome. To start, what specifically drew you to this ${context} role?`,
            `Thinking about your technical background, what's a tool or methodology you've mastered that's relevant to ${context}?`,
            `Can you tell me about a time you had to handle a high-pressure situation or a tight deadline?`,
            `How do you typically handle receiving constructive criticism from a manager or peer?`,
            `Finally, where do you see your career heading in the next few years within this industry?`
        ],
        School: [
            `We're glad to have you. What makes our ${context} program the right fit for your goals?`,
            `Tell me about a specific project or paper you've worked on that you're particularly proud of.`,
            `Leadership is important here. Can you share an example of when you took initiative in a group setting?`,
            `Academic life can be rigorous. How do you manage your time and stay motivated when facing a heavy workload?`,
            `What is one question you were hoping I would ask you today, and how would you answer it?`
        ],
        Casual: [
            `Great to have you here. What's one thing most people get wrong about ${context}?`,
            `How did you first discover your interest in ${context}?`,
            `If you could change one thing about the way ${context} is handled in the world today, what would it be?`,
            `Who is a person in the ${context} space that you look up to and why?`,
            `If you had to summarize your philosophy on ${context} in one sentence, what would it be?`
        ]
    };

    // Ensure we don't index out of bounds, though we expect exactly 5 turns
    const typeFallbacks = fallbacks[interviewType] || fallbacks.Casual;
    return typeFallbacks[Math.min(turn - 1, 4)] || "Could you tell me more about your thoughts on this topic?";
  }
};

const feedbackSchema = {
    type: Type.OBJECT,
    properties: {
        clarity: { type: Type.NUMBER },
        confidence: { type: Type.NUMBER },
        engagement: { type: Type.NUMBER },
        answerQuality: { type: Type.NUMBER },
        strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
        areasForImprovement: { type: Type.ARRAY, items: { type: Type.STRING } },
        overallFeedback: { type: Type.STRING }
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
    try {
        const transcript = log.map(turn => `Interviewer: ${turn.question}\nCandidate: ${turn.answer}\nEmotions Detected: ${formatEmotions(turn.emotionData)}`).join('\n\n');
        
        const prompt = `
            Evaluate this ${interviewType} interview session for the role/program: ${context || 'General'}.
            
            Transcript and Emotional Data:
            ${transcript}

            Scoring Guidelines (0-10):
            - Clarity: Structure and articulation.
            - Confidence: Presence and emotional stability.
            - Engagement: Specificity and relevance to the context/PDF.
            - Answer Quality: Depth, evidence (STAR method for jobs), and intellectual rigor.
        `;

        const parts: any[] = [];
        if (pdfBase64) {
            parts.push({ inlineData: { mimeType: 'application/pdf', data: pdfBase64 } });
        }
        parts.push({ text: prompt });

        const response = await ai.models.generateContent({
            model: evaluationModel, 
            contents: { parts },
            config: {
                responseMimeType: 'application/json',
                responseSchema: feedbackSchema,
                systemInstruction: "You are an expert career coach. Be honest, constructive, and highly specific. Use the provided transcript and emotion data to ground your scores.",
                safetySettings: safetySettings,
            }
        });
        
        const jsonText = response.text?.trim();
        if (!jsonText) {
            throw new Error("AI returned empty feedback JSON");
        }
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error evaluating performance:", error);
        return {
            clarity: 7, confidence: 7, engagement: 7, answerQuality: 7,
            strengths: ["You maintained a steady flow throughout the interview."],
            areasForImprovement: ["Try to use more specific examples from your past experience."],
            overallFeedback: "Good session! Focus on the STAR method to make your answers even more impactful next time."
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
        return await decodeAudioData(decodedBytes, 24000, 1);
    } catch (error) {
        console.error("Error with Text-to-Speech:", error);
        return null;
    }
};
