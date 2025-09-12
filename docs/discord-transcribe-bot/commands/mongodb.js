import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { ServerConfig } from '../models/ServerConfig.js';

export const data = new SlashCommandBuilder()
    .setName('mongodb')
    .setDescription('Manage MongoDB database configuration for this server')
    .addSubcommand(subcommand =>
        subcommand
            .setName('set')
            .setDescription('Set your custom MongoDB connection string')
            .addStringOption(option =>
                option
                    .setName('uri')
                    .setDescription('Your MongoDB connection string (mongodb://user:pass@host:port/database)')
                    .setRequired(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('test')
            .setDescription('Test your current MongoDB connection')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('remove')
            .setDescription('Remove custom MongoDB config and use default')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('status')
            .setDescription('Check current MongoDB configuration')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    try {
        switch (subcommand) {
            case 'set':
                await handleSetMongoUri(interaction, guildId);
                break;
            case 'test':
                await handleTestMongoConnection(interaction, guildId);
                break;
            case 'remove':
                await handleRemoveMongoConfig(interaction, guildId);
                break;
            case 'status':
                await handleStatusMongoConfig(interaction, guildId);
                break;
        }
    } catch (error) {
        console.error('Error in mongodb command:', error);
        await interaction.reply({
            content: '❌ An error occurred while processing your request.',
            ephemeral: true
        });
    }
}

async function handleSetMongoUri(interaction, guildId) {
    const uri = interaction.options.getString('uri');
    
    // Validate MongoDB URI format
    if (!/^mongodb(\+srv)?:\/\/([^:]+):([^@]+)@([^\/]+)\/(.+)$/.test(uri)) {
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Invalid MongoDB URI Format')
            .setDescription('MongoDB connection strings should follow this format:\n\n`mongodb://username:password@host:port/database`\n\n**Examples:**\n• `mongodb://user:pass@localhost:27017/dnd-transcriptions`\n• `mongodb+srv://user:pass@cluster.mongodb.net/dnd-transcriptions`')
            .addFields({
                name: 'How to get a MongoDB URI:',
                value: '1. **Local MongoDB**: `mongodb://localhost:27017/your-database`\n2. **MongoDB Atlas**: Get connection string from your cluster\n3. **Self-hosted**: Use your server details'
            });
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
    }

    // Test the MongoDB connection
    await interaction.deferReply({ ephemeral: true });
    
    try {
        const mongoose = require('mongoose');
        
        // Create a temporary connection to test
        const testConnection = mongoose.createConnection(uri, {
            serverSelectionTimeoutMS: 10000, // 10 second timeout
            connectTimeoutMS: 10000
        });
        
        // Wait for connection
        await new Promise((resolve, reject) => {
            testConnection.on('connected', resolve);
            testConnection.on('error', reject);
            setTimeout(() => reject(new Error('Connection timeout')), 10000);
        });
        
        // Test basic operations
        const testCollection = testConnection.collection('connection_test');
        await testCollection.insertOne({ test: true, timestamp: new Date() });
        await testCollection.deleteOne({ test: true });
        
        // Close the test connection
        await testConnection.close();
        
        // Save the MongoDB URI
        await ServerConfig.findOneAndUpdate(
            { guildId },
            { 
                'mongodb.uri': uri,
                'mongodb.useCustom': true
            },
            { upsert: true, new: true }
        );

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ MongoDB Configuration Set Successfully')
            .setDescription('Your custom MongoDB connection has been saved and tested successfully!')
            .addFields({
                name: 'What\'s next?',
                value: '• Your data will now be stored in your custom MongoDB instance\n• Use `/mongodb test` to verify the connection anytime\n• Use `/mongodb status` to check your configuration'
            })
            .setFooter({ text: 'Your MongoDB credentials are encrypted and stored securely' });

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error testing MongoDB connection:', error);
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ MongoDB Connection Test Failed')
            .setDescription(`Unable to connect to your MongoDB instance.\n\n**Error:** ${error.message}\n\n**Common issues:**\n• Check your connection string format\n• Verify username/password are correct\n• Ensure the database server is accessible\n• Check firewall settings`);
        
        await interaction.editReply({ embeds: [embed] });
    }
}

async function handleTestMongoConnection(interaction, guildId) {
    await interaction.deferReply({ ephemeral: true });

    const config = await ServerConfig.findOne({ guildId });
    
    if (!config || !config.mongodb.useCustom || !config.mongodb.uri) {
        const embed = new EmbedBuilder()
            .setColor('#ffaa00')
            .setTitle('⚠️ Using Default MongoDB')
            .setDescription('This server is using the default MongoDB configuration. No custom connection to test.')
            .addFields({
                name: 'To set a custom MongoDB:',
                value: 'Use `/mongodb set <your-connection-string>` to configure your own database.'
            });
        
        await interaction.editReply({ embeds: [embed] });
        return;
    }

    const uri = config.getDecryptedMongoUri();
    
    if (!uri) {
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ MongoDB URI Decryption Failed')
            .setDescription('Unable to decrypt the stored MongoDB URI. Please set a new one with `/mongodb set`.');
        
        await interaction.editReply({ embeds: [embed] });
        return;
    }

    try {
        const mongoose = require('mongoose');
        
        // Create a temporary connection to test
        const testConnection = mongoose.createConnection(uri, {
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000
        });
        
        // Wait for connection
        await new Promise((resolve, reject) => {
            testConnection.on('connected', resolve);
            testConnection.on('error', reject);
            setTimeout(() => reject(new Error('Connection timeout')), 10000);
        });
        
        // Test basic operations
        const testCollection = testConnection.collection('connection_test');
        await testCollection.insertOne({ test: true, timestamp: new Date() });
        await testCollection.deleteOne({ test: true });
        
        // Close the test connection
        await testConnection.close();
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ MongoDB Connection Test Successful')
            .setDescription('Your MongoDB connection is working correctly!')
            .addFields(
                {
                    name: 'Connection Status',
                    value: '✅ Connected and Operational',
                    inline: true
                },
                {
                    name: 'Database Access',
                    value: '✅ Read/Write Permissions Confirmed',
                    inline: true
                }
            );

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error testing MongoDB connection:', error);
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ MongoDB Connection Test Failed')
            .setDescription(`Unable to connect to your MongoDB instance.\n\n**Error:** ${error.message}\n\nUse \`/mongodb set\` to update your connection string.`);
        
        await interaction.editReply({ embeds: [embed] });
    }
}

async function handleRemoveMongoConfig(interaction, guildId) {
    await interaction.deferReply({ ephemeral: true });

    const config = await ServerConfig.findOne({ guildId });
    
    if (!config || !config.mongodb.useCustom) {
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ No Custom MongoDB Configuration')
            .setDescription('This server is already using the default MongoDB configuration.');
        
        await interaction.editReply({ embeds: [embed] });
        return;
    }

    await ServerConfig.findOneAndUpdate(
        { guildId },
        { 
            'mongodb.uri': null,
            'mongodb.useCustom': false
        }
    );

    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Custom MongoDB Configuration Removed')
        .setDescription('Your server will now use the default MongoDB configuration.')
        .addFields({
            name: 'Note',
            value: 'Your existing data will remain in your custom database. Only new data will use the default configuration.'
        });

    await interaction.editReply({ embeds: [embed] });
}

async function handleStatusMongoConfig(interaction, guildId) {
    await interaction.deferReply({ ephemeral: true });

    const config = await ServerConfig.findOne({ guildId });
    
    if (!config || !config.mongodb.useCustom) {
        const embed = new EmbedBuilder()
            .setColor('#00aa00')
            .setTitle('📊 MongoDB Configuration Status')
            .setDescription('This server is using the **default MongoDB configuration**.')
            .addFields({
                name: 'Current Setup',
                value: '• Database: Default (shared)\n• Encryption: ✅ Enabled\n• Access: Server-specific collections'
            })
            .addFields({
                name: 'To use your own database:',
                value: 'Use `/mongodb set <your-connection-string>` to configure a custom MongoDB instance.'
            });
        
        await interaction.editReply({ embeds: [embed] });
        return;
    }

    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('📊 MongoDB Configuration Status')
        .setDescription('This server is using a **custom MongoDB configuration**.')
        .addFields(
            {
                name: 'Configuration Type',
                value: '✅ Custom Database',
                inline: true
            },
            {
                name: 'Encryption',
                value: '✅ Credentials Encrypted',
                inline: true
            },
            {
                name: 'Data Isolation',
                value: '✅ Server-Specific',
                inline: true
            }
        )
        .addFields({
            name: 'Commands',
            value: '• `/mongodb test` - Test your connection\n• `/mongodb remove` - Switch to default\n• `/mongodb set` - Update connection string'
        });

    await interaction.editReply({ embeds: [embed] });
}
