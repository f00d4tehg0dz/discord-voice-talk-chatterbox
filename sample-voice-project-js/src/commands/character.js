/**
 * Discord Slash Command: /character
 *
 * This command manages AI character settings for the guild. It allows users to:
 * - Set the active character for the current server
 * - View the currently active character and its details
 * - List all available characters
 * - Get detailed information about a specific character
 * - Reset conversation context for fresh character interactions
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import {
    getAvailableCharacters,
    setGuildCharacter,
    getGuildCharacter,
    getConversationSummary,
    clearGuildContext
} from '../utils/chatgpt.js';
import { config } from '../utils/config.js';

export const data = new SlashCommandBuilder()
    .setName('character')
    .setDescription('Manage AI character settings')
    .addSubcommand(subcommand =>
        subcommand
            .setName('set')
            .setDescription('Set the active character')
            .addStringOption(option =>
                option.setName('name')
                    .setDescription('Character to set as active')
                    .setRequired(true)
                    .addChoices(
                        ...getAvailableCharacters().map(char => ({
                            name: char.displayName,
                            value: char.name
                        }))
                    )))
    .addSubcommand(subcommand =>
        subcommand
            .setName('current')
            .setDescription('Show the current active character'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('list')
            .setDescription('List all available characters'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('info')
            .setDescription('Get detailed information about a character')
            .addStringOption(option =>
                option.setName('name')
                    .setDescription('Character to get info about')
                    .setRequired(true)
                    .addChoices(
                        ...getAvailableCharacters().map(char => ({
                            name: char.displayName,
                            value: char.name
                        }))
                    )))
    .addSubcommand(subcommand =>
        subcommand
            .setName('reset')
            .setDescription('Reset the conversation context for the current character'));

export async function execute(interaction) {
    try {
        const subcommand = interaction.options.getSubcommand();
        console.log(`[CHARACTER] ${subcommand} subcommand executed by ${interaction.member?.displayName || interaction.user.username} in guild ${interaction.guildId}`);
        
        switch (subcommand) {
            case 'set':
                await handleSet(interaction);
                break;
            case 'current':
                await handleCurrent(interaction);
                break;
            case 'list':
                await handleList(interaction);
                break;
            case 'info':
                await handleInfo(interaction);
                break;
            case 'reset':
                await handleReset(interaction);
                break;
            default:
                await interaction.reply({
                    content: 'Error: Unknown subcommand.',
                    ephemeral: true,
                });
        }
        
    } catch (error) {
        console.error(`[CHARACTER] Command error:`, error);
        
        const errorResponse = {
            content: 'Error: An error occurred while processing the character command.',
            ephemeral: true,
        };
        
        if (interaction.deferred) {
            await interaction.editReply(errorResponse);
        } else {
            await interaction.reply(errorResponse);
        }
    }
}

async function handleSet(interaction) {
    const characterName = interaction.options.getString('name');
    
    try {
        const newCharacter = setGuildCharacter(interaction.guildId, characterName);
        const characterConfig = config.characters[newCharacter];
        
        const embed = new EmbedBuilder()
            .setTitle('Character Set')
            .setDescription(`Active character changed to **${characterConfig.name}**`)
            .addFields(
                { name: 'Character', value: characterConfig.name, inline: true },
                { name: 'Voice', value: characterConfig.voice_config?.voice_id || 'Default', inline: true },
                { name: 'Greeting', value: characterConfig.greeting || 'No greeting set', inline: false }
            )
            .setColor(0x00ff00)
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
        
        // If bot is in a voice channel, play the new character's greeting
        const { activeConnections } = await import('../utils/voiceConnection.js');
        if (activeConnections.has(interaction.guildId) && characterConfig.greeting) {
            try {
                const { generateSpeechWithFallback, preprocessTextForTTS } = await import('../utils/tts.js');
                const { playAudio } = await import('../utils/voiceConnection.js');
                
                const greetingText = preprocessTextForTTS(characterConfig.greeting);
                const audioBuffer = await generateSpeechWithFallback(greetingText, characterConfig.voice_config);
                
                if (audioBuffer) {
                    setTimeout(async () => {
                        try {
                            await playAudio(interaction.guildId, audioBuffer);
                            console.log(`[CHARACTER] Played greeting for new character ${characterConfig.name}`);
                        } catch (error) {
                            console.error(`[CHARACTER] Failed to play character greeting:`, error);
                        }
                    }, 1000);
                }
            } catch (error) {
                console.error(`[CHARACTER] Failed to generate greeting for new character:`, error);
            }
        }
        
    } catch (error) {
        console.error(`[CHARACTER] Failed to set character:`, error);
        await interaction.reply({
            content: `Error: Failed to set character "${characterName}": ${error.message}`,
            ephemeral: true,
        });
    }
}

async function handleCurrent(interaction) {
    const currentCharacter = getGuildCharacter(interaction.guildId);
    const characterConfig = config.characters[currentCharacter];
    const conversationInfo = getConversationSummary(interaction.guildId);
    
    if (!characterConfig) {
        return await interaction.reply({
            content: `Error: Current character "${currentCharacter}" configuration not found.`,
            ephemeral: true,
        });
    }
    
    const embed = new EmbedBuilder()
        .setTitle('Current Character')
        .setDescription(`**${characterConfig.name}** is currently active`)
        .addFields(
            { name: 'Voice ID', value: characterConfig.voice_config?.voice_id || 'Default', inline: true },
            { name: 'Speed', value: (characterConfig.voice_config?.speed || 1.0).toString(), inline: true },
            { name: 'Pitch', value: (characterConfig.voice_config?.pitch || 1.0).toString(), inline: true },
            { name: 'Greeting', value: characterConfig.greeting || 'No greeting set', inline: false }
        )
        .setColor(0x0099ff)
        .setTimestamp();
    
    if (conversationInfo) {
        embed.addFields(
            { name: 'Conversation Stats', 
              value: `Messages: ${conversationInfo.messageCount}\nParticipants: ${conversationInfo.participants.length}\nLast Activity: <t:${Math.floor(conversationInfo.lastActivity.getTime() / 1000)}:R>`, 
              inline: false }
        );
    }
    
    await interaction.reply({ embeds: [embed] });
}

async function handleList(interaction) {
    const characters = getAvailableCharacters();
    const currentCharacter = getGuildCharacter(interaction.guildId);
    
    const embed = new EmbedBuilder()
        .setTitle('Available Characters')
        .setDescription('Here are all the available characters:')
        .setColor(0x9932cc)
        .setTimestamp();
    
    characters.forEach(char => {
        const isActive = char.name === currentCharacter;
        const status = isActive ? '**Active**' : 'Available';
        
        embed.addFields({
            name: `${char.displayName} ${isActive ? '(Current)' : ''}`,
            value: `${status}\n*${char.greeting.substring(0, 100)}${char.greeting.length > 100 ? '...' : ''}*`,
            inline: true
        });
    });
    
    embed.addFields({
        name: '💡 Usage',
        value: 'Use `/character set <name>` to switch to a different character.',
        inline: false
    });
    
    await interaction.reply({ embeds: [embed] });
}

async function handleInfo(interaction) {
    const characterName = interaction.options.getString('name');
    const characterConfig = config.characters[characterName];
    
    if (!characterConfig) {
        return await interaction.reply({
            content: `Error: Character "${characterName}" not found.`,
            ephemeral: true,
        });
    }
    
    const currentCharacter = getGuildCharacter(interaction.guildId);
    const isActive = characterName === currentCharacter;
    
    const embed = new EmbedBuilder()
        .setTitle(`${characterConfig.name}${isActive ? ' (Active)' : ''}`)
        .setDescription(characterConfig.system_prompt || 'No description available')
        .addFields(
            { name: 'Voice Configuration', 
              value: `**ID:** ${characterConfig.voice_config?.voice_id || 'Default'}\n**Speed:** ${characterConfig.voice_config?.speed || 1.0}\n**Pitch:** ${characterConfig.voice_config?.pitch || 1.0}\n**Style:** ${characterConfig.voice_config?.style || 'Default'}`, 
              inline: true },
            { name: 'Greeting Message', 
              value: characterConfig.greeting || 'No greeting set', 
              inline: false }
        )
        .setColor(isActive ? 0x00ff00 : 0x0099ff)
        .setTimestamp();
    
    if (isActive) {
        const conversationInfo = getConversationSummary(interaction.guildId);
        if (conversationInfo) {
            embed.addFields({
                name: 'Current Session',
                value: `Messages: ${conversationInfo.messageCount}\nParticipants: ${conversationInfo.participants.join(', ')}\nLast Activity: <t:${Math.floor(conversationInfo.lastActivity.getTime() / 1000)}:R>`,
                inline: false
            });
        }
    }
    
    await interaction.reply({ embeds: [embed] });
}

async function handleReset(interaction) {
    const currentCharacter = getGuildCharacter(interaction.guildId);
    const characterConfig = config.characters[currentCharacter];
    
    try {
        const wasCleared = clearGuildContext(interaction.guildId);
        
        const embed = new EmbedBuilder()
            .setColor(wasCleared ? 0x00ff00 : 0xffaa00)
            .setTimestamp();
        
        if (wasCleared) {
            embed
                .setTitle('Context Reset')
                .setDescription(`Conversation context cleared for **${characterConfig?.name || currentCharacter}**`)
                .addFields({
                    name: 'What happened?',
                    value: 'The character will start fresh without memory of previous conversations in this server.',
                    inline: false
                });
        } else {
            embed
                .setTitle('No Context to Reset')
                .setDescription(`No active conversation context found for **${characterConfig?.name || currentCharacter}**`)
                .addFields({
                    name: '💡 Note',
                    value: 'The character context will be created fresh when the next conversation starts.',
                    inline: false
                });
        }
        
        await interaction.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error(`[CHARACTER] Failed to reset context:`, error);
        await interaction.reply({
            content: 'Error: Failed to reset character context. Please try again.',
            ephemeral: true,
        });
    }
}