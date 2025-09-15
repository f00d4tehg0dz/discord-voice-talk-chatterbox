import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load character configurations
let characters = {};
try {
    const charactersPath = join(__dirname, '../../config/characters.json');
    const charactersData = readFileSync(charactersPath, 'utf8');
    characters = JSON.parse(charactersData);
} catch (error) {
    console.error('Failed to load characters configuration:', error);
}

export const config = {
    // Discord Configuration
    discord: {
        token: process.env.DISCORD_BOT_TOKEN,
        clientId: process.env.DISCORD_CLIENT_ID,
    },
    
    // OpenAI Configuration
    openai: {
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-4',
        // Use GPT-4o-transcribe for improved transcription accuracy
        transcriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-transcribe',
        // Keep whisper-1 as fallback
        whisperModel: 'whisper-1',
    },
    
    // Chatterbox TTS Configuration
    tts: {
        baseUrl: process.env.CHATTERBOX_TTS_URL || 'http://localhost:8001',
        timeout: 30000,
    },
    
    // Bot Configuration
    bot: {
        defaultCharacter: process.env.DEFAULT_CHARACTER || 'emma',
        voiceTimeout: parseInt(process.env.VOICE_TIMEOUT) || 10000,
        audioBufferSize: parseInt(process.env.AUDIO_BUFFER_SIZE) || 4096,
        maxResponseLength: parseInt(process.env.MAX_RESPONSE_LENGTH) || 800, // Increased for more natural responses - Chatterbox can handle much more
    },

    // Audio Filtering Configuration
    audioFilter: {
        silenceThreshold: parseFloat(process.env.AUDIO_SILENCE_THRESHOLD) || 0.01,
        noiseThreshold: parseFloat(process.env.AUDIO_NOISE_THRESHOLD) || 0.05,
        peakThreshold: parseFloat(process.env.AUDIO_PEAK_THRESHOLD) || 0.1,
        minDurationMs: parseInt(process.env.AUDIO_MIN_DURATION_MS) || 170, // ~0.17 seconds
        minConfidence: parseFloat(process.env.TRANSCRIPTION_MIN_CONFIDENCE) || 0.3,
        singleWordConfidenceThreshold: parseFloat(process.env.SINGLE_WORD_CONFIDENCE_THRESHOLD) || 0.7,
    },
    
    // Character configurations
    characters,
};

// Validation
export function validateConfig() {
    const required = [
        'discord.token',
        'discord.clientId', 
        'openai.apiKey'
    ];
    
    const missing = required.filter(key => {
        const keys = key.split('.');
        let obj = config;
        for (const k of keys) {
            if (obj[k] === undefined) return true;
            obj = obj[k];
        }
        return false;
    });
    
    if (missing.length > 0) {
        throw new Error(`Missing required configuration: ${missing.join(', ')}`);
    }
    
    if (Object.keys(config.characters).length === 0) {
        console.warn('No characters loaded - bot may not function properly');
    }
}