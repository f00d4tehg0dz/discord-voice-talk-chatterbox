import { Client, Collection, GatewayIntentBits } from 'discord.js';
import { config, validateConfig } from './src/utils/config.js';
import { transcribeWithSpeaker, testGpt4oTranscribe, getTranscriptionStats } from './src/utils/transcription.js';
import { generateResponse, addContextMessage, getCharacterConfig } from './src/utils/chatgpt.js';
import { generateSpeechWithFallback, preprocessTextForTTS, checkTTSHealth } from './src/utils/tts.js';
import { playAudio, activeConnections } from './src/utils/voiceConnection.js';
import {
    generateImage,
    downloadImageBuffer,
    isImageRequest,
    isRedrawRequest,
    isShowPreviousSketchRequest,
    extractImagePrompt,
    determineArtStyle,
    generateImageResponse,
    storeRecentSketch,
    getLastSketch,
    findSketchByContent,
    generateShowSketchResponse
} from './src/utils/imageGeneration.js';
import { readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Validate configuration
try {
    validateConfig();
    console.log('Configuration validated successfully');
} catch (error) {
    console.error('Configuration error:', error.message);
    process.exit(1);
}

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// Collection to store commands
client.commands = new Collection();

/**
 * Load all command files
 */
async function loadCommands() {
    try {
        const commandsPath = join(__dirname, 'src', 'commands');
        const commandFiles = (await readdir(commandsPath)).filter(file => file.endsWith('.js'));
        
        console.log(`Loading ${commandFiles.length} commands...`);
        
        for (const file of commandFiles) {
            const commandPath = join(commandsPath, file);
            const command = await import(`file://${commandPath.replace(/\\/g, '/')}`);
            
            if (command.data && command.execute) {
                client.commands.set(command.data.name, command);
                console.log(`Loaded command: ${command.data.name}`);
            } else {
                console.warn(`Warning: Command ${file} is missing data or execute function`);
            }
        }
        
        console.log('All commands loaded successfully');
        
    } catch (error) {
        console.error('Failed to load commands:', error);
        process.exit(1);
    }
}

/**
 * Handle bot ready event
 */
client.once('ready', async () => {
    console.log(`Bot ready! Logged in as ${client.user.tag}`);
    console.log(`Connected to ${client.guilds.cache.size} guilds`);
    
    // Set bot status
    client.user.setActivity('for voice messages', { type: 'LISTENING' });
    
    // Check TTS health
    const ttsHealthy = await checkTTSHealth();
    if (ttsHealthy) {
        console.log('Chatterbox TTS server is healthy');
    } else {
        console.warn('Warning: Chatterbox TTS server is not responding - TTS features may not work');
    }

    // Test GPT-4o-transcribe availability
    const transcriptionTest = await testGpt4oTranscribe();
    if (transcriptionTest.available) {
        console.log('GPT-4o-transcribe is available and ready');
    } else {
        console.warn(`Warning: ${transcriptionTest.message}`);
    }

    // Log transcription stats
    const stats = getTranscriptionStats();
    console.log(`Transcription: Primary model: ${stats.primaryModel}, Fallback: ${stats.fallbackModel}`);

    console.log('Bot is fully ready and operational!');
});

/**
 * Handle slash command interactions
 */
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    
    const command = client.commands.get(interaction.commandName);
    if (!command) {
        console.warn(`Unknown command: ${interaction.commandName}`);
        return;
    }
    
    try {
        console.log(`[COMMAND] ${interaction.commandName} executed by ${interaction.member?.displayName || interaction.user.username} in ${interaction.guild?.name || 'DM'}`);
        await command.execute(interaction);
        
    } catch (error) {
        console.error(`[COMMAND] Error executing ${interaction.commandName}:`, error);
        
        const errorResponse = {
            content: 'Error: There was an error executing this command!',
            ephemeral: true,
        };
        
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(errorResponse);
            } else {
                await interaction.reply(errorResponse);
            }
        } catch (followUpError) {
            console.error(`[COMMAND] Failed to send error response:`, followUpError);
        }
    }
});

