import {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    entersState,
    VoiceConnectionStatus,
    AudioPlayerStatus,
    getVoiceConnection
} from '@discordjs/voice';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';
import prism from 'prism-media';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { config } from './config.js';

const pipelineAsync = promisify(pipeline);

// Store active voice connections and audio players
export const activeConnections = new Map();
export const activeRecorders = new Map();
export const audioPlayers = new Map();

/**
 * Join a voice channel and set up audio recording
 */
export async function setupVoiceConnection(guildId, channelId, adapterCreator) {
    try {
        console.log(`[VOICE] Setting up voice connection for guild ${guildId}, channel ${channelId}`);
        
        // Check if already connected
        const existingConnection = getVoiceConnection(guildId);
        if (existingConnection) {
            console.log(`[VOICE] Already connected to guild ${guildId}`);
            return existingConnection;
        }
        
        // Join voice channel
        const connection = joinVoiceChannel({
            channelId: channelId,
            guildId: guildId,
            adapterCreator: adapterCreator,
            selfDeaf: false,
            selfMute: false,
        });
        
        // Wait for connection to be ready
        await entersState(connection, VoiceConnectionStatus.Ready, 30000);
        console.log(`[VOICE] Successfully connected to voice channel`);
        
        // Store the connection
        activeConnections.set(guildId, connection);
        
        // Set up error handling
        connection.on('error', (error) => {
            console.error(`[VOICE] Connection error for guild ${guildId}:`, error);
        });
        
        connection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await Promise.race([
                    entersState(connection, VoiceConnectionStatus.Signalling, 5000),
                    entersState(connection, VoiceConnectionStatus.Connecting, 5000),
                ]);
            } catch (error) {
                console.log(`[VOICE] Connection lost for guild ${guildId}, cleaning up`);
                cleanup(guildId);
            }
        });
        
        // Set up audio player
        const player = createAudioPlayer();
        connection.subscribe(player);
        audioPlayers.set(guildId, player);
        
        player.on(AudioPlayerStatus.Playing, () => {
            console.log(`[VOICE] Audio player started playing for guild ${guildId}`);
        });
        
        player.on(AudioPlayerStatus.Idle, () => {
            console.log(`[VOICE] Audio player finished playing for guild ${guildId}`);
        });
        
        player.on('error', (error) => {
            console.error(`[VOICE] Audio player error for guild ${guildId}:`, error);
        });
        
        return connection;
        
    } catch (error) {
        console.error(`[VOICE] Failed to set up voice connection for guild ${guildId}:`, error);
        cleanup(guildId);
        throw error;
    }
}

/**
 * Start recording audio from users in the voice channel
 */
