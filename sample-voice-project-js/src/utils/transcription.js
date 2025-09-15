import OpenAI from 'openai';
import { config } from './config.js';
import { createWriteStream, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import { promisify } from 'util';

const openai = new OpenAI({
    apiKey: config.openai.apiKey,
});

/**
 * Validate transcription content to filter out meaningless results
 */
function validateTranscriptionContent(text, confidence = 1.0) {
    if (!text || typeof text !== 'string') {
        return { isValid: false, reason: 'Empty or invalid text' };
    }

    const cleanText = text.trim().toLowerCase();

    // Filter out very short transcriptions
    if (cleanText.length < 2) {
        return { isValid: false, reason: 'Text too short' };
    }

    // Filter out common noise patterns and artifacts
    const noisePatterns = [
        /^(uh+|um+|ah+|oh+|eh+)$/,           // Single utterances
        /^(mm+|hmm+|mhm+)$/,                  // Humming sounds
        /^(la+|na+|da+|ba+|ga+)$/,           // Random syllables
        /^[^a-zA-Z]*$/,                      // Only non-alphabetic chars
        /^(.)\1{4,}$/,                       // Repeated characters (5+ times)
        /^\s*\.\s*$/,                        // Just punctuation
        /^(background music|music|applause|laughter)$/i, // Common false positives
        /^(noise|static|silence)$/i,         // Transcription artifacts
        /^\[.*\]$/,                          // Bracketed content (often metadata)
        /^(thank you\.|thanks\.|you)$/i,     // Very common short phrases that might be artifacts
    ];

    for (const pattern of noisePatterns) {
        if (pattern.test(cleanText)) {
            return { isValid: false, reason: `Matched noise pattern: ${pattern.source}` };
        }
    }

    // Check for minimum meaningful content
    const words = cleanText.split(/\s+/).filter(word => word.length > 1);
    if (words.length === 0) {
        return { isValid: false, reason: 'No meaningful words found' };
    }

    // Very low confidence transcriptions are likely noise
    if (confidence < config.audioFilter.minConfidence) {
        return { isValid: false, reason: `Confidence too low: ${confidence.toFixed(2)} < ${config.audioFilter.minConfidence}` };
    }

    // Single word transcriptions with low-medium confidence are suspicious
    if (words.length === 1 && confidence < config.audioFilter.singleWordConfidenceThreshold) {
        return { isValid: false, reason: `Single word with low confidence: ${confidence.toFixed(2)} < ${config.audioFilter.singleWordConfidenceThreshold}` };
    }

    // Check for gibberish (high ratio of consonants or repeated patterns)
    const consonantRatio = (cleanText.match(/[bcdfghjklmnpqrstvwxyz]/g) || []).length / cleanText.length;
    if (consonantRatio > 0.8) {
        return { isValid: false, reason: 'High consonant ratio (likely gibberish)' };
    }

    return {
        isValid: true,
        reason: 'Valid transcription',
        wordCount: words.length,
        confidence: confidence
    };
}

/**
 * Convert audio buffer to transcribable format and transcribe using GPT-4o-transcribe
 */
export async function transcribeAudio(audioBuffer, userId, audioAnalysis = null) {
    try {
        console.log(`[TRANSCRIPTION] Starting transcription for user ${userId}, buffer size: ${audioBuffer.length}`);
        
        if (!audioBuffer || audioBuffer.length === 0) {
            throw new Error('Empty audio buffer');
        }
        
        // Create temporary file for audio processing
        const tempId = randomBytes(16).toString('hex');
        const rawPath = join(tmpdir(), `audio_${tempId}.raw`);
        const wavPath = join(tmpdir(), `audio_${tempId}.wav`);
        
        try {
            // Write raw audio data to temporary file
            await new Promise((resolve, reject) => {
                const writeStream = createWriteStream(rawPath);
                writeStream.on('error', reject);
                writeStream.on('finish', resolve);
                writeStream.write(audioBuffer);
                writeStream.end();
            });
            
            // Convert raw audio to WAV format using FFmpeg
            await new Promise((resolve, reject) => {
                ffmpeg()
                    .input(rawPath)
                    .inputFormat('s16le') // 16-bit signed little-endian
                    .inputOptions([
                        '-ar 48000', // Sample rate
                        '-ac 2',     // 2 channels (stereo)
                    ])
                    .output(wavPath)
                    .outputFormat('wav')
                    .on('error', (error) => {
                        console.error(`[TRANSCRIPTION] FFmpeg error:`, error);
                        reject(error);
                    })
                    .on('end', () => {
                        console.log(`[TRANSCRIPTION] Audio conversion completed for user ${userId}`);
                        resolve();
                    })
                    .run();
            });
            
            // Transcribe using GPT-4o-transcribe with fallback to Whisper
            const { createReadStream } = await import('fs');
            let transcription;

            try {
                // First try with GPT-4o-transcribe for improved accuracy
                console.log(`[TRANSCRIPTION] Attempting GPT-4o-transcribe for user ${userId}`);
                transcription = await openai.audio.transcriptions.create({
                    file: createReadStream(wavPath),
                    model: config.openai.transcriptionModel,
                    language: 'en', // Can be made configurable
                    prompt: 'This is a conversation in a Discord voice channel. Please transcribe accurately with proper punctuation and capitalization.',
                    response_format: 'json', // GPT-4o-transcribe supports 'json' or 'text'
                    temperature: 0.0, // Use deterministic transcription for consistency
                });

                console.log(`[TRANSCRIPTION] GPT-4o-transcribe successful for user ${userId}`);

            } catch (gpt4oError) {
                console.warn(`[TRANSCRIPTION] GPT-4o-transcribe failed for user ${userId}, falling back to Whisper:`, gpt4oError.message);

                // Fallback to Whisper if GPT-4o-transcribe fails
                transcription = await openai.audio.transcriptions.create({
                    file: createReadStream(wavPath),
                    model: config.openai.whisperModel,
                    language: 'en',
                    prompt: 'This is a conversation in a Discord voice channel.',
                    response_format: 'verbose_json', // Whisper supports verbose_json
                    temperature: 0.0,
                });

                console.log(`[TRANSCRIPTION] Whisper fallback successful for user ${userId}`);
            }
            
            const transcribedText = transcription.text?.trim();

            if (transcribedText && transcribedText.length > 0) {
                // Extract metadata based on response format
                const duration = transcription.duration || null;
                const language = transcription.language || 'en';
                const segments = transcription.segments || [];

                // Calculate average confidence from segments if available (Whisper verbose_json)
                let avgConfidence = 1.0;
                let modelUsed = config.openai.transcriptionModel;

                if (segments.length > 0) {
                    // This is Whisper verbose_json response
                    const totalConfidence = segments.reduce((sum, segment) =>
                        sum + (segment.avg_logprob ? Math.exp(segment.avg_logprob) : 1.0), 0
                    );
                    avgConfidence = totalConfidence / segments.length;
                    modelUsed = config.openai.whisperModel; // We fell back to Whisper
                } else {
                    // This is GPT-4o-transcribe json response - no detailed segments
                    // Use audio analysis volume as confidence indicator if available
                    if (audioAnalysis && audioAnalysis.volume) {
                        avgConfidence = Math.min(0.95, 0.5 + (audioAnalysis.volume * 2));
                    } else {
                        avgConfidence = 0.90; // Default high confidence for GPT-4o-transcribe
                    }
                    modelUsed = config.openai.transcriptionModel;
                }

                // Validate transcription content before proceeding
                const validation = validateTranscriptionContent(transcribedText, avgConfidence);

                if (!validation.isValid) {
                    console.log(`[TRANSCRIPTION] Filtered out transcription for user ${userId}: "${transcribedText}" - ${validation.reason}`);
                    return null; // Don't process invalid/noise transcriptions
                }

                console.log(`[TRANSCRIPTION] Successfully transcribed for user ${userId}: "${transcribedText}" (model: ${modelUsed}, confidence: ${avgConfidence.toFixed(2)}, duration: ${duration}s, language: ${language}, words: ${validation.wordCount})`);

                return {
                    userId,
                    text: transcribedText,
                    timestamp: new Date(),
                    confidence: avgConfidence,
                    duration,
                    language,
                    segments: segments.length,
                    model: modelUsed, // Track which model was actually used
                    validation, // Include validation results
                    audioAnalysis, // Include original audio analysis
                };
            } else {
                console.log(`[TRANSCRIPTION] No speech detected for user ${userId}`);
                return null;
            }
            
        } finally {
            // Clean up temporary files
            try {
                unlinkSync(rawPath);
                unlinkSync(wavPath);
            } catch (error) {
                console.error(`[TRANSCRIPTION] Failed to clean up temp files:`, error);
            }
        }
        
    } catch (error) {
        console.error(`[TRANSCRIPTION] Failed to transcribe audio for user ${userId}:`, error);
        
        // Return null for transcription errors to avoid breaking the flow
        return null;
    }
}

/**
 * Process multiple audio chunks and batch transcribe
 */
export async function batchTranscribe(audioChunks) {
    try {
        console.log(`[TRANSCRIPTION] Batch transcribing ${audioChunks.length} audio chunks`);
        
        const transcriptionPromises = audioChunks.map(chunk => 
            transcribeAudio(chunk.audioData, chunk.userId)
        );
        
        const results = await Promise.allSettled(transcriptionPromises);
        
        const transcriptions = results
            .filter(result => result.status === 'fulfilled' && result.value !== null)
            .map(result => result.value);
        
        console.log(`[TRANSCRIPTION] Successfully transcribed ${transcriptions.length} out of ${audioChunks.length} chunks`);
        
        return transcriptions;
        
    } catch (error) {
        console.error(`[TRANSCRIPTION] Batch transcription failed:`, error);
        return [];
    }
}

/**
 * Enhanced transcription with speaker diarization simulation
 * (Basic implementation - can be enhanced with actual speaker diarization)
 */
export async function transcribeWithSpeaker(audioBuffer, userId, username, audioAnalysis = null) {
    try {
        const transcription = await transcribeAudio(audioBuffer, userId, audioAnalysis);

        if (transcription) {
            return {
                ...transcription,
                username,
                speaker: username || `User_${userId.slice(-4)}`,
            };
        }

        return null;

    } catch (error) {
        console.error(`[TRANSCRIPTION] Failed to transcribe with speaker info:`, error);
        return null;
    }
}

/**
 * Test GPT-4o-transcribe functionality with sample audio
 */
export async function testGpt4oTranscribe() {
    try {
        console.log(`[TRANSCRIPTION] Testing GPT-4o-transcribe model availability`);

        // Test with a simple API call to check if model is available
        const testPromise = openai.models.retrieve(config.openai.transcriptionModel);

        const modelInfo = await testPromise;
        console.log(`[TRANSCRIPTION] GPT-4o-transcribe model info:`, {
            id: modelInfo.id,
            object: modelInfo.object,
            created: modelInfo.created,
        });

        return {
            available: true,
            model: modelInfo.id,
            message: 'GPT-4o-transcribe is available and ready to use'
        };

    } catch (error) {
        console.warn(`[TRANSCRIPTION] GPT-4o-transcribe test failed:`, error.message);

        // Check if error indicates model not available
        if (error.message.includes('model') || error.message.includes('not found')) {
            console.log(`[TRANSCRIPTION] Falling back to Whisper model: ${config.openai.whisperModel}`);
            return {
                available: false,
                fallback: config.openai.whisperModel,
                message: 'GPT-4o-transcribe not available, using Whisper fallback'
            };
        }

        return {
            available: false,
            error: error.message,
            message: 'Unable to test transcription models'
        };
    }
}

/**
 * Get transcription model statistics and health check
 */
export function getTranscriptionStats() {
    return {
        primaryModel: config.openai.transcriptionModel,
        fallbackModel: config.openai.whisperModel,
        supportedFormats: ['wav', 'mp3', 'm4a', 'ogg', 'webm'],
        maxFileSizeMB: 25,
        supportedLanguages: 'Auto-detect (100+ languages supported)',
        features: [
            'Improved word error rate vs Whisper',
            'Better language recognition',
            'Enhanced punctuation and capitalization',
            'High-confidence transcription',
            'Automatic fallback to Whisper if unavailable'
        ]
    };
}