/**
 * Handle voice state updates (users joining/leaving voice channels)
 */
client.on('voiceStateUpdate', (oldState, newState) => {
    const guild = newState.guild;
    
    // Log voice state changes for debugging
    if (newState.member.user.bot) return; // Ignore bot state changes
    
    if (!oldState.channel && newState.channel) {
        console.log(`[VOICE] ${newState.member.displayName} joined ${newState.channel.name} in ${guild.name}`);
    } else if (oldState.channel && !newState.channel) {
        console.log(`[VOICE] ${oldState.member.displayName} left ${oldState.channel.name} in ${guild.name}`);
    } else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
        console.log(`[VOICE] ${newState.member.displayName} moved from ${oldState.channel.name} to ${newState.channel.name} in ${guild.name}`);
    }
});

/**
 * Handle audio data events from voice connection
 */
process.on('audioData', async (audioEvent) => {
    try {
        const { guildId, userId, audioData, timestamp, audioAnalysis } = audioEvent;
        
        console.log(`[AUDIO] Processing audio from user ${userId} in guild ${guildId}`);
        
        // Get user info
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            console.warn(`[AUDIO] Guild ${guildId} not found`);
            return;
        }

        // Get guild member to access display name/nickname
        const member = await guild.members.fetch(userId).catch(() => null);
        const username = member?.displayName || member?.user?.username || `User_${userId.slice(-4)}`;
        
        // Transcribe the audio with audio analysis for enhanced filtering
        const transcription = await transcribeWithSpeaker(audioData, userId, username, audioAnalysis);
        
        if (!transcription || !transcription.text) {
            console.log(`[AUDIO] No transcription result for user ${username}`);
            return;
        }
        
        console.log(`[AUDIO] Transcribed: ${username}: \"${transcription.text}\"`);
        
        // Check if bot should respond (simple heuristic - can be enhanced)
        const shouldRespond = shouldBotRespond(transcription.text, username);
        
        if (shouldRespond) {
            console.log(`[AUDIO] Bot will respond to ${username}'s message`);
            
            // Generate response using ChatGPT
            const { getGuildCharacter } = await import('./src/utils/chatgpt.js');
            const guildCharacter = getGuildCharacter(guildId);
            console.log(`[AUDIO] Guild character: ${guildCharacter}`);
            
            // Check if user is requesting an image/sketch/drawing
            const isImageReq = isImageRequest(transcription.text, guildId);
            const isRedraw = isRedrawRequest(transcription.text, guildId);
            const isShowPrevious = isShowPreviousSketchRequest(transcription.text, guildId);

            if (isImageReq || isRedraw || isShowPrevious) {
                console.log(`[IMAGE] User requested - Image: ${isImageReq}, Redraw: ${isRedraw}, Show Previous: ${isShowPrevious}`);
                await handleImageRequest(transcription.text, guildCharacter, guildId, username, guild, userId, { isRedraw, isShowPrevious });
                return; // Handle image request separately - prevents normal conversation flow
            }
            
            const response = await generateResponse(
                transcription.text,
                guildCharacter, // Use guild's current character
                guildId,
                userId,
                username
            );
            
            if (response && response.text) {
                console.log(`[AUDIO] Generated response: \"${response.text}\"`);
                
                // Generate and play speech first if bot is connected to voice
                if (activeConnections.has(guildId)) {
                    try {
                        const processedText = preprocessTextForTTS(response.text);
                        const audioBuffer = await generateSpeechWithFallback(processedText, response.voiceConfig);
                        
                        if (audioBuffer) {
                            // Send text response to channel right before audio starts playing
                            try {
                                const channels = guild.channels.cache.filter(ch => ch.type === 0); // TEXT channels
                                const textChannel = channels.find(ch => ch.name.includes('general') || ch.name.includes('chat')) || channels.first();
                                
                                if (textChannel) {
                                    await textChannel.send(`**${response.character}:** ${response.text}`);
                                }
                            } catch (error) {
                                console.warn(`[AUDIO] Could not send text response:`, error.message);
                            }
                            
                            await playAudio(guildId, audioBuffer);
                            console.log(`[AUDIO] Played voice response in guild ${guildId}`);
                        } else {
                            console.warn(`[AUDIO] TTS failed, sending text-only response`);
                            // Fallback to text-only response if TTS fails
                            try {
                                const channels = guild.channels.cache.filter(ch => ch.type === 0);
                                const textChannel = channels.find(ch => ch.name.includes('general') || ch.name.includes('chat')) || channels.first();
                                
                                if (textChannel) {
                                    await textChannel.send(`**${response.character}:** ${response.text}`);
                                }
                            } catch (error) {
                                console.warn(`[AUDIO] Could not send fallback text response:`, error.message);
                            }
                        }
                    } catch (ttsError) {
                        console.error(`[AUDIO] TTS/playback error:`, ttsError.message);
                        // Fallback to text-only response on TTS error
                        try {
                            const channels = guild.channels.cache.filter(ch => ch.type === 0);
                            const textChannel = channels.find(ch => ch.name.includes('general') || ch.name.includes('chat')) || channels.first();
                            
                            if (textChannel) {
                                await textChannel.send(`💬 **${response.character}:** ${response.text}`);
                            }
                        } catch (error) {
                            console.warn(`[AUDIO] Could not send fallback text response:`, error.message);
                        }
                    }
                } else {
                    // Bot not in voice channel, send text response only
                    try {
                        const channels = guild.channels.cache.filter(ch => ch.type === 0);
                        const textChannel = channels.find(ch => ch.name.includes('general') || ch.name.includes('chat')) || channels.first();
                        
                        if (textChannel) {
                            await textChannel.send(`💬 **${response.character}:** ${response.text}`);
                        }
                    } catch (error) {
                        console.warn(`[AUDIO] Could not send text response:`, error.message);
                    }
                }
            }
        } else {
            // Add to context without responding
            addContextMessage(guildId, username, transcription.text);
            console.log(`[AUDIO] Added ${username}'s message to context without responding`);
        }
        
    } catch (error) {
        console.error(`[AUDIO] Error processing audio data:`, error);
    }
});

