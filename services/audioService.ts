
// Create a single, shared AudioContext.
// The AudioContext must be created after a user gesture on the page.
let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
    if (!audioContext) {
        // Standard sample rate for TTS is 24000
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        audioContext = new AudioContext({ sampleRate: 24000 });
    }
    return audioContext;
};

// Function to resume the AudioContext if it's in a suspended state.
// This is often required due to browser autoplay policies.
export const resumeAudioContext = () => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
        ctx.resume();
    }
}

export const playAudio = (audioBuffer: AudioBuffer, onEnded?: () => void) => {
    try {
        const ctx = getAudioContext();
        // Ensure context is running.
        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.start();

        if (onEnded) {
            source.onended = onEnded;
        }
    } catch (error) {
        console.error("Error playing audio:", error);
        // If playing fails, still call onEnded to not block the interview flow
        if (onEnded) {
            onEnded();
        }
    }
};

// Per @google/genai guidelines, use a manual base64 decoder.
export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
    data: Uint8Array, 
    sampleRate: number, 
    numChannels: number
): Promise<AudioBuffer> {
    const ctx = getAudioContext();
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}
