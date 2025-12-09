
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
      roleInstruction = "You are a professional hiring manager conducting a structured 5-question interview.";
      break;
    case 'School':
      roleInstruction = "You are a university admissions officer conducting a structured 5-question interview.";
      break;
    case 'Casual':
      roleInstruction = "You are a podcast host conducting a structured 5-question interview/discussion.";
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
            "Introduction: Ask 'Tell me about yourself'.",
            "Experience: Ask a specific question about their past experience relevant to the target role.",
            "Technical/Skills: Ask a hard skill or technical question based on the job description requirements.",
            "Behavioral: Ask a 'Tell me about a time...' (STAR method) question regarding conflict, leadership, or challenges.",
            "Motivation/Culture: Ask why they want this specific role or company."
        ],
        School: [
            "Introduction: Ask 'Tell me about yourself'.",
            "Academic Background: Ask about their favorite subjects or academic achievements.",
            "Extracurriculars: Ask about leadership, clubs, or activities outside of class.",
            "Motivation: Ask specifically 'Why do you want to attend this program/university?'.",
            "Future Goals: Ask where they see themselves in 5 years."
        ],
        Casual: [
            "Introduction: Ask a broad icebreaker related to the topic.",
            "Personal Opinion: Ask for their specific opinion or stance on the topic.",
            "Experience: Ask if they have a personal story or experience related to this.",
            "Hypothetical: Ask a 'What if...' scenario question related to the topic.",
            "Broad Impact: Ask about the future or broader implications of this topic."
        ]
    };

    // If we go beyond 5 questions, fall back to wrap-up
    const currentStages = stages[interviewType];
    if (turnCount < currentStages.length) {
        return currentStages[turnCount];
    }
    return "Wrap-up: Ask if they have any final questions or thoughts.";
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
        stageInstruction = `Start the interview. ${currentThemeInstruction} Keep it short (under 20 words).`;
    } else {
        if (isAnswerEmpty) {
             stageInstruction = `The user remained silent. Move on to the next topic: ${currentThemeInstruction}`;
        } else {
             stageInstruction = `Acknowledge the user's previous answer briefly (1 sentence max), then PIVOT IMMEDIATELY to the next structured topic: ${currentThemeInstruction}. 
             Use the provided ${targetLabel} and ${descLabel} to make the question specific. 
             Do NOT just follow up on what they just said. Ensure you cover the new topic.`;
        }
    }

    // Clarify context
    let contextSummary = "";
    if (context) contextSummary += `${targetLabel} (User input): ${context}.\n`;
    if (description) contextSummary += `${descLabel}: ${description.substring(0, 1000)}...\n`; 
    
    // Provide full history to ensure no repetition
    const recentHistory = history.slice(-5); 

    let promptText = `
      ${contextSummary}
      ${url ? `Ref: ${url}` : ''}
      
      History of Conversation:
      ${recentHistory.map((turn, i) => `Turn ${i+1}:\nAI: ${turn.question}\nUser: ${turn.answer}\n(Emotions: ${formatEmotions(turn.emotionData)})`).join('\n\n')}
      
      Task: ${stageInstruction}
      Constraint: The question MUST be short and concise (under 40 words). Avoid long preambles. Do NOT repeat questions found in the History.
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