/**
 * Handle image generation requests
 */
async function handleImageRequest(text, characterName, guildId, username, guild, userId, options = {}) {
    try {
        console.log(`[IMAGE] Handling image request from ${username}: "${text}"`);
        const { isRedraw, isShowPrevious } = options;

        // Handle showing previous sketch
        if (isShowPrevious) {
            console.log(`[IMAGE] User requested to show previous sketch`);

            const previousSketch = findSketchByContent(guildId, text) || getLastSketch(guildId);
            if (previousSketch) {
                const showResponse = generateShowSketchResponse(characterName, previousSketch);

                // Send voice response if connected
                if (activeConnections.has(guildId)) {
                    try {
                        const character = getCharacterConfig(characterName);
                        const processedText = preprocessTextForTTS(showResponse);
                        const audioBuffer = await generateSpeechWithFallback(processedText, character.voice_config);

                        if (audioBuffer) {
                            await playAudio(guildId, audioBuffer);
                            console.log(`[IMAGE] Played voice response for showing previous sketch`);
                        }
                    } catch (ttsError) {
                        console.error(`[IMAGE] TTS/playback error for show previous:`, ttsError.message);
                    }
                }

                // Send the previous sketch
                try {
                    const channels = guild.channels.cache.filter(ch => ch.type === 0);
                    const textChannel = channels.find(ch => ch.name.includes('general') || ch.name.includes('chat')) || channels.first();

                    if (textChannel && previousSketch.url) {
                        const imageBuffer = await downloadImageBuffer(previousSketch.url);
                        await textChannel.send({
                            content: `**${characterName}:** ${showResponse}`,
                            files: [{
                                attachment: imageBuffer,
                                name: `${characterName}_previous_artwork_${Date.now()}.png`,
                                description: `Previous artwork: ${previousSketch.originalPrompt || previousSketch.prompt}`
                            }]
                        });
                        console.log(`[IMAGE] Successfully showed previous sketch to ${username}`);
                    }
                } catch (error) {
                    console.error(`[IMAGE] Could not show previous sketch:`, error.message);
                }
                return;
            } else {
                // No previous sketch found
                const noSketchResponse = characterName.toLowerCase() === 'emma' ?
                    "Hmm, I can't remember making any sketches recently! Maybe ask me to draw something new?" :
                    "I have not conjured any visions recently. Perhaps request a new mystical creation?";

                try {
                    const channels = guild.channels.cache.filter(ch => ch.type === 0);
                    const textChannel = channels.find(ch => ch.name.includes('general') || ch.name.includes('chat')) || channels.first();

                    if (textChannel) {
                        await textChannel.send(`**${characterName}:** ${noSketchResponse}`);
                    }
                } catch (error) {
                    console.error(`[IMAGE] Could not send no sketch response:`, error.message);
                }
                return;
            }
        }

        // Extract the image prompt from user message
        const imagePrompt = isRedraw ?
            (getLastSketch(guildId)?.originalPrompt || extractImagePrompt(text)) :
            extractImagePrompt(text);
        const artStyle = determineArtStyle(text);

        console.log(`[IMAGE] Extracted prompt: "${imagePrompt}", Style: ${artStyle}, IsRedraw: ${isRedraw}`);

        // Send initial response with voice
        const initialResponse = generateImageResponse(characterName, imagePrompt, false, null, artStyle, isRedraw);
        
        // Send initial voice response if bot is connected to voice
        if (activeConnections.has(guildId)) {
            try {
                const character = getCharacterConfig(characterName);
                const processedText = preprocessTextForTTS(initialResponse);
                const audioBuffer = await generateSpeechWithFallback(processedText, character.voice_config);
                
                if (audioBuffer) {
                    await playAudio(guildId, audioBuffer);
                    console.log(`[IMAGE] Played initial voice response for image request`);
                }
            } catch (ttsError) {
                console.error(`[IMAGE] TTS/playback error for initial response:`, ttsError.message);
            }
        }
        
        try {
            const channels = guild.channels.cache.filter(ch => ch.type === 0);
            const textChannel = channels.find(ch => ch.name.includes('general') || ch.name.includes('chat')) || channels.first();
            
            if (textChannel) {
                await textChannel.send(`**${characterName}:** ${initialResponse}`);
            }
        } catch (error) {
            console.warn(`[IMAGE] Could not send initial response:`, error.message);
        }
        
        // Generate the image
        const imageResult = await generateImage(imagePrompt, artStyle, "standard");
        
        // Download image buffer for Discord
        const imageBuffer = await downloadImageBuffer(imageResult.url);
        
        // Store the generated sketch
        storeRecentSketch(guildId, imageResult, userId);

        // Send success response with image and voice
        const successResponse = generateImageResponse(characterName, imagePrompt, true, null, artStyle, isRedraw);

        // Send success voice response if bot is connected to voice
        if (activeConnections.has(guildId)) {
            try {
                const character = getCharacterConfig(characterName);
                const processedText = preprocessTextForTTS(successResponse);
                const audioBuffer = await generateSpeechWithFallback(processedText, character.voice_config);

                if (audioBuffer) {
                    await playAudio(guildId, audioBuffer);
                    console.log(`[IMAGE] Played success voice response for image completion`);
                }
            } catch (ttsError) {
                console.error(`[IMAGE] TTS/playback error for success response:`, ttsError.message);
            }
        }

        try {
            const channels = guild.channels.cache.filter(ch => ch.type === 0);
            const textChannel = channels.find(ch => ch.name.includes('general') || ch.name.includes('chat')) || channels.first();

            if (textChannel) {
                await textChannel.send({
                    content: `**${characterName}:** ${successResponse}`,
                    files: [{
                        attachment: imageBuffer,
                        name: `${characterName}_artwork_${Date.now()}.png`,
                        description: `Generated artwork: ${imageResult.revisedPrompt || imagePrompt}`
                    }]
                });
            }
        } catch (error) {
            console.error(`[IMAGE] Could not send image response:`, error.message);
            // Try to send error response
            try {
                const channels = guild.channels.cache.filter(ch => ch.type === 0);
                const textChannel = channels.find(ch => ch.name.includes('general') || ch.name.includes('chat')) || channels.first();

                if (textChannel) {
                    const errorResponse = generateImageResponse(characterName, imagePrompt, false, error.message, artStyle, isRedraw);
                    await textChannel.send(`**${characterName}:** ${errorResponse}`);
                }
            } catch (fallbackError) {
                console.error(`[IMAGE] Could not send error response:`, fallbackError.message);
            }
        }
        
        // Add image request and response to conversation context
        addContextMessage(guildId, username, `Requested artwork: ${imagePrompt}`, characterName);
        addContextMessage(guildId, characterName, successResponse, characterName);
        
        console.log(`[IMAGE] Successfully handled image request for ${username}`);
        
    } catch (error) {
        console.error(`[IMAGE] Failed to handle image request:`, error);
        
        // Send error response
        try {
            const channels = guild.channels.cache.filter(ch => ch.type === 0);
            const textChannel = channels.find(ch => ch.name.includes('general') || ch.name.includes('chat')) || channels.first();

            if (textChannel) {
                const artStyle = determineArtStyle(text);
                const errorResponse = generateImageResponse(characterName, text, false, error.message, artStyle, options.isRedraw);
                await textChannel.send(`**${characterName}:** ${errorResponse}`);
            }
        } catch (responseError) {
            console.error(`[IMAGE] Could not send error response:`, responseError.message);
        }
    }
}

