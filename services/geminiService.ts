
import { GoogleGenAI, Type, Modality, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { InterviewType, InterviewTurn, PerformanceFeedback, EmotionData, AIVoice, AIPersonality } from '../types';
import { decode, decodeAudioData } from './audioService';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY environment variable not set.");
}
const ai = new GoogleGenAI({ apiKey: API_KEY! });

// User requested Gemini 3 Pro for questions
const questionModel = "gemini-3-pro-preview"; 
const evaluationModel = "gemini-3-pro-preview";
const ttsModel = "gemini-2.5-flash-preview-tts";

// Safety settings to prevent over-blocking of interview content
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
      roleInstruction = "You are a professional hiring manager conducting a structured 5-question interview. You must stick to the interview script stages.";
      break;
    case 'School':
      roleInstruction = "You are a university admissions officer conducting a structured 5-question interview. You must stick to the interview script stages.";
      break;
    case 'Casual':
      roleInstruction = "You are a podcast host conducting a structured 5-question discussion. You must stick to the discussion script stages.";
      break;
    default:
      roleInstruction = "You are an interviewer.";
  }

  let toneInstruction = "";
  switch (personality) {
    case 'Friendly':
      toneInstruction = "Tone: Warm, encouraging, and conversational.";
      break;
    case 'Strict':
      toneInstruction = "Tone: Strict, formal, and challenging.";
      break;
    case 'Professional':
    default:
      toneInstruction = "Tone: Professional and objective.";
      break;
  }
  
  return `${roleInstruction} ${toneInstruction} Your goal is to assess the user on specific criteria in each turn. Be concise.`;
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

