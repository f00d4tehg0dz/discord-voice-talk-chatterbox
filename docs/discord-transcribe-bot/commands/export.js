import { SlashCommandBuilder } from '@discordjs/builders';
import { exportCampaignData, importCampaignData, listExports, deleteExport } from '../utility/exportImport.js';
import { Campaign } from '../models/Campaign.js';
import { AttachmentBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('export')
    .setDescription('Manage campaign exports and imports')
    .addSubcommand(subcommand =>
        subcommand
            .setName('export')
            .setDescription('Export campaign data')
            .addStringOption(option =>
                option
                    .setName('campaign')
                    .setDescription('The campaign to export')
                    .setRequired(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('import')
            .setDescription('Import campaign data')
            .addAttachmentOption(option =>
                option
                    .setName('file')
                    .setDescription('The export file to import')
                    .setRequired(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('list')
            .setDescription('List available exports')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('delete')
            .setDescription('Delete an export file')
            .addStringOption(option =>
                option
                    .setName('filename')
                    .setDescription('The export file to delete')
                    .setRequired(true)
            )
    );

export async function execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    try {
        switch (subcommand) {
            case 'export':
                await handleExport(interaction, guildId);
                break;
            case 'import':
                await handleImport(interaction, guildId);
                break;
            case 'list':
                await handleList(interaction);
                break;
            case 'delete':
                await handleDelete(interaction);
                break;
        }
    } catch (error) {
        console.error('Error in export command:', error);
        await interaction.reply({
            content: `Error: ${error.message}`,
            ephemeral: true
        });
    }
}

async function handleExport(interaction, guildId) {
    const campaignName = interaction.options.getString('campaign');
    
    // Find the campaign
    const campaign = await Campaign.findOne({ guildId, name: campaignName });
    if (!campaign) {
        await interaction.reply({
            content: `Campaign "${campaignName}" not found.`,
            ephemeral: true
        });
        return;
    }

    // Start export process
    await interaction.deferReply({ ephemeral: true });

    try {
        const result = await exportCampaignData(guildId, campaign._id);
        
        // Create attachment
        const file = new AttachmentBuilder(result.filePath, { name: result.filename });
        
        await interaction.editReply({
            content: `Successfully exported campaign "${campaignName}"`,
            files: [file]
        });
    } catch (error) {
        await interaction.editReply({
            content: `Error exporting campaign: ${error.message}`,
            ephemeral: true
        });
    }
}

async function handleImport(interaction, guildId) {
    const attachment = interaction.options.getAttachment('file');
    
    if (!attachment.name.endsWith('.json.gz')) {
        await interaction.reply({
            content: 'Invalid file format. Please upload a valid export file (.json.gz)',
            ephemeral: true
        });
        return;
    }

    // Start import process
    await interaction.deferReply({ ephemeral: true });

    try {
        // Download the file
        const response = await fetch(attachment.url);
        const buffer = await response.arrayBuffer();
        
        // Save to temporary file
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }
        
        const tempPath = path.join(tempDir, attachment.name);
        fs.writeFileSync(tempPath, Buffer.from(buffer));

        // Import the data
        const result = await importCampaignData(guildId, tempPath);

        // Clean up
        fs.unlinkSync(tempPath);

        await interaction.editReply({
            content: `Successfully imported campaign data:\n` +
                    `- ${result.summaryCount} summaries\n` +
                    `- ${result.sessionCount} sessions`
        });
    } catch (error) {
        await interaction.editReply({
            content: `Error importing campaign data: ${error.message}`,
            ephemeral: true
        });
    }
}

async function handleList(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const exports = await listExports();
        
        if (exports.length === 0) {
            await interaction.editReply({
                content: 'No export files found.',
                ephemeral: true
            });
            return;
        }

        const formattedExports = exports.map(exp => 
            `- ${exp.filename}\n` +
            `  Size: ${(exp.size / 1024).toFixed(2)} KB\n` +
            `  Created: ${exp.createdAt.toLocaleString()}\n` +
            `  Modified: ${exp.modifiedAt.toLocaleString()}`
        ).join('\n');

        await interaction.editReply({
            content: `Available exports:\n${formattedExports}`,
            ephemeral: true
        });
    } catch (error) {
        await interaction.editReply({
            content: `Error listing exports: ${error.message}`,
            ephemeral: true
        });
    }
}

async function handleDelete(interaction) {
    const filename = interaction.options.getString('filename');
    
    await interaction.deferReply({ ephemeral: true });

    try {
        await deleteExport(filename);
        await interaction.editReply({
            content: `Successfully deleted export file "${filename}"`,
            ephemeral: true
        });
    } catch (error) {
        await interaction.editReply({
            content: `Error deleting export: ${error.message}`,
            ephemeral: true
        });
    }
} 