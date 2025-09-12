import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { ServerConfig } from '../models/ServerConfig.js';

export const data = new SlashCommandBuilder()
    .setName('apikey')
    .setDescription('Manage OpenAI API key for this server')
    .addSubcommand(subcommand =>
        subcommand
            .setName('set')
            .setDescription('Set your OpenAI API key for this server')
            .addStringOption(option =>
                option
                    .setName('key')
                    .setDescription('Your OpenAI API key (starts with sk-)')
                    .setRequired(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('test')
            .setDescription('Test your current API key')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('remove')
            .setDescription('Remove your API key from this server')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('status')
            .setDescription('Check if an API key is configured')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    try {
        switch (subcommand) {
            case 'set':
                await handleSetApiKey(interaction, guildId);
                break;
            case 'test':
                await handleTestApiKey(interaction, guildId);
                break;
            case 'remove':
                await handleRemoveApiKey(interaction, guildId);
                break;
            case 'status':
                await handleStatusApiKey(interaction, guildId);
                break;
        }
    } catch (error) {
        console.error('Error in apikey command:', error);
        await interaction.reply({
            content: '❌ An error occurred while processing your request.',
            ephemeral: true
        });
    }
}

async function handleSetApiKey(interaction, guildId) {
    const apiKey = interaction.options.getString('key');
    
    // Validate API key format
    if (!/^sk-[a-zA-Z0-9]{48}$/.test(apiKey)) {
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Invalid API Key Format')
            .setDescription('OpenAI API keys should start with "sk-" and be 51 characters long.\n\nExample: `sk-1234567890abcdef...`')
            .addFields({
                name: 'How to get an API key:',
                value: '1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)\n2. Sign in or create an account\n3. Click "Create new secret key"\n4. Copy the key (it starts with "sk-")'
            });
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
    }

    // Test the API key
    await interaction.deferReply({ ephemeral: true });
    
    try {
        const response = await fetch('https://api.openai.com/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ API Key Test Failed')
                .setDescription(`The API key is invalid or has insufficient permissions.\n\nError: HTTP ${response.status}`);
            
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        const data = await response.json();
        const hasWhisper = data.data.some(model => model.id.includes('whisper'));
        
        if (!hasWhisper) {
            const embed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('⚠️ Warning: Whisper Access Not Detected')
                .setDescription('Your API key is valid, but Whisper model access was not detected. You may need to request access to Whisper models.')
                .addFields({
                    name: 'What to do:',
                    value: '1. Check your OpenAI account billing\n2. Request access to Whisper models\n3. Ensure you have sufficient credits'
                });
            
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        // Save the API key
        await ServerConfig.findOneAndUpdate(
            { guildId },
            { 
                guildId,
                openaiApiKey: apiKey,
                isActive: true
            },
            { upsert: true, new: true }
        );

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ API Key Set Successfully')
            .setDescription('Your OpenAI API key has been saved and tested successfully!')
            .addFields({
                name: 'What\'s next?',
                value: '• Use `/register` to set up voice channel monitoring\n• Use `/interval` to set summary frequency\n• The bot will now use your API key for transcriptions'
            })
            .setFooter({ text: 'Your API key is encrypted and stored securely' });

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error testing API key:', error);
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ API Key Test Failed')
            .setDescription('Unable to test the API key. Please check your internet connection and try again.');
        
        await interaction.editReply({ embeds: [embed] });
    }
}

async function handleTestApiKey(interaction, guildId) {
    await interaction.deferReply({ ephemeral: true });

    const config = await ServerConfig.findOne({ guildId });
    
    if (!config || !config.openaiApiKey) {
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ No API Key Found')
            .setDescription('No API key is configured for this server. Use `/apikey set` to add one.');
        
        await interaction.editReply({ embeds: [embed] });
        return;
    }

    const apiKey = config.getDecryptedApiKey();
    
    if (!apiKey) {
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ API Key Decryption Failed')
            .setDescription('Unable to decrypt the stored API key. Please set a new one with `/apikey set`.');
        
        await interaction.editReply({ embeds: [embed] });
        return;
    }

    try {
        const response = await fetch('https://api.openai.com/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ API Key Test Failed')
                .setDescription(`The stored API key is invalid or has insufficient permissions.\n\nError: HTTP ${response.status}\n\nUse \`/apikey set\` to update your API key.`);
            
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        const data = await response.json();
        const hasWhisper = data.data.some(model => model.id.includes('whisper'));
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ API Key Test Successful')
            .setDescription('Your API key is working correctly!')
            .addFields(
                {
                    name: 'Whisper Access',
                    value: hasWhisper ? '✅ Available' : '❌ Not Available',
                    inline: true
                },
                {
                    name: 'Key Status',
                    value: '✅ Valid and Active',
                    inline: true
                }
            );

        if (!hasWhisper) {
            embed.addFields({
                name: '⚠️ Warning',
                value: 'Whisper model access not detected. You may need to request access or check your billing.'
            });
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error testing API key:', error);
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ API Key Test Failed')
            .setDescription('Unable to test the API key. Please check your internet connection and try again.');
        
        await interaction.editReply({ embeds: [embed] });
    }
}

async function handleRemoveApiKey(interaction, guildId) {
    await interaction.deferReply({ ephemeral: true });

    const config = await ServerConfig.findOne({ guildId });
    
    if (!config || !config.openaiApiKey) {
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ No API Key Found')
            .setDescription('No API key is configured for this server.');
        
        await interaction.editReply({ embeds: [embed] });
        return;
    }

    await ServerConfig.findOneAndUpdate(
        { guildId },
        { 
            openaiApiKey: null,
            isActive: false
        }
    );

    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ API Key Removed')
        .setDescription('Your OpenAI API key has been removed from this server.')
        .addFields({
            name: 'Note',
            value: 'The bot will no longer be able to transcribe audio or generate summaries until a new API key is set.'
        });

    await interaction.editReply({ embeds: [embed] });
}

async function handleStatusApiKey(interaction, guildId) {
    await interaction.deferReply({ ephemeral: true });

    const config = await ServerConfig.findOne({ guildId });
    
    if (!config || !config.openaiApiKey) {
        const embed = new EmbedBuilder()
            .setColor('#ffaa00')
            .setTitle('⚠️ No API Key Configured')
            .setDescription('This server does not have an OpenAI API key configured.')
            .addFields({
                name: 'To get started:',
                value: '1. Get an API key from [OpenAI Platform](https://platform.openai.com/api-keys)\n2. Use `/apikey set` to configure it\n3. Use `/register` to set up voice monitoring'
            });
        
        await interaction.editReply({ embeds: [embed] });
        return;
    }

    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ API Key Configured')
        .setDescription('This server has an OpenAI API key configured.')
        .addFields(
            {
                name: 'Status',
                value: config.isActive ? '✅ Active' : '❌ Inactive',
                inline: true
            },
            {
                name: 'Voice Channel',
                value: config.voiceChannelId ? `<#${config.voiceChannelId}>` : 'Not set',
                inline: true
            },
            {
                name: 'Summary Interval',
                value: `${config.summaryInterval} minutes`,
                inline: true
            }
        )
        .addFields({
            name: 'Commands',
            value: '• `/apikey test` - Test your API key\n• `/apikey remove` - Remove your API key\n• `/register` - Set up voice monitoring'
        });

    await interaction.editReply({ embeds: [embed] });
}
