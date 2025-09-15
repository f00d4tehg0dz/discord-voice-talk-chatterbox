/**
 * Discord Slash Command: /join
 *
 * This command allows the bot to join a voice channel and start listening for user speech.
 * It handles voice channel validation, permission checking, character selection, and
 * initializes the voice recording system.
 */

import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { setupVoiceConnection, startRecording } from '../utils/voiceConnection.js';
import { getGuildCharacter, getAvailableCharacters } from '../utils/chatgpt.js';
import { config } from '../utils/config.js';

export const data = new SlashCommandBuilder()
    .setName('join')
    .setDescription('Join your voice channel and start listening')
    .addChannelOption(option =>
        option.setName('channel')
            .setDescription('Voice channel to join (optional - will use your current channel if not specified)')
            .setRequired(false))
    .addStringOption(option =>
        option.setName('character')
            .setDescription('Character to use for responses')
            .setRequired(false)
            .addChoices(
                ...getAvailableCharacters().map(char => ({
                    name: char.displayName,
                    value: char.name
                }))
            ))
    .setDefaultMemberPermissions(PermissionFlagsBits.Connect);

export async function execute(interaction) {
    try {
        console.log(`[JOIN] Command executed by ${interaction.member?.displayName || interaction.user.username} in guild ${interaction.guildId}`);
        
        await interaction.deferReply();
        
        // Get the voice channel to join
        let voiceChannel = interaction.options.getChannel('channel');
        
        // If no channel specified, try to use the user's current voice channel
        if (!voiceChannel) {
            const member = interaction.guild.members.cache.get(interaction.user.id);
            voiceChannel = member?.voice?.channel;
            
            if (!voiceChannel) {
                return await interaction.editReply({
                    content: 'Error: You need to be in a voice channel or specify a channel to join!',
                });
            }
        }
        
        // Validate channel type
        if (voiceChannel.type !== 2) { // 2 = GUILD_VOICE
            return await interaction.editReply({
                content: 'Error: The specified channel is not a voice channel!',
            });
        }
        
        // Check bot permissions
        const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
        const permissions = voiceChannel.permissionsFor(botMember);
        
        if (!permissions.has(['Connect', 'Speak', 'UseVAD'])) {
            return await interaction.editReply({
                content: `Error: I don't have the required permissions for ${voiceChannel.name}!\nI need: Connect, Speak, and Use Voice Activity.`,
            });
        }
        
        // Set character if specified
        const characterName = interaction.options.getString('character');
        let currentCharacter = getGuildCharacter(interaction.guildId);
        
        if (characterName) {
            try {
                const { setGuildCharacter } = await import('../utils/chatgpt.js');
                currentCharacter = setGuildCharacter(interaction.guildId, characterName);
            } catch (error) {
                console.error(`[JOIN] Failed to set character:`, error);
                return await interaction.editReply({
                    content: `Error: Failed to set character "${characterName}". Using default character instead.`,
                });
            }
        }
        
        try {
            // Set up voice connection
            const connection = await setupVoiceConnection(interaction.guildId, voiceChannel.id, voiceChannel.guild.voiceAdapterCreator);
            
            // Start audio recording
            startRecording(interaction.guildId, connection);
            
            // Get character info
            const character = config.characters[currentCharacter];
            const characterDisplay = character ? character.name : currentCharacter;
            
            console.log(`[JOIN] Successfully joined ${voiceChannel.name} in guild ${interaction.guildId}`);
            
            await interaction.editReply({
                content: `**Joined ${voiceChannel.name}**\n` +
                        `**Character:** ${characterDisplay}\n` +
                        `I'm now listening and will respond to your voice messages!\n\n` +
                        `*Use \`/leave\` to make me leave the channel*`,
            });
            
            // Send character greeting if available
            if (character && character.greeting) {
                // Import TTS and playback functions
                const { generateSpeechWithFallback, preprocessTextForTTS } = await import('../utils/tts.js');
                const { playAudio } = await import('../utils/voiceConnection.js');
                
                try {
                    const greetingText = preprocessTextForTTS(character.greeting);
                    const audioBuffer = await generateSpeechWithFallback(greetingText, character.voice_config);
                    
                    if (audioBuffer) {
                        // Wait a moment before playing greeting
                        setTimeout(async () => {
                            try {
                                await playAudio(interaction.guildId, audioBuffer);
                                console.log(`[JOIN] Played character greeting for ${characterDisplay}`);
                            } catch (error) {
                                console.error(`[JOIN] Failed to play greeting:`, error);
                            }
                        }, 2000);
                    }
                    
                    // Also send greeting as text
                    setTimeout(async () => {
                        try {
                            await interaction.followUp({
                                content: `**${characterDisplay}:** ${character.greeting}`,
                            });
                        } catch (error) {
                            console.error(`[JOIN] Failed to send greeting message:`, error);
                        }
                    }, 1000);
                    
                } catch (error) {
                    console.error(`[JOIN] Failed to generate greeting:`, error);
                    
                    // Send text-only greeting as fallback
                    setTimeout(async () => {
                        try {
                            await interaction.followUp({
                                content: `**${characterDisplay}:** ${character.greeting}`,
                            });
                        } catch (error) {
                            console.error(`[JOIN] Failed to send fallback greeting:`, error);
                        }
                    }, 1000);
                }
            }
            
        } catch (error) {
            console.error(`[JOIN] Failed to join voice channel:`, error);
            
            let errorMessage = 'Error: Failed to join the voice channel. ';
            
            if (error.message.includes('VOICE_CONNECTION_TIMEOUT')) {
                errorMessage += 'Connection timed out. Please try again.';
            } else if (error.message.includes('NO_ADAPTER')) {
                errorMessage += 'Voice adapter not available. Please try again.';
            } else {
                errorMessage += 'Please check my permissions and try again.';
            }
            
            await interaction.editReply({
                content: errorMessage,
            });
        }
        
    } catch (error) {
        console.error(`[JOIN] Command error:`, error);
        
        const errorResponse = {
            content: 'Error: An unexpected error occurred. Please try again.',
        };
        
        if (interaction.deferred) {
            await interaction.editReply(errorResponse);
        } else {
            await interaction.reply({ ...errorResponse, ephemeral: true });
        }
    }
}