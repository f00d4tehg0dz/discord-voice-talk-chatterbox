import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { SessionState } from '../models/SessionState.js';
import { translateText, detectLanguage } from '../utility/whisper.js';
import { getGuildConfig } from '../utility/database.js';
import { generateSummary, splitSummaryForDiscord } from '../utility/summary.js';

// These imports are needed for voice connection functionality
import { client, setupVoiceConnection, activeRecordings, activeConnections } from '../index.js';

export const data = new SlashCommandBuilder()
    .setName('session')
    .setDescription('Manage D&D session recording')
    .addSubcommand(subcommand =>
        subcommand
            .setName('start')
            .setDescription('Start a new session')
            .addStringOption(option =>
                option.setName('campaign')
                    .setDescription('Campaign name')
                    .setRequired(true))
            .addUserOption(option =>
                option.setName('dm')
                    .setDescription('The Dungeon Master for this session')
                    .setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('pause')
            .setDescription('Pause the current session'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('resume')
            .setDescription('Resume the paused session'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('status')
            .setDescription('Get current session status'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('highlight')
            .setDescription('Add a highlight to the current session')
            .addStringOption(option =>
                option.setName('description')
                    .setDescription('Description of the highlight')
                    .setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('translate')
            .setDescription('Translate the session to another language')
            .addStringOption(option =>
                option.setName('language')
                    .setDescription('Target language code (e.g., es, fr, de)')
                    .setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('end')
            .setDescription('End the current session and generate a summary'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('debug')
            .setDescription('Show detailed debug information about current session state'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('force-end')
            .setDescription('Force end a stuck session (emergency use only)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    try {
        switch (subcommand) {
            case 'start':
                await handleStart(interaction);
                break;
            case 'pause':
                await handlePause(interaction);
                break;
            case 'resume':
                await handleResume(interaction);
                break;
            case 'status':
                await handleStatus(interaction);
                break;
            case 'highlight':
                await handleHighlight(interaction);
                break;
            case 'translate':
                await handleTranslate(interaction);
                break;
            case 'end':
                await handleEnd(interaction);
                break;
            case 'debug':
                await handleDebug(interaction);
                break;
            case 'force-end':
                await handleForceEnd(interaction);
                break;
        }
    } catch (error) {
        console.error('Session command error:', error);
        await interaction.reply({ content: 'An error occurred while processing your command.', ephemeral: true });
    }
}

async function handleStart(interaction) {
    try {
        // Check if user has admin permissions
        if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ 
                content: 'You need administrator permissions to start a session.', 
                ephemeral: true 
            });
        }
        
        // Get the guild configuration from the database
        const guildConfig = await getGuildConfig(interaction.guildId);
        
        if (!guildConfig) {
            return interaction.reply({ 
                content: 'This server has not been registered yet. Use `/register` first to set up the bot.', 
                ephemeral: true 
            });
        }
        
        // Get campaign name and language from options
        const campaign = interaction.options.getString('campaign');
        const dm = interaction.options.getUser('dm');
        
        // Defer reply while we set up everything
        await interaction.deferReply();
        
        // Check if a session is already active in MongoDB
        const existingSession = await SessionState.findOne({
            guildId: interaction.guildId,
            status: { $in: ['active', 'paused'] }
        });
        
        if (existingSession) {
            return interaction.editReply({
                content: `A session is already active for campaign "${existingSession.campaignName}". Use \`/session status\` to check current session or \`/session pause\` to pause it.`
            });
        }
        
        // Connect to the voice channel
        const success = await setupVoiceConnection(interaction.guildId, guildConfig.voiceChannelId);
        
        if (!success) {
            return interaction.editReply({ 
                content: 'Failed to connect to the voice channel. Please check permissions and try again.'
            });
        }
        
        // Create a new session state in the database
        const sessionState = new SessionState({
            guildId: interaction.guildId,
            campaignName: campaign,
            language: 'en',
            startTime: new Date(),
            status: 'active',
            dmUserId: dm.id
        });

        await sessionState.save();
        
        // Initialize the recording state in activeRecordings
        activeRecordings.set(interaction.guildId, {
            transcriptions: {},
            sessionStart: new Date(),
            isRecording: true,
            campaignName: campaign,
            dmUserId: dm.id
        });
        
        // Find the voice channel to reference in the reply
        const guild = client.guilds.cache.get(interaction.guildId);
        const voiceChannel = guild.channels.cache.get(guildConfig.voiceChannelId);
        
        // Reply with success message
        await interaction.editReply({
            content: `Started new D&D session for campaign "${campaign}" in <#${voiceChannel.id}>. Voice transcription is now active with ${'en'} language detection.\n\nUse \`/session highlight\` to mark important moments and \`/session status\` to check the session status.`
        });

        // Send a public message to the channel
        await interaction.channel.send({
            content: `📝 **Session Started: ${campaign}**\nI'm now recording in ${voiceChannel.name}. Use \`/session end\` when you're finished.`
        });
    } catch (error) {
        console.error('Error starting session:', error);
        
        if (interaction.deferred) {
            await interaction.editReply({ 
                content: 'An error occurred while starting the session. Please try again later.'
            });
        } else {
            await interaction.reply({ 
                content: 'An error occurred while starting the session. Please try again later.', 
                ephemeral: true 
            });
        }
    }
}

async function handlePause(interaction) {
    // Check if user has admin permissions
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ 
            content: 'You need administrator permissions to pause a session.', 
            ephemeral: true 
        });
    }

    const sessionState = await SessionState.findOne({
        guildId: interaction.guildId,
        status: 'active'
    });

    if (!sessionState) {
        await interaction.reply({ content: 'No active session found.', ephemeral: true });
        return;
    }

    await sessionState.pauseSession();

    // Pause the recording if it exists
    const recordingState = activeRecordings.get(interaction.guildId);
    if (recordingState) {
        recordingState.isPaused = true;
    }
    
    await interaction.reply({
        content: `Session "${sessionState.campaignName}" paused. Use \`/session resume\` to continue.`,
        ephemeral: false
    });
}

async function handleResume(interaction) {
    // Check if user has admin permissions
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ 
            content: 'You need administrator permissions to resume a session.', 
            ephemeral: true 
        });
    }

    const sessionState = await SessionState.findOne({
        guildId: interaction.guildId,
        status: 'paused'
    });

    if (!sessionState) {
        await interaction.reply({ content: 'No paused session found.', ephemeral: true });
        return;
    }

    await sessionState.resumeSession();

    // Resume the recording if it exists
    const recordingState = activeRecordings.get(interaction.guildId);
    if (recordingState) {
        recordingState.isPaused = false;
    }
    
    await interaction.reply({
        content: `Session "${sessionState.campaignName}" resumed. Recording continues.`,
        ephemeral: false
    });
}

