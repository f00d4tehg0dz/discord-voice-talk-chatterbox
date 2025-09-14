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
 * Convert audio buffer to transcribable format and transcribe
 */
export async function transcribeAudio(audioBuffer, userId) {
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
            
            // Transcribe using OpenAI Whisper
            const { createReadStream } = await import('fs');
            const transcription = await openai.audio.transcriptions.create({
                file: createReadStream(wavPath),
                model: config.openai.whisperModel,
                language: 'en', // Can be made configurable
                prompt: 'This is a conversation in a Discord voice channel.',
            });
            
            const transcribedText = transcription.text?.trim();
            
            if (transcribedText && transcribedText.length > 0) {
                console.log(`[TRANSCRIPTION] Successfully transcribed for user ${userId}: "${transcribedText}"`);
                return {
                    userId,
                    text: transcribedText,
                    timestamp: new Date(),
                    confidence: 1.0, // Whisper doesn't provide confidence scores
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
export async function transcribeWithSpeaker(audioBuffer, userId, username) {
    try {
        const transcription = await transcribeAudio(audioBuffer, userId);
        
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