export function startRecording(guildId, connection) {
    try {
        console.log(`[VOICE] Starting audio recording for guild ${guildId}`);
        
        if (activeRecorders.has(guildId)) {
            console.log(`[VOICE] Already recording for guild ${guildId}`);
            return activeRecorders.get(guildId);
        }
        
        const receiver = connection.receiver;
        const recorder = {
            userStreams: new Map(),
            audioBuffers: new Map(),
            isRecording: true,
        };
        
        // Listen for users speaking
        receiver.speaking.on('start', (userId) => {
            if (recorder.userStreams.has(userId)) return;
            
            console.log(`[VOICE] User ${userId} started speaking in guild ${guildId}`);
            
            // Create audio stream for this user
            const audioStream = receiver.subscribe(userId, {
                end: {
                    behavior: 'afterSilence',
                    duration: 500, // 0.5 seconds of silence before ending
                },
            });
            
            console.log(`[VOICE] Created audio stream for user ${userId}`);
            
            // Set up audio processing pipeline
            const decoder = new prism.opus.Decoder({
                frameSize: 960,
                channels: 2,
                rate: 48000,
            });
            
            const audioBuffer = [];
            recorder.userStreams.set(userId, { audioStream, decoder, audioBuffer });
            recorder.audioBuffers.set(userId, audioBuffer);
            
            // Process audio data
            decoder.on('data', (chunk) => {
                audioBuffer.push(chunk);
                console.log(`[VOICE] Received audio chunk from user ${userId}, size: ${chunk.length}, total chunks: ${audioBuffer.length}`);
            });
            
            decoder.on('end', () => {
                console.log(`[VOICE] Audio stream ended for user ${userId} in guild ${guildId}, buffer chunks: ${audioBuffer.length}`);
                recorder.userStreams.delete(userId);
                
                // Process the complete audio buffer
                if (audioBuffer.length > 0) {
                    console.log(`[VOICE] Processing ${audioBuffer.length} audio chunks for user ${userId}`);
                    processAudioBuffer(guildId, userId, audioBuffer);
                } else {
                    console.log(`[VOICE] No audio data to process for user ${userId}`);
                }
            });
            
            decoder.on('error', (error) => {
                console.error(`[VOICE] Audio decoder error for user ${userId}:`, error);
                recorder.userStreams.delete(userId);
            });
            
            // Add audio stream event listeners
            audioStream.on('data', (chunk) => {
                console.log(`[VOICE] Raw audio data from user ${userId}, size: ${chunk.length}`);
            });
            
            audioStream.on('end', () => {
                console.log(`[VOICE] Audio stream ended for user ${userId}`);
            });
            
            audioStream.on('error', (error) => {
                console.error(`[VOICE] Audio stream error for user ${userId}:`, error);
            });
            
            // Pipe audio stream through decoder
            audioStream.pipe(decoder);
        });
        
        receiver.speaking.on('end', (userId) => {
            console.log(`[VOICE] User ${userId} stopped speaking in guild ${guildId}`);
            
            // Process audio when user stops speaking - use a timeout to allow for final audio chunks
            setTimeout(() => {
                const userStream = recorder.userStreams.get(userId);
                if (userStream && userStream.audioBuffer.length > 0) {
                    console.log(`[VOICE] Processing ${userStream.audioBuffer.length} audio chunks for user ${userId} (speaking ended)`);
                    // Create a copy of the buffer before processing to avoid race conditions
                    const bufferCopy = [...userStream.audioBuffer];
                    processAudioBuffer(guildId, userId, bufferCopy);
                    
                    // Clear the original buffer after processing
                    userStream.audioBuffer.length = 0;
                }
            }, 100); // Small delay to ensure all audio chunks are captured
        });
        
        activeRecorders.set(guildId, recorder);
        return recorder;
        
    } catch (error) {
        console.error(`[VOICE] Failed to start recording for guild ${guildId}:`, error);
        throw error;
    }
}

/**
 * Analyze audio buffer for silence and noise detection
 */
function analyzeAudioBuffer(audioBuffer) {
    if (!audioBuffer || audioBuffer.length === 0) {
        return { isSilence: true, volume: 0, reason: 'Empty buffer' };
    }

    // Calculate RMS (Root Mean Square) to measure audio level
    let sum = 0;
    let maxValue = 0;
    const samples = audioBuffer.length / 2; // 16-bit audio = 2 bytes per sample

    for (let i = 0; i < audioBuffer.length; i += 2) {
        // Read 16-bit little-endian sample
        const sample = audioBuffer.readInt16LE(i);
        const absValue = Math.abs(sample);

        sum += sample * sample;
        maxValue = Math.max(maxValue, absValue);
    }

    const rms = Math.sqrt(sum / samples);
    const volume = rms / 32768; // Normalize to 0-1 range (16-bit max = 32768)
    const peakVolume = maxValue / 32768;

    // Use configurable thresholds for silence detection
    const SILENCE_THRESHOLD = config.audioFilter.silenceThreshold;
    const NOISE_THRESHOLD = config.audioFilter.noiseThreshold;
    const PEAK_THRESHOLD = config.audioFilter.peakThreshold;
    const MIN_SAMPLES = (config.audioFilter.minDurationMs * 48000) / 1000; // Convert ms to samples

    let isSilence = false;
    let reason = '';

    if (volume < SILENCE_THRESHOLD) {
        isSilence = true;
        reason = 'Audio level too low (silence)';
    } else if (volume < NOISE_THRESHOLD && peakVolume < PEAK_THRESHOLD) {
        isSilence = true;
        reason = 'Audio level indicates background noise only';
    } else if (samples < MIN_SAMPLES) {
        isSilence = true;
        reason = `Audio duration too short (${(samples / 48000).toFixed(2)}s < ${(MIN_SAMPLES / 48000).toFixed(2)}s)`;
    }

    return {
        isSilence,
        volume,
        peakVolume,
        duration: samples / 48000, // Convert to seconds (48kHz sample rate)
        reason: reason || 'Contains meaningful audio'
    };
}