async function handleStatus(interaction) {
    const sessionState = await SessionState.findOne({
        guildId: interaction.guildId,
        status: { $in: ['active', 'paused'] }
    });

    if (!sessionState) {
        await interaction.reply({ content: 'No active session found.', ephemeral: true });
        return;
    }

    const duration = sessionState.getSessionDuration();
    const statusMessage = `**Campaign:** ${sessionState.campaignName}\n` +
        `**Status:** ${sessionState.status}\n` +
        `**Duration:** ${formatDuration(duration)}\n` +
        `**Language:** ${sessionState.language}\n` +
        `**Highlights:** ${sessionState.highlights.length}\n` +
        `**Characters:** ${sessionState.characters.length}`;

    await interaction.reply({
        content: statusMessage,
        ephemeral: true
    });
}

async function handleHighlight(interaction) {
    const description = interaction.options.getString('description');
    const sessionState = await SessionState.findOne({
        guildId: interaction.guildId,
        status: { $in: ['active', 'paused'] }
    });

    if (!sessionState) {
        await interaction.reply({ content: 'No active session found.', ephemeral: true });
        return;
    }

    await sessionState.addHighlight({
        timestamp: new Date(),
        description: description,
        addedBy: interaction.user.id
    });

    await interaction.reply({
        content: 'Highlight added to the session.',
        ephemeral: true
    });
}

async function handleTranslate(interaction) {
    const targetLanguage = interaction.options.getString('language');
    const sessionState = await SessionState.findOne({
        guildId: interaction.guildId,
        status: { $in: ['active', 'paused'] }
    });

    if (!sessionState) {
        await interaction.reply({ content: 'No active session found.', ephemeral: true });
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        const translatedText = await translateText(sessionState.transcription, targetLanguage);
        await interaction.editReply({
            content: `Translation to ${targetLanguage}:\n\n${translatedText}`,
            ephemeral: true
        });
    } catch (error) {
        await interaction.editReply({
            content: 'Failed to translate the session. Please try again later.',
            ephemeral: true
        });
    }
}

