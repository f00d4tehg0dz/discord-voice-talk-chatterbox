import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { removeCampaignInfo, getGuildConfig } from '../utility/database.js';

export const data = new SlashCommandBuilder()
    .setName('deletecampaign')
    .setDescription('Remove the campaign name and DM designation')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
    try {
        // Check if user has admin permissions
        if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ 
                content: 'You need administrator permissions to remove campaign information.', 
                ephemeral: true 
            });
        }

        const guildId = interaction.guildId;

        // Get current campaign info to include in confirmation message
        const guildConfig = await getGuildConfig(guildId);
        if (!guildConfig || (!guildConfig.campaignName && !guildConfig.dmUserId)) {
            return interaction.reply({
                content: 'No campaign information is currently set for this server.',
                ephemeral: true
            });
        }

        // Defer reply as database operations may take time
        await interaction.deferReply();

        // Remove campaign info from database
        await removeCampaignInfo(guildId);

        // Reply with success message
        let responseMessage = 'Campaign information has been removed.';
        if (guildConfig.campaignName) {
            responseMessage = `Campaign "${guildConfig.campaignName}" information has been removed. Future sessions will use default naming.`;
        }

        await interaction.editReply({
            content: responseMessage
        });
    } catch (error) {
        console.error('Error removing campaign information:', error);
        
        // Handle error response
        if (interaction.deferred) {
            await interaction.editReply({
                content: 'Failed to remove campaign information. Please try again later.'
            });
        } else {
            await interaction.reply({
                content: 'Failed to remove campaign information. Please try again later.',
                ephemeral: true
            });
        }
    }
} 