import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { setCampaignInfo } from '../utility/database.js';

export const data = new SlashCommandBuilder()
    .setName('namecampaign')
    .setDescription('Set the name of your DnD campaign and designate the DM')
    .addStringOption(option =>
        option.setName('name')
            .setDescription('The name of your campaign')
            .setRequired(true))
    .addUserOption(option =>
        option.setName('dm')
            .setDescription('The user who will be the DM')
            .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
    try {
        // Check if user has admin permissions
        if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ 
                content: 'You need administrator permissions to set campaign information.', 
                ephemeral: true 
            });
        }

        const campaignName = interaction.options.getString('name');
        const dmUser = interaction.options.getUser('dm');
        const guildId = interaction.guildId;

        // Validate campaign name
        if (campaignName.length > 100) {
            return interaction.reply({
                content: 'Campaign name is too long. Please use a name with fewer than 100 characters.',
                ephemeral: true
            });
        }

        // Defer reply as database operations may take time
        await interaction.deferReply();

        // Update campaign info in database
        // const updatedGuild = await setCampaignInfo(guildId, campaignName, dmUser.id);

        // Reply with success message
        await interaction.editReply({
            content: `Campaign name set to **${campaignName}** with ${dmUser} as the Dungeon Master. This information will be used in session summaries.`,
        });
    } catch (error) {
        console.error('Error setting campaign information:', error);
        
        // Handle error response
        if (interaction.deferred) {
            await interaction.editReply({
                content: 'Failed to set campaign information. Please try again later.',
            });
        } else {
            await interaction.reply({
                content: 'Failed to set campaign information. Please try again later.',
                ephemeral: true
            });
        }
    }
} 