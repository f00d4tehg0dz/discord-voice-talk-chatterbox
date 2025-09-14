import { Client, Collection, GatewayIntentBits } from 'discord.js';
import { config, validateConfig } from './src/utils/config.js';
import { transcribeWithSpeaker } from './src/utils/transcription.js';
import { generateResponse, addContextMessage } from './src/utils/chatgpt.js';
import { generateSpeechWithFallback, preprocessTextForTTS, checkTTSHealth } from './src/utils/tts.js';
import { playAudio, activeConnections } from './src/utils/voiceConnection.js';
import { readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Validate configuration
try {
    validateConfig();
    console.log('✅ Configuration validated successfully');
} catch (error) {
    console.error('❌ Configuration error:', error.message);
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
                console.log(`✅ Loaded command: ${command.data.name}`);
            } else {
                console.warn(`⚠️ Command ${file} is missing data or execute function`);
            }
        }
        
        console.log('✅ All commands loaded successfully');
        
    } catch (error) {
        console.error('❌ Failed to load commands:', error);
        process.exit(1);
    }
}

/**
 * Handle bot ready event
 */
client.once('ready', async () => {
    console.log(`🤖 Bot ready! Logged in as ${client.user.tag}`);
    console.log(`📊 Connected to ${client.guilds.cache.size} guilds`);
    
    // Set bot status
    client.user.setActivity('for voice messages 🎤', { type: 'LISTENING' });
    
    // Check TTS health
    const ttsHealthy = await checkTTSHealth();
    if (ttsHealthy) {
        console.log('✅ Chatterbox TTS server is healthy');
    } else {
        console.warn('⚠️ Chatterbox TTS server is not responding - TTS features may not work');
    }
    
    console.log('🚀 Bot is fully ready and operational!');
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
        console.log(`[COMMAND] ${interaction.commandName} executed by ${interaction.user.username} in ${interaction.guild?.name || 'DM'}`);
        await command.execute(interaction);
        
    } catch (error) {
        console.error(`[COMMAND] Error executing ${interaction.commandName}:`, error);
        
        const errorResponse = {
            content: '❌ There was an error executing this command!',
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
        console.log(`[VOICE] ${newState.member.user.username} joined ${newState.channel.name} in ${guild.name}`);
    } else if (oldState.channel && !newState.channel) {
        console.log(`[VOICE] ${oldState.member.user.username} left ${oldState.channel.name} in ${guild.name}`);
    } else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
        console.log(`[VOICE] ${newState.member.user.username} moved from ${oldState.channel.name} to ${newState.channel.name} in ${guild.name}`);
    }
});

/**
 * Handle audio data events from voice connection
 */
process.on('audioData', async (audioEvent) => {
    try {
        const { guildId, userId, audioData, timestamp } = audioEvent;
        
        console.log(`[AUDIO] Processing audio from user ${userId} in guild ${guildId}`);
        
        // Get user info
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            console.warn(`[AUDIO] Guild ${guildId} not found`);
            return;
        }
        
        const user = await client.users.fetch(userId).catch(() => null);
        const username = user?.username || `User_${userId.slice(-4)}`;
        
        // Transcribe the audio
        const transcription = await transcribeWithSpeaker(audioData, userId, username);
        
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
                                    await textChannel.send(`💬 **${response.character}:** ${response.text}`);
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
                                    await textChannel.send(`💬 **${response.character}:** ${response.text}`);
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
        console.log('🔐 Logging in to Discord...');
        await client.login(config.discord.token);
        
    } catch (error) {
        console.error('❌ Failed to start bot:', error);
        process.exit(1);
    }
}

// Start the bot
startBot();