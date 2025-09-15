/**
 * Discord Slash Command: /leave
 *
 * This command allows the bot to leave a voice channel and stop all voice processing.
 * It handles proper cleanup of voice connections, recording streams, and related resources.
 */

import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { cleanup, activeConnections } from '../utils/voiceConnection.js';

export const data = new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Leave the voice channel and stop listening')
    .setDefaultMemberPermissions(PermissionFlagsBits.Connect);

export async function execute(interaction) {
    try {
        console.log(`[LEAVE] Command executed by ${interaction.member?.displayName || interaction.user.username} in guild ${interaction.guildId}`);
        
        // Check if bot is connected to a voice channel
        const connection = activeConnections.get(interaction.guildId);
        
        if (!connection) {
            return await interaction.reply({
                content: 'Error: I\'m not connected to any voice channel!',
                ephemeral: true,
            });
        }
        
        // Get the voice channel name for the response
        let channelName = 'voice channel';
        try {
            const guild = interaction.client.guilds.cache.get(interaction.guildId);
            const botMember = guild.members.cache.get(interaction.client.user.id);
            const voiceChannel = botMember?.voice?.channel;
            if (voiceChannel) {
                channelName = voiceChannel.name;
            }
        } catch (error) {
            console.warn(`[LEAVE] Could not get channel name:`, error.message);
        }
        
        try {
            // Clean up voice connection and resources
            cleanup(interaction.guildId);
            
            console.log(`[LEAVE] Successfully left voice channel in guild ${interaction.guildId}`);
            
            await interaction.reply({
                content: `Left **${channelName}** and stopped listening.\n*Use \`/join\` to make me join a voice channel again.*`,
            });
            
        } catch (error) {
            console.error(`[LEAVE] Error during cleanup:`, error);
            
            // Force cleanup even if there was an error
            try {
                cleanup(interaction.guildId);
            } catch (cleanupError) {
                console.error(`[LEAVE] Force cleanup also failed:`, cleanupError);
            }
            
            await interaction.reply({
                content: `Warning: Left the voice channel but there may have been some cleanup issues.\n*If you experience problems, try \`/join\` again.*`,
                ephemeral: true,
            });
        }
        
    } catch (error) {
        console.error(`[LEAVE] Command error:`, error);
        
        const errorResponse = {
            content: 'Error: An error occurred while leaving the voice channel.',
            ephemeral: true,
        };
        
        try {
            await interaction.reply(errorResponse);
        } catch (replyError) {
            console.error(`[LEAVE] Failed to send error response:`, replyError);
        }
    }
}