async function handleEnd(interaction) {
    // Check if user has admin permissions
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ 
            content: 'You need administrator permissions to end the session.', 
            ephemeral: true 
        });
    }
    
    try {
        console.log(`[SESSION END] Starting session end process for guild ${interaction.guildId}`);
        
        // Check if there's an active session in memory or database
        const hasActiveConnection = activeConnections.has(interaction.guildId);
        const hasActiveRecording = activeRecordings.has(interaction.guildId);
        
        console.log(`[SESSION END] Active connection: ${hasActiveConnection}, Active recording: ${hasActiveRecording}`);
        
        // Check for active sessions in MongoDB
        const activeSession = await SessionState.findOne({
            guildId: interaction.guildId,
            status: { $in: ['active', 'paused'] }
        });
        
        console.log(`[SESSION END] Database session found: ${activeSession ? activeSession.campaignName : 'none'}`);
        
        if (!hasActiveConnection && !activeSession && !hasActiveRecording) {
            return interaction.reply({ 
                content: 'No active session found. Use `/session start` to start a new session.', 
                ephemeral: true 
            });
        }

        // Defer the reply immediately to prevent timeout
        await interaction.deferReply({ ephemeral: false });

        // Get the text channel for posting summaries
        const guildConfig = await getGuildConfig(interaction.guildId);
        let textChannel = null;
        
        if (guildConfig?.textChannelId) {
            textChannel = client.channels.cache.get(guildConfig.textChannelId);
        }
        
        if (!textChannel) {
            textChannel = interaction.channel;
        }

        console.log(`[SESSION END] Using text channel: ${textChannel.name} (${textChannel.id})`);

        // Generate final summary before closing
        const recordingState = activeRecordings.get(interaction.guildId);
        let summaryText = 'Session has been ended. Voice recording and transcription have stopped.';
        
        if (recordingState) {
            console.log(`[SESSION END] Generating final summary...`);
            try {
                const summary = await generateSummary(activeRecordings, client.users, interaction.guildId);
                
                if (summary.text && summary.text.trim()) {
                    console.log(`[SESSION END] Summary generated successfully, length: ${summary.text.length}`);
                    
                    // Split the summary into Discord-friendly chunks
                    const chunks = splitSummaryForDiscord(
                        summary.text,
                        summary.metadata?.campaignName || 'Unknown Campaign',
                        summary.metadata?.sessionDuration || 'Unknown Duration'
                    );
                    
                    console.log(`[SESSION END] Sending ${chunks.length} summary chunks to Discord`);
                    
                    // Send each chunk as a separate message to the text channel
                    for (const chunk of chunks) {
                        try {
                            await textChannel.send(chunk);
                            console.log(`[SESSION END] Sent summary chunk successfully`);
                        } catch (chunkError) {
                            console.error(`[SESSION END] Failed to send summary chunk:`, chunkError);
                        }
                    }
                    
                    // Send cliff notes if available
                    if (summary.cliffNotes && summary.cliffNotes.trim()) {
                        try {
                            await textChannel.send('**Cliff Notes:**\n' + summary.cliffNotes);
                            console.log(`[SESSION END] Sent cliff notes successfully`);
                        } catch (cliffError) {
                            console.error(`[SESSION END] Failed to send cliff notes:`, cliffError);
                        }
                    }
                } else {
                    console.log(`[SESSION END] No summary text generated or empty summary`);
                    await textChannel.send('Session ended. No transcript was captured during this session.');
                }
            } catch (summaryError) {
                console.error('[SESSION END] Error generating final summary:', summaryError);
                await textChannel.send('An error occurred while generating the final summary. The session has been ended, but the summary may be incomplete.');
            }
        } else {
            console.log(`[SESSION END] No recording state found`);
        }
        
        // Close voice connection if active
        const connection = activeConnections.get(interaction.guildId);
        if (connection) {
            console.log(`[SESSION END] Destroying voice connection`);
            try {
                connection.destroy();
                activeConnections.delete(interaction.guildId);
                console.log(`[SESSION END] Voice connection destroyed successfully`);
            } catch (connError) {
                console.error(`[SESSION END] Error destroying voice connection:`, connError);
            }
        }
        
        // Clear recording state
        if (activeRecordings.has(interaction.guildId)) {
            console.log(`[SESSION END] Clearing recording state`);
            const recordingState = activeRecordings.get(interaction.guildId);
            if (recordingState.summaryTimer) {
                clearInterval(recordingState.summaryTimer);
                console.log(`[SESSION END] Cleared summary timer`);
            }
            activeRecordings.delete(interaction.guildId);
            console.log(`[SESSION END] Recording state cleared`);
        }
        
        // End the session in MongoDB if it exists
        if (activeSession) {
            console.log(`[SESSION END] Ending database session`);
            try {
                await activeSession.endSession();
                summaryText += `\nSession "${activeSession.campaignName}" has been marked as ended in the database.`;
                console.log(`[SESSION END] Database session ended successfully`);
            } catch (dbError) {
                console.error(`[SESSION END] Error ending database session:`, dbError);
                summaryText += `\nWarning: There was an error updating the session status in the database.`;
            }
        }
        
        console.log(`[SESSION END] Process completed successfully`);
        
        // Edit the deferred reply
        await interaction.editReply(summaryText);
    } catch (error) {
        console.error('[SESSION END] Error during session end:', error);
        try {
            if (interaction.deferred) {
                await interaction.editReply({ 
                    content: 'An error occurred during session end. Please check the text channel for the summary and console logs for details.', 
                    ephemeral: true 
                });
            } else {
                await interaction.reply({ 
                    content: 'An error occurred during session end. Please check the text channel for the summary and console logs for details.', 
                    ephemeral: true 
                });
            }
        } catch (replyError) {
            console.error('[SESSION END] Error sending reply:', replyError);
        }
    }
}