/**
 * Process audio buffer for transcription
 */
async function processAudioBuffer(guildId, userId, audioBuffer) {
    try {
        console.log(`[VOICE] Processing audio buffer for user ${userId} in guild ${guildId}, chunks: ${audioBuffer.length}`);

        if (audioBuffer.length === 0) {
            console.log(`[VOICE] Empty audio buffer for user ${userId}, skipping`);
            return;
        }

        // Combine audio chunks
        const audioData = Buffer.concat(audioBuffer);
        console.log(`[VOICE] Combined audio data size: ${audioData.length} bytes for user ${userId}`);

        // Analyze audio for silence/noise before transcription
        const audioAnalysis = analyzeAudioBuffer(audioData);
        console.log(`[VOICE] Audio analysis for user ${userId}: volume=${audioAnalysis.volume.toFixed(4)}, peak=${audioAnalysis.peakVolume.toFixed(4)}, duration=${audioAnalysis.duration.toFixed(2)}s, silence=${audioAnalysis.isSilence}, reason="${audioAnalysis.reason}"`);

        if (audioAnalysis.isSilence) {
            console.log(`[VOICE] Skipping transcription for user ${userId}: ${audioAnalysis.reason}`);
            return; // Don't process silent/noise-only audio
        }

        // Emit event for transcription processing
        // This will be handled by the transcription service
        console.log(`[VOICE] Emitting audioData event for user ${userId} (passed audio analysis)`);
        process.emit('audioData', {
            guildId,
            userId,
            audioData,
            timestamp: new Date(),
            audioAnalysis, // Include analysis data for further filtering
        });

    } catch (error) {
        console.error(`[VOICE] Failed to process audio buffer for user ${userId}:`, error);
    }
}

/**
 * Play audio in voice channel
 */
export async function playAudio(guildId, audioBuffer) {
    try {
        const player = audioPlayers.get(guildId);
        if (!player) {
            throw new Error(`No audio player found for guild ${guildId}`);
        }
        
        console.log(`[VOICE] Playing audio in guild ${guildId}, size: ${audioBuffer.length} bytes`);
        
        // Convert buffer to readable stream
        const audioStream = Readable.from(audioBuffer);
        
        const resource = createAudioResource(audioStream, {
            inputType: 'arbitrary',
        });
        
        player.play(resource);
        
        // Wait for audio to finish playing
        await entersState(player, AudioPlayerStatus.Playing, 5000);
        await entersState(player, AudioPlayerStatus.Idle, 30000);
        
        console.log(`[VOICE] Finished playing audio in guild ${guildId}`);
        
    } catch (error) {
        console.error(`[VOICE] Failed to play audio in guild ${guildId}:`, error);
        throw error;
    }
}

/**
 * Stop recording and clean up resources
 */
export function cleanup(guildId) {
    try {
        console.log(`[VOICE] Cleaning up voice resources for guild ${guildId}`);
        
        // Stop recording
        const recorder = activeRecorders.get(guildId);
        if (recorder) {
            recorder.isRecording = false;
            for (const [userId, stream] of recorder.userStreams) {
                try {
                    stream.audioStream.destroy();
                    stream.decoder.destroy();
                } catch (error) {
                    console.error(`[VOICE] Error cleaning up stream for user ${userId}:`, error);
                }
            }
            activeRecorders.delete(guildId);
        }
        
        // Clean up audio player
        const player = audioPlayers.get(guildId);
        if (player) {
            player.stop();
            audioPlayers.delete(guildId);
        }
        
        // Destroy voice connection
        const connection = activeConnections.get(guildId);
        if (connection) {
            connection.destroy();
            activeConnections.delete(guildId);
        }
        
        console.log(`[VOICE] Cleanup completed for guild ${guildId}`);
        
    } catch (error) {
        console.error(`[VOICE] Error during cleanup for guild ${guildId}:`, error);
    }
}