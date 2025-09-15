import axios from 'axios';
import { config } from './config.js';

/**
 * Generate speech using Chatterbox TTS
 */
export async function generateSpeech(text, voiceConfig = {}) {
    try {
        console.log(`[TTS] Generating speech: "${text}"`);
        console.log(`[TTS] Voice config:`, voiceConfig);
        
        if (!text || text.trim().length === 0) {
            throw new Error('Empty text provided for TTS');
        }
        
        
        console.log(`[TTS] Making request to ${config.tts.baseUrl}/tts`);
        
        // Prepare request for Chatterbox TTS API format
        const chatterboxRequest = {
            text: text.trim(),
            voice_mode: 'clone',
            reference_audio_filename: voiceConfig.voice_id || 'emmastone.wav',
            output_format: 'wav',
            split_text: false,
            temperature: voiceConfig.temperature || 0.8,
            exaggeration: voiceConfig.exaggeration || 0.5,
            cfg_weight: voiceConfig.cfg_weight || 0.5,
            speed_factor: voiceConfig.speed || 1.0,
            seed: voiceConfig.seed || Math.floor(Math.random() * 4294967295)
        };
        
        // Make request to Chatterbox TTS server
        const response = await axios.post(
            `${config.tts.baseUrl}/tts`,
            chatterboxRequest,
            {
                headers: {
                    'Content-Type': 'application/json',
                },
                responseType: 'arraybuffer', // Important for audio data
                timeout: config.tts.timeout,
            }
        );
        
        if (response.status !== 200) {
            throw new Error(`TTS server returned status ${response.status}`);
        }
        
        const audioBuffer = Buffer.from(response.data);
        console.log(`[TTS] Generated audio buffer of size: ${audioBuffer.length} bytes`);
        
        return audioBuffer;
        
    } catch (error) {
        console.error(`[TTS] Failed to generate speech:`, error.message);
        
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            throw new Error('TTS server is not available. Please check if Chatterbox TTS is running.');
        }
        
        if (error.response) {
            const errorData = error.response.data;
            console.error(`[TTS] Server error response:`, errorData);
            throw new Error(`TTS server error: ${error.response.status} - ${errorData.error || 'Unknown error'}`);
        }
        
        throw error;
    }
}

/**
 * Check if TTS server is available
 */
export async function checkTTSHealth() {
    try {
        console.log(`[TTS] Checking health of TTS server at ${config.tts.baseUrl}`);
        
        const response = await axios.get(
            `${config.tts.baseUrl}/api/ui/initial-data`,
            {
                timeout: 5000,
            }
        );
        
        console.log(`[TTS] Health check response:`, response.data);
        return response.status === 200;
        
    } catch (error) {
        console.error(`[TTS] Health check failed:`, error.message);
        return false;
    }
}

/**
 * Get available voices from TTS server
 */
export async function getAvailableVoices() {
    try {
        console.log(`[TTS] Getting available voices from TTS server`);
        
        const response = await axios.get(
            `${config.tts.baseUrl}/voices`,
            {
                timeout: 10000,
            }
        );
        
        console.log(`[TTS] Available voices:`, response.data);
        return response.data.voices || [];
        
    } catch (error) {
        console.error(`[TTS] Failed to get available voices:`, error.message);
        
        // Return default voice configuration if server is unavailable
        return [
            { id: 'wizard_voice', name: 'Wizard Voice' },
            { id: 'emma_voice', name: 'Emma Voice' },
        ];
    }
}

/**
 * Generate speech with fallback options
 */
export async function generateSpeechWithFallback(text, voiceConfig = {}) {
    try {
        // Try primary TTS generation
        return await generateSpeech(text, voiceConfig);
        
    } catch (error) {
        console.warn(`[TTS] Primary TTS failed, attempting fallback`);
        
        // Fallback 1: Try with wizard voice as default fallback
        try {
            const fallbackConfig = {
                ...voiceConfig,
                voice_id: 'wizard.wav',
            };
            return await generateSpeech(text, fallbackConfig);
            
        } catch (fallbackError) {
            console.error(`[TTS] Fallback TTS also failed:`, fallbackError.message);
            
            // Fallback 2: Return null to indicate TTS failure
            // The calling code can handle this by sending text-only response
            return null;
        }
    }
}

/**
 * Batch generate speech for multiple texts
 */
export async function batchGenerateSpeech(texts, voiceConfig = {}) {
    try {
        console.log(`[TTS] Batch generating speech for ${texts.length} texts`);
        
        const promises = texts.map((text, index) => 
            generateSpeechWithFallback(text, voiceConfig)
                .then(audio => ({ index, audio, success: true }))
                .catch(error => ({ index, error, success: false }))
        );
        
        const results = await Promise.allSettled(promises);
        
        const audioBuffers = new Array(texts.length);
        let successCount = 0;
        
        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value.success) {
                audioBuffers[index] = result.value.audio;
                successCount++;
            } else {
                audioBuffers[index] = null;
            }
        });
        
        console.log(`[TTS] Batch generation completed: ${successCount}/${texts.length} successful`);
        
        return audioBuffers;
        
    } catch (error) {
        console.error(`[TTS] Batch generation failed:`, error);
        return texts.map(() => null);
    }
}

/**
 * Convert text to speech-friendly format
 */
export function preprocessTextForTTS(text) {
    if (!text || typeof text !== 'string') {
        return '';
    }
    
    let processed = text.trim();
    
    // Remove or replace problematic characters/patterns
    processed = processed
        // Remove markdown formatting
        .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
        .replace(/\*(.*?)\*/g, '$1')     // Italic
        .replace(/`(.*?)`/g, '$1')       // Code
        .replace(/~~(.*?)~~/g, '$1')     // Strikethrough
        
        // Replace common internet shorthand
        .replace(/\bu\b/gi, 'you')
        .replace(/\bur\b/gi, 'your')
        .replace(/\br\b/gi, 'are')
        .replace(/\btho\b/gi, 'though')
        
        // Handle URLs (replace with "link")
        .replace(/https?:\/\/[^\s]+/g, 'link')
        
        // Handle mentions and emojis (remove them)
        .replace(/<@!?\d+>/g, '')        // User mentions
        .replace(/<#\d+>/g, '')          // Channel mentions
        .replace(/<@&\d+>/g, '')         // Role mentions
        .replace(/<a?:\w+:\d+>/g, '')    // Custom emojis
        
        // Clean up whitespace
        .replace(/\s+/g, ' ')
        .trim();
    
    // Ensure text isn't too long for TTS
    if (processed.length > config.bot.maxResponseLength) {
        processed = processed.substring(0, config.bot.maxResponseLength - 3) + '...';
    }
    
    return processed;
}

/**
 * Test TTS with a sample text
 */
export async function testTTS(voiceConfig = {}) {
    const testText = "Hello! This is a test of the text-to-speech system.";
    
    try {
        console.log(`[TTS] Running TTS test with voice config:`, voiceConfig);
        
        const audioBuffer = await generateSpeech(testText, voiceConfig);
        
        if (audioBuffer && audioBuffer.length > 0) {
            console.log(`[TTS] Test successful - generated ${audioBuffer.length} bytes of audio`);
            return { success: true, audioBuffer };
        } else {
            throw new Error('No audio data generated');
        }
        
    } catch (error) {
        console.error(`[TTS] Test failed:`, error.message);
        return { success: false, error: error.message };
    }
}