async function handleDebug(interaction) {
    // Check if user has admin permissions
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ 
            content: 'You need administrator permissions to view debug information.', 
            ephemeral: true 
        });
    }
    
    try {
        await interaction.deferReply({ ephemeral: true });
        
        const guildId = interaction.guildId;
        
        // Check all session states
        const hasActiveConnection = activeConnections.has(guildId);
        const hasActiveRecording = activeRecordings.has(guildId);
        const recordingState = activeRecordings.get(guildId);
        
        // Check database session
        const activeSession = await SessionState.findOne({
            guildId: guildId,
            status: { $in: ['active', 'paused'] }
        });
        
        // Get guild config
        const guildConfig = await getGuildConfig(guildId);
        
        let debugInfo = `**Debug Information for Guild ${guildId}**\n\n`;
        
        debugInfo += `**Voice Connection:**\n`;
        debugInfo += `- Has Active Connection: ${hasActiveConnection}\n`;
        if (hasActiveConnection) {
            const connection = activeConnections.get(guildId);
            debugInfo += `- Connection Status: ${connection.state.status}\n`;
        }
        
        debugInfo += `\n**Recording State:**\n`;
        debugInfo += `- Has Active Recording: ${hasActiveRecording}\n`;
        if (hasActiveRecording && recordingState) {
            debugInfo += `- Is Recording: ${recordingState.isRecording || 'undefined'}\n`;
            debugInfo += `- Is Paused: ${recordingState.isPaused || 'false'}\n`;
            debugInfo += `- Session Start: ${recordingState.sessionStart || 'undefined'}\n`;
            debugInfo += `- Campaign Name: ${recordingState.campaignName || 'undefined'}\n`;
            debugInfo += `- DM User ID: ${recordingState.dmUserId || 'undefined'}\n`;
            debugInfo += `- Summary Timer Active: ${recordingState.summaryTimer ? 'Yes' : 'No'}\n`;
            
            const transcriptionCount = Object.keys(recordingState.transcriptions || {}).length;
            let totalTranscriptions = 0;
            if (recordingState.transcriptions) {
                for (const userTranscriptions of Object.values(recordingState.transcriptions)) {
                    if (Array.isArray(userTranscriptions)) {
                        totalTranscriptions += userTranscriptions.length;
                    }
                }
            }
            debugInfo += `- Users with Transcriptions: ${transcriptionCount}\n`;
            debugInfo += `- Total Transcription Entries: ${totalTranscriptions}\n`;
        }
        
        debugInfo += `\n**Database Session:**\n`;
        if (activeSession) {
            debugInfo += `- Campaign: ${activeSession.campaignName}\n`;
            debugInfo += `- Status: ${activeSession.status}\n`;
            debugInfo += `- Start Time: ${activeSession.startTime}\n`;
            debugInfo += `- DM User ID: ${activeSession.dmUserId}\n`;
            debugInfo += `- Language: ${activeSession.language}\n`;
            debugInfo += `- Highlights: ${activeSession.highlights.length}\n`;
            debugInfo += `- Duration: ${formatDuration(activeSession.getSessionDuration())}\n`;
        } else {
            debugInfo += `- No active database session found\n`;
        }
        
        debugInfo += `\n**Guild Configuration:**\n`;
        if (guildConfig) {
            debugInfo += `- Voice Channel ID: ${guildConfig.voiceChannelId}\n`;
            debugInfo += `- Text Channel ID: ${guildConfig.textChannelId || 'Not set'}\n`;
            debugInfo += `- Summary Interval: ${guildConfig.summaryInterval ? guildConfig.summaryInterval / 60000 + ' minutes' : 'Default'}\n`;
            debugInfo += `- Is Active: ${guildConfig.isActive}\n`;
        } else {
            debugInfo += `- No guild configuration found\n`;
        }
        
        // Check if there are any orphaned sessions
        const allSessions = await SessionState.find({ guildId: guildId }).sort({ startTime: -1 }).limit(5);
        debugInfo += `\n**Recent Sessions (last 5):**\n`;
        if (allSessions.length > 0) {
            for (const session of allSessions) {
                debugInfo += `- ${session.campaignName} (${session.status}) - ${session.startTime.toISOString()}\n`;
            }
        } else {
            debugInfo += `- No sessions found in database\n`;
        }
        
        await interaction.editReply({ content: debugInfo });
        
    } catch (error) {
        console.error('Error in debug command:', error);
        await interaction.editReply({ 
            content: 'An error occurred while gathering debug information: ' + error.message 
        });
    }
}