// Fallback questions to ensure continuity if API fails
const getFallbackQuestion = () => {
    const fallbacks = [
        "Could you elaborate on that further?",
        "Can you give me a specific example of that?",
        "How does this align with your future goals?",
        "Why is this particular aspect important to you?",
        "Could you tell me more about your experience with this?"
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
};

// Define structured stages for the interview to ensure variety
const getInterviewStage = (interviewType: InterviewType, turnCount: number): string => {
    const stages: Record<InterviewType, string[]> = {
        Job: [
            "Introduction: Ask 'Tell me about yourself' and briefly mention how your background fits this role.",
            "Experience: Ask about a specific project or professional experience directly relevant to the target role/industry.",
            "Technical/Skills: Identify a key skill required for this role (from description or common knowledge) and ask how they apply it.",
            "Behavioral: Ask a behavioral question (STAR method) about a challenge, conflict, or leadership moment.",
            "Motivation: Ask specifically why they want this role at this company vs others."
        ],
        School: [
            "Introduction: Ask 'Tell me about yourself' and your academic journey so far.",
            "Academic Interest: Ask about their favorite subject or a project that inspired them to pursue this program.",
            "Extracurriculars: Ask about a meaningful activity, club, or leadership role outside of class.",
            "Why Us: Ask specifically what draws them to this particular university or program.",
            "Future Goals: Ask where they see themselves in 5-10 years and how this degree helps."
        ],
        Casual: [
            "Icebreaker: Ask a broad, open-ended question to kick off the discussion topic.",
            "Perspective: Ask for their personal opinion or stance on a specific aspect of the topic.",
            "Experience: Ask if they have a personal story or memory related to this topic.",
            "Hypothetical: Pose a fun or thought-provoking 'What if' scenario related to the topic.",
            "Conclusion: Ask for a final thought or takeaway on the subject."
        ]
    };

    // If we go beyond 5 questions, fall back to wrap-up
    const currentStages = stages[interviewType];
    if (turnCount < currentStages.length) {
        return currentStages[turnCount];
    }
    return "Wrap-up: Thank them and ask if they have any final questions for you.";
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
    const turnCount = history.length;
    
    // Check if the previous answer was empty or non-existent
    const lastTurn = turnCount > 0 ? history[turnCount - 1] : null;
    const lastAnswer = lastTurn?.answer?.toLowerCase() || "";
    const isAnswerEmpty = !lastAnswer || lastAnswer.includes("(no answer provided)") || lastAnswer.trim().length < 2;

    // Define context labels based on interview type
    let targetLabel = "Target Role";
    let descLabel = "Job Description";

    switch (interviewType) {
        case 'School':
            targetLabel = "Target Program/University";
            descLabel = "Program Description / Personal Statement";
            break;
        case 'Casual':
            targetLabel = "Discussion Topic";
            descLabel = "Context / Background";
            break;
    }

    // Determine the theme for this specific turn
    const currentThemeInstruction = getInterviewStage(interviewType, turnCount);

    let stageInstruction = "";
    
    if (turnCount === 0) {
        stageInstruction = `Step 1 (Start): ${currentThemeInstruction} Keep it welcoming but professional.`;
    } else {
        if (isAnswerEmpty) {
             stageInstruction = `The user remained silent. Move on to the next topic: ${currentThemeInstruction}`;
        } else {
             // Force pivot to new topic based on schema
             stageInstruction = `Step ${turnCount + 1}: ${currentThemeInstruction}
             CRITICAL: Do NOT ask a follow-up question to the user's previous answer details. 
             Instead, generate a NEW question derived directly from the '${targetLabel}' and '${descLabel}' context provided above.
             Acknowledge the previous answer in 1 short sentence, then transition immediately to this new topic.`;
        }
    }

    // Clarify context
    let contextSummary = "";
    if (context) contextSummary += `TARGET CONTEXT (${targetLabel}): ${context}\n`;
    if (description) contextSummary += `DETAILED DESCRIPTION (${descLabel}): ${description.substring(0, 1500)}\n`; 
    
    // Provide full history to ensure no repetition, but instruct to prioritize script over history
    const recentHistory = history.slice(-5); 

    let promptText = `
      You are an expert interviewer following a structured guide.
      
      CONTEXT INFORMATION:
      ${contextSummary}
      ${url ? `Reference URL: ${url}` : ''}
      
      CURRENT INTERVIEW STAGE:
      ${stageInstruction}
      
      INSTRUCTIONS:
      1. Generate a question that fits the CURRENT INTERVIEW STAGE.
      2. Ensure the question is relevant to the TARGET CONTEXT and DETAILED DESCRIPTION.
      3. Keep the question concise (max 40 words).
      4. Do NOT repeat questions from the history.
      
      Conversation History:
      ${recentHistory.map((turn, i) => `Turn ${i+1}:\nAI: ${turn.question}\nUser: ${turn.answer}`).join('\n\n')}
    `;

    const tools: any[] = [];
    if (url && url.trim().length > 0) {
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
        model: questionModel, 
        contents: { parts: parts },
        config: {
            systemInstruction: getSystemInstruction(interviewType, personality),
            temperature: 0.7, 
            maxOutputTokens: 300, 
            safetySettings: safetySettings,
            tools: tools.length > 0 ? tools : undefined,
        }
    });

    if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
        console.log("Grounding Metadata:", response.candidates[0].groundingMetadata.groundingChunks);
    }
    
    const text = response.text;
    if (!text) {
        const finishReason = response.candidates?.[0]?.finishReason;
        console.warn(`Gemini API returned empty text. Finish Reason: ${finishReason}`);
        return getFallbackQuestion();
    }

    return text.trim();
  } catch (error) {
    console.error("Error generating question:", error);
    return getFallbackQuestion();
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
            evaluationCriteria = "Assess motivation, academic potential, and sincerity.";
            break;
        case 'Casual':
        default:
            systemInstruction = "You are a communication expert. Evaluate casual conversation.";
            evaluationCriteria = "Assess flow, friendliness, active listening, and engagement.";
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
            ${description ? `Description/Background: ${description.substring(0, 500)}...` : ''}
            
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
            model: evaluationModel, 
            contents: { parts: parts },
            config: {
                responseMimeType: 'application/json',
                responseSchema: feedbackSchema,
                systemInstruction: systemInstruction,
                safetySettings: safetySettings,
            }
        });
        
        const jsonText = response.text;
        if (!jsonText) {
             console.warn("Gemini API returned empty evaluation.");
             throw new Error("Empty evaluation response");
        }
        return JSON.parse(jsonText.trim());
    } catch (error) {
        console.error("Error evaluating performance:", error);
        return {
            clarity: 5,
            confidence: 5,
            engagement: 5,
            answerQuality: 5,
            strengths: ["Unable to generate specific feedback due to a connection issue."],
            areasForImprovement: ["Please try practicing again to get detailed insights."],
            overallFeedback: "We encountered an issue generating your detailed report. However, consistent practice is key to improvement!"
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