/**
 * Determine if bot should respond to a message
 * This is a simple heuristic - can be enhanced with more sophisticated logic
 */
function shouldBotRespond(text, username) {
    const lowerText = text.toLowerCase();
    
    // Always respond to questions
    if (lowerText.includes('?')) return true;
    
    // Respond to direct mentions/calls
    const botMentions = ['bot', 'ai', 'assistant', 'hey', 'hello'];
    if (botMentions.some(mention => lowerText.includes(mention))) return true;
    
    // Respond to character names
    const characters = Object.keys(config.characters);
    if (characters.some(char => lowerText.includes(char.toLowerCase()))) return true;
    
    // Respond occasionally to keep conversation flowing (30% chance)
    if (Math.random() < 0.3) return true;
    
    // Don't respond to very short messages (likely not directed at bot)
    if (text.trim().length < 10) return false;
    
    // Respond to longer messages (more likely to be conversational)
    if (text.trim().length > 20) return true;
    
    return false;
}

/**
 * Handle errors
 */
client.on('error', (error) => {
    console.error('[DISCORD] Client error:', error);
});

process.on('uncaughtException', (error) => {
    console.error('[PROCESS] Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[PROCESS] Unhandled rejection at:', promise, 'reason:', reason);
});

/**
 * Graceful shutdown
 */
process.on('SIGINT', async () => {
    console.log('\\n[SHUTDOWN] Received SIGINT, shutting down gracefully...');
    
    // Clean up voice connections
    const { cleanup } = await import('./src/utils/voiceConnection.js');
    for (const guildId of activeConnections.keys()) {
        try {
            cleanup(guildId);
            console.log(`[SHUTDOWN] Cleaned up voice connection for guild ${guildId}`);
        } catch (error) {
            console.error(`[SHUTDOWN] Error cleaning up guild ${guildId}:`, error);
        }
    }
    
    // Destroy Discord client
    client.destroy();
    console.log('[SHUTDOWN] Bot shut down successfully');
    process.exit(0);
});

/**
 * Initialize and start the bot
 */
async function startBot() {
    try {
        // Load commands
        await loadCommands();
        
        // Login to Discord
        console.log('Logging in to Discord...');
        await client.login(config.discord.token);
        
    } catch (error) {
        console.error('Failed to start bot:', error);
        process.exit(1);
    }
}

// Start the bot
startBot();