async function handleForceEnd(interaction) {
    // Check if user has admin permissions
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ 
            content: 'You need administrator permissions to force end a session.', 
            ephemeral: true 
        });
    }
    
    try {
        await interaction.deferReply({ ephemeral: false });
        
        const guildId = interaction.guildId;
        let cleanupActions = [];
        
        console.log(`[FORCE END] Starting force cleanup for guild ${guildId}`);
        
        // Force close voice connection
        const connection = activeConnections.get(guildId);
        if (connection) {
            try {
                connection.destroy();
                activeConnections.delete(guildId);
                cleanupActions.push('✅ Destroyed voice connection');
                console.log(`[FORCE END] Destroyed voice connection`);
            } catch (error) {
                cleanupActions.push('❌ Error destroying voice connection: ' + error.message);
                console.error(`[FORCE END] Error destroying voice connection:`, error);
            }
        } else {
            cleanupActions.push('ℹ️ No active voice connection found');
        }
        
        // Force clear recording state
        if (activeRecordings.has(guildId)) {
            const recordingState = activeRecordings.get(guildId);
            if (recordingState.summaryTimer) {
                clearInterval(recordingState.summaryTimer);
                cleanupActions.push('✅ Cleared summary timer');
            }
            activeRecordings.delete(guildId);
            cleanupActions.push('✅ Cleared recording state');
            console.log(`[FORCE END] Cleared recording state`);
        } else {
            cleanupActions.push('ℹ️ No active recording state found');
        }
        
        // Force end all active/paused sessions in database
        const activeSessions = await SessionState.find({
            guildId: guildId,
            status: { $in: ['active', 'paused'] }
        });
        
        if (activeSessions.length > 0) {
            for (const session of activeSessions) {
                try {
                    await session.endSession();
                    cleanupActions.push(`✅ Ended database session: ${session.campaignName}`);
                    console.log(`[FORCE END] Ended database session: ${session.campaignName}`);
                } catch (error) {
                    cleanupActions.push(`❌ Error ending session ${session.campaignName}: ${error.message}`);
                    console.error(`[FORCE END] Error ending session ${session.campaignName}:`, error);
                }
            }
        } else {
            cleanupActions.push('ℹ️ No active database sessions found');
        }
        
        // Clear any audio buffers for this guild
        const audioBuffersCleared = [];
        const { audioBuffers } = await import('../index.js');
        if (audioBuffers) {
            for (const [key, buffer] of audioBuffers.entries()) {
                if (key.startsWith(`${guildId}_`)) {
                    audioBuffers.delete(key);
                    audioBuffersCleared.push(key);
                }
            }
            if (audioBuffersCleared.length > 0) {
                cleanupActions.push(`✅ Cleared ${audioBuffersCleared.length} audio buffers`);
            }
        }
        
        console.log(`[FORCE END] Completed force cleanup`);
        
        const summaryText = `**Force End Completed**\n\nCleanup actions performed:\n${cleanupActions.join('\n')}\n\n⚠️ **Note:** This was a force cleanup. If the session was recording, some data may have been lost. Please check your logs for any errors.`;
        
        await interaction.editReply(summaryText);
        
    } catch (error) {
        console.error('[FORCE END] Error during force end:', error);
        try {
            if (interaction.deferred) {
                await interaction.editReply({ 
                    content: 'An error occurred during force end: ' + error.message,
                    ephemeral: true 
                });
            } else {
                await interaction.reply({ 
                    content: 'An error occurred during force end: ' + error.message,
                    ephemeral: true 
                });
            }
        } catch (replyError) {
            console.error('[FORCE END] Error sending reply:', replyError);
        }
    }
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
} 