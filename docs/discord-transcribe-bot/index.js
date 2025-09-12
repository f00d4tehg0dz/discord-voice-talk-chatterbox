import DiscordJS from 'discord.js';
const { Client, Collection, Events, GatewayIntentBits, ChannelType, PermissionFlagsBits } = DiscordJS;
import { joinVoiceChannel, VoiceConnectionStatus, EndBehaviorType } from '@discordjs/voice';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

import * as prism from 'prism-media';
import 'dotenv/config';
import { createWhisperTranscription } from './utility/whisper.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';
import { convertToWav } from './utility/convertAudio.js';
import { registerGuild, getGuildConfig, updateSummaryInterval, getAllActiveGuilds, deactivateGuild, connectDB } from './utility/database.js';
import { ServerConfig } from './models/ServerConfig.js';
import { getServerModels, closeAllConnections } from './utility/serverDatabase.js';
import { generateSummary, generateCliffNotes, splitSummaryForDiscord } from './utility/summary.js';
import { Summary } from './models/Summary.js';
import { Campaign } from './models/Campaign.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load slash commands from the commands directory
async function loadCommands() {
	const commandsPath = path.join(__dirname, 'commands');
	const commandFiles = [];
	
	// Read command files from the main commands directory
	try {
		const mainFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
		mainFiles.forEach(file => {
			commandFiles.push({ path: path.join(commandsPath, file), relativePath: `./${file}` });
		});
	} catch (error) {
		console.error('Error reading main commands directory:', error);
	}
	
	// Read command files from subdirectories
	try {
		const dirs = fs.readdirSync(commandsPath, { withFileTypes: true })
			.filter(dirent => dirent.isDirectory())
			.map(dirent => dirent.name);
			
		for (const dir of dirs) {
			const subDirPath = path.join(commandsPath, dir);
			const subFiles = fs.readdirSync(subDirPath).filter(file => file.endsWith('.js'));
			
			subFiles.forEach(file => {
				commandFiles.push({ path: path.join(subDirPath, file), relativePath: `./${dir}/${file}` });
			});
		}
	} catch (error) {
		console.error('Error reading command subdirectories:', error);
	}
	
	const commands = [];
	
	// Import each command module
	for (const file of commandFiles) {
		try {
			// Import the command module using dynamic import
			const fullImportPath = `./commands/${file.relativePath.replace(/^\.\//,'').replace(/\\/g, '/')}`;
			console.log(`Loading command from ${fullImportPath}`);
			const commandModule = await import(fullImportPath);
			
			if (commandModule.data && commandModule.execute) {
				commands.push({
					data: commandModule.data,
					execute: commandModule.execute
				});
				client.commands.set(commandModule.data.name, commandModule);
				console.log(`Successfully loaded command: ${commandModule.data.name}`);
			} else {
				console.log(`[WARNING] Command at ${file.path} is missing required "data" or "execute" property`);
			}
		} catch (error) {
			console.error(`[ERROR] Failed to load command from ${file.path}:`, error);
		}
	}
	
	return commands;
}

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildVoiceStates,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
});

client.commands = new Collection();

const token = process.env.TOKEN;
// We'll get these from the database now
// const guildId = process.env.GUILD_ID;
// const voiceChannelId = process.env.VOICE_CHANNEL_ID;

if (!token) {
	console.error('Missing TOKEN environment variable. Please check your .env file.');
	process.exit(1);
}

// Add MongoDB URI to the .env file
if (!process.env.MONGODB_URI) {
	console.warn('MONGODB_URI not set in .env file. Using default local MongoDB connection.');
}

// Track active connections and recordings
const activeConnections = new Map();
const activeRecordings = new Map();
const users = {};
const transcriptions = {};

// Audio buffer management - store audio chunks by user
const audioBuffers = new Map();
const MAX_BUFFER_SIZE = 50 * 1024 * 1024; // 50MB per user
const MAX_BUFFER_DURATION = 5 * 60 * 1000; // 5 minutes

client.once(Events.ClientReady, async (c) => {
	console.log(`Ready! Logged in as ${c.user.tag}`);

	// Load commands from the filesystem
	const commands = await loadCommands();
	console.log(`Loaded ${commands.length} command(s) from the filesystem`);

	// Register global slash commands
	try {
		console.log('Registering global slash commands...');
		const globalCommands = [
			new SlashCommandBuilder()
				.setName('register')
				.setDescription('Register a voice channel for the bot to listen to')
				.addChannelOption(option =>
					option.setName('voicechannel')
						.setDescription('The voice channel to listen to')
						.setRequired(true)
						.addChannelTypes(ChannelType.GuildVoice))
				.addChannelOption(option =>
					option.setName('textchannel')
						.setDescription('The text channel to post summaries to')
						.setRequired(false)
						.addChannelTypes(ChannelType.GuildText)),
			
			new SlashCommandBuilder()
				.setName('help')
				.setDescription('Get help with using the bot'),
				
			new SlashCommandBuilder()
				.setName('unregister')
				.setDescription('Completely remove the bot from your server'),
			
			// The session command is now loaded from commands/session.js
			// and will be added to globalCommands in the forEach loop below
		];
		
		// Add commands from the filesystem to global commands
		commands.forEach(command => {
			if (command.data) {
				globalCommands.push(command.data);
			}
		});
		
		const rest = new REST({ version: '10' }).setToken(token);
		await rest.put(
			Routes.applicationCommands(c.user.id),
			{ body: globalCommands.map(command => typeof command.toJSON === 'function' ? command.toJSON() : command) },
		);
		console.log('Global commands registered successfully');
		
		// Register guild-specific commands for all active guilds
		const activeGuilds = await getAllActiveGuilds();
		for (const guildConfig of activeGuilds) {
			await registerGuildCommands(c.user.id, guildConfig.guildId);
			//await setupVoiceConnection(guildConfig.guildId, guildConfig.voiceChannelId);
		}
	} catch (error) {
		console.error('Error registering commands:', error);
	}
});

// Register guild-specific commands
async function registerGuildCommands(clientId, guildId) {
	try {
		const guildCommands = [
			new SlashCommandBuilder()
				.setName('summary')
				.setDescription('Get a summary of the current DnD session'),
			
			new SlashCommandBuilder()
				.setName('interval')
				.setDescription('Set the interval for automatic summaries')
				.addIntegerOption(option => 
					option.setName('minutes')
						.setDescription('Summary interval in minutes')
						.setRequired(true)),
		];
		
		const rest = new REST({ version: '10' }).setToken(token);
		await rest.put(
			Routes.applicationGuildCommands(clientId, guildId),
			{ body: guildCommands.map(command => command.toJSON()) },
		);
		console.log(`Guild commands registered for ${guildId}`);
	} catch (error) {
		console.error(`Error registering guild commands for ${guildId}:`, error);
	}
}

// Set up voice connection for a guild
async function setupVoiceConnection(guildId, voiceChannelId) {
	try {
		const guild = client.guilds.cache.get(guildId);
		if (!guild) {
			console.error(`Guild ${guildId} not found.`);
			return false;
		}

		const voiceChannel = guild.channels.cache.get(voiceChannelId);
		if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
			console.error(`Voice channel ${voiceChannelId} not found in guild ${guildId}.`);
			return false;
		}

		// Check if we already have an active connection
		if (activeConnections.has(guildId)) {
			const existingConnection = activeConnections.get(guildId);
			if (existingConnection.status === VoiceConnectionStatus.Ready) {
				console.log(`Already connected to voice in guild ${guildId}`);
				return true;
			}
			// Otherwise, disconnect and reconnect
			existingConnection.destroy();
			activeConnections.delete(guildId);
		}

		const connection = joinVoiceChannel({
			channelId: voiceChannel.id,
			guildId: voiceChannel.guild.id,
			adapterCreator: voiceChannel.guild.voiceAdapterCreator,
			selfDeaf: false,
			selfMute: true,
		});

		activeConnections.set(guildId, connection);

		connection.on(VoiceConnectionStatus.Ready, () => {
			console.log(`Ready to listen to audio in guild ${guildId}, channel ${voiceChannelId}!`);
			
			// Initialize recording state for this guild
			if (!activeRecordings.has(guildId)) {
				activeRecordings.set(guildId, {
					isRecording: true,
					sessionStart: new Date(),
					summaryInterval: 30 * 60 * 1000, // Default 30 minutes
					summaryTimer: null,
					transcriptions: {}
				});
				
				// Start the summary timer
				startSummaryTimer(guildId);
			}

			// Set up speaking detection with buffering
			connection.receiver.speaking.on('start', async (userId) => {
				// Get user information if not already cached
				if (!users[userId]) {
					const userInfo = await client.users.fetch(userId);
					users[userId] = userInfo.username ?? 'Unknown User';
				}
				const userName = users[userId];
				console.log(`${userName} started speaking in guild ${guildId}`);

				// Create unique key for this user's audio in this guild
				const bufferKey = `${guildId}_${userId}`;
				
				// Initialize buffer for this user if needed
				if (!audioBuffers.has(bufferKey)) {
					audioBuffers.set(bufferKey, {
						chunks: [],
						lastActivity: Date.now(),
						isProcessing: false
					});
				}

				// Create opus decoder for the audio stream
				const opusDecoder = new prism.opus.Decoder({
					frameSize: 960,
					channels: 1,
					rate: 48000,
				});

				// Subscribe to the user's audio stream with increased silence duration
				const subscription = connection.receiver.subscribe(userId, {
					end: {
						behavior: EndBehaviorType.AfterSilence,
						duration: 1000, // Increased to 1 second of silence
					},
				});

				// Set up a pipeline to collect decoded audio data in memory buffer
				const userBuffer = audioBuffers.get(bufferKey);
				
				// Process opus data
				opusDecoder.on('data', (chunk) => {
					userBuffer.chunks.push(Buffer.from(chunk));
					userBuffer.lastActivity = Date.now();
				});
				
				// Pipe the audio to the decoder
				subscription.pipe(opusDecoder);
				
				// Set a cleanup function when subscription ends
				subscription.once('end', () => {
					console.log(`Speech segment ended for ${userName} in guild ${guildId}`);
					
					// Schedule processing after a delay to allow for multiple segments
					setTimeout(() => processAudioBuffer(bufferKey, userName, guildId), 2000);
				});
			});
		});

		connection.on(VoiceConnectionStatus.Disconnected, () => {
			console.log(`Disconnected from voice in guild ${guildId}`);
			activeConnections.delete(guildId);
			
			// Clean up recording state
			const recordingState = activeRecordings.get(guildId);
			if (recordingState && recordingState.summaryTimer) {
				clearInterval(recordingState.summaryTimer);
			}
			activeRecordings.delete(guildId);
		});

		return true;
	} catch (error) {
		console.error(`Error setting up voice connection for guild ${guildId}:`, error);
		return false;
	}
}

// Process buffered audio data for a user
async function processAudioBuffer(bufferKey, userName, guildId) {
	const buffer = audioBuffers.get(bufferKey);
	
	// Return if buffer is already being processed or if there's recent activity
	if (buffer.isProcessing || Date.now() - buffer.lastActivity < 1500) {
		return;
	}
	
	// Set processing flag
	buffer.isProcessing = true;
	
	try {
		// Check if we have any audio to process
		if (buffer.chunks.length === 0) {
			buffer.isProcessing = false;
			return;
		}
		
		// Calculate total buffer size
		const totalSize = buffer.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
		
		// If buffer is too large or too old, process it immediately
		if (totalSize > MAX_BUFFER_SIZE || Date.now() - buffer.lastActivity > MAX_BUFFER_DURATION) {
			console.log(`Processing large/old buffer for ${userName} (${totalSize} bytes)`);
		}
		
		// Combine all audio chunks
		const combinedBuffer = Buffer.concat(buffer.chunks);
		
		// Only process if we have enough audio data (at least 0.2 seconds at 48000Hz)
		const minLength = 48000 * 0.2 * 2; // Sample rate * min duration * 2 bytes per sample
		
		if (combinedBuffer.length < minLength) {
			console.log(`Audio from ${userName} too short (${combinedBuffer.length} bytes), skipping`);
			buffer.chunks = [];
			buffer.isProcessing = false;
			return;
		}
		
		console.log(`Processing combined audio for ${userName} in guild ${guildId}, size: ${combinedBuffer.length} bytes`);
		
		// Write combined buffer to PCM file
		const filePath = path.join(__dirname, `audio_${guildId}_${bufferKey}.pcm`);
		fs.writeFileSync(filePath, combinedBuffer);
		
		// Convert PCM to WAV format
		const wavFilePath = filePath.replace('.pcm', '.wav');
		await convertToWav(filePath, wavFilePath);
		
		// Send to Whisper API for transcription
		const transcription = await createWhisperTranscription(wavFilePath, guildId);
		
		if (transcription && transcription !== '[Transcription failed]' && transcription !== '[Audio too short]') {
			console.log(`${userName}: ${transcription}`);
			storeTranscription(guildId, bufferKey.split('_')[1], transcription);
		}
		else {
			console.log(`Failed to transcribe audio from ${userName} or audio too short`);
		}
		
		// Clean up files
		try {
			fs.unlinkSync(filePath);
			fs.unlinkSync(wavFilePath);
		} catch (err) {
			console.error(`Error cleaning up files: ${err.message}`);
		}
		
		// Clear the buffer
		buffer.chunks = [];
	}
	catch (error) {
		console.error(`Error processing audio buffer for ${userName}:`, error);
	}
	finally {
		// Reset processing flag
		buffer.isProcessing = false;
	}
}

// Store transcription with timestamp
function storeTranscription(guildId, userId, text) {
	// Filter out useless or too-short transcriptions
	if (!text || text.trim().length === 0 || 
	    text === '[Transcription failed]' || 
	    text === '[Audio too short]' ||
	    text === '[No speech detected]') {
		return;
	}
	
	const recordingState = activeRecordings.get(guildId);
	if (!recordingState) return;
	
	if (!recordingState.transcriptions[userId]) {
		recordingState.transcriptions[userId] = [];
	}
	
	recordingState.transcriptions[userId].push({
		text: text,
		timestamp: new Date()
	});
}

// Start the summary timer for a guild
async function startSummaryTimer(guildId) {
	const recordingState = activeRecordings.get(guildId);
	if (!recordingState) return;
	
	if (recordingState.summaryTimer) {
		clearInterval(recordingState.summaryTimer);
	}
	
	// Get guild configuration from the database
	const guildConfig = await getGuildConfig(guildId);
	if (guildConfig && guildConfig.summaryInterval) {
		recordingState.summaryInterval = guildConfig.summaryInterval;
	}
	
	// Find the text channel to post summaries
	let textChannelId = null;
	if (guildConfig && guildConfig.textChannelId) {
		textChannelId = guildConfig.textChannelId;
	}
	
	const guild = client.guilds.cache.get(guildId);
	let textChannel = null;
	
	if (textChannelId) {
		textChannel = guild.channels.cache.get(textChannelId);
	}
	
	// If no text channel is configured or it's not valid, try to find one
	if (!textChannel) {
		textChannel = guild.channels.cache.find(channel => 
			channel.type === ChannelType.GuildText && 
			channel.name.toLowerCase().includes('transcription'));
		
		// If still no channel, try to use the first text channel we can post to
		if (!textChannel) {
			textChannel = guild.channels.cache.find(channel => 
				channel.type === ChannelType.GuildText && 
				channel.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages));
		}
	}
	
	if (!textChannel) {
		console.warn(`No suitable text channel found in guild ${guildId}. Summaries will not be posted.`);
	}
	
	recordingState.summaryTimer = setInterval(async () => {
		if (!recordingState.isRecording) return;
		
		try {
			const lastInterval = new Date(Date.now() - recordingState.summaryInterval);
			const summary = await generateSummary(activeRecordings, users, guildId, lastInterval);
			
			if (summary.text.trim()) {
				const intervalMinutes = recordingState.summaryInterval / 60000;
				const header = `## Session Summary (Last ${intervalMinutes} minutes)\n\n`;
				const footer = `\n\n*Session duration: ${summary.metadata.sessionDuration}*`;
				const fullMessage = header + summary.text + footer;
				
				if (textChannel) {
					await textChannel.send(fullMessage)
						.then(() => console.log(`Posted interval summary to Discord in guild ${guildId}`))
						.catch(err => console.error(`Failed to post summary in guild ${guildId}:`, err));
				}
				
				// Also save to a file with timestamp
				const summaryFilePath = path.join(__dirname, `summary_${guildId}_${Date.now()}.txt`);
				fs.writeFileSync(summaryFilePath, fullMessage);
				console.log(`Saved summary to ${summaryFilePath}`);
			}
		} catch (error) {
			console.error('Error in summary timer:', error);
		}
	}, recordingState.summaryInterval);
}

// Function to migrate an active legacy session to the new SessionState system
async function migrateActiveRecordingToSessionState(guildId, campaignName = 'Unnamed Campaign', language = 'en') {
	const { SessionState } = await import('./models/SessionState.js');
	
	// Check if there's already an active session for this guild
	const existingSession = await SessionState.getActiveSession(guildId);
	if (existingSession) {
		console.log(`Session already exists for guild ${guildId}, no migration needed`);
		return existingSession;
	}
	
	// Create a new session state with data from the active recording
	const recordingState = activeRecordings.get(guildId);
	if (!recordingState) {
		console.log(`No active recording found for guild ${guildId}`);
		return null;
	}
	
	try {
		// Calculate approximate start time based on the first transcription or current time
		const startTime = recordingState.transcriptions?.length > 0 
			? new Date(recordingState.transcriptions[0].timestamp) 
			: new Date();
			
		const newSession = new SessionState({
			guildId,
			campaignName,
			language,
			startTime,
			status: 'active',
			transcription: recordingState.transcriptions?.map(t => `[${new Date(t.timestamp).toISOString()}] ${t.username || 'Unknown'}: ${t.text}`).join('\n') || ''
		});
		
		await newSession.save();
		console.log(`Migrated legacy session to SessionState for guild ${guildId}`);
		return newSession;
	} catch (error) {
		console.error(`Error migrating session for guild ${guildId}:`, error);
		return null;
	}
}

// Handle slash commands
client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isCommand()) return;
	
	const { commandName, guildId } = interaction;
	
	// Check if we have a command handler for this command
	const command = client.commands.get(commandName);
	if (command) {
		try {
			await command.execute(interaction);
			return;
		} catch (error) {
			console.error(`Error executing command ${commandName}:`, error);
			
			// Reply to the user if there was an error
			try {
				if (!interaction.replied && !interaction.deferred) {
					await interaction.reply({ 
						content: 'There was an error while executing this command!', 
						ephemeral: true 
					});
				} else if (interaction.deferred) {
					await interaction.editReply({
						content: 'There was an error while executing this command!'
					});
				}
			} catch (replyError) {
				console.error('Failed to send error reply:', replyError);
			}
			return;
		}
	}
	
	// Handle existing hard-coded commands
	if (commandName === 'register') {
		// Check if user has admin permissions
		if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
			return interaction.reply({ 
				content: 'You need administrator permissions to register the bot.', 
				ephemeral: true 
			});
		}

		const voiceChannel = interaction.options.getChannel('voicechannel');
		const textChannel = interaction.options.getChannel('textchannel');
		
		// Make sure it's a voice channel
		if (voiceChannel.type !== ChannelType.GuildVoice) {
			return interaction.reply({ 
				content: 'Please select a voice channel.', 
				ephemeral: true 
			});
		}
		
		try {
			// Check if API key is configured
			const serverConfig = await ServerConfig.findOne({ guildId: interaction.guildId });
			if (!serverConfig || !serverConfig.openaiApiKey) {
				return interaction.reply({ 
					content: '❌ **No OpenAI API key configured!**\n\nBefore registering, you need to set up your OpenAI API key:\n\n1. Get an API key from [OpenAI Platform](https://platform.openai.com/api-keys)\n2. Use `/apikey set <your-key>` to configure it\n3. Then use `/register` again\n\n**Why do I need this?**\nThe bot uses your API key to transcribe audio and generate summaries. This ensures you control your own costs and usage.', 
					ephemeral: true 
				});
			}

			// Test the API key
			const apiKey = serverConfig.getDecryptedApiKey();
			if (!apiKey) {
				return interaction.reply({ 
					content: '❌ **API key decryption failed!**\n\nPlease reconfigure your API key with `/apikey set <your-key>`', 
					ephemeral: true 
				});
			}
			
			// Check if interaction is still valid
			if (!interaction.isCommand()) return;
			
			// Defer the reply to prevent timeout
			await interaction.deferReply({ ephemeral: true });
			
			// Update server config with voice and text channels
			await ServerConfig.findOneAndUpdate(
				{ guildId: interaction.guildId },
				{ 
					voiceChannelId: voiceChannel.id,
					textChannelId: textChannel ? textChannel.id : null,
					isActive: true
				},
				{ upsert: true, new: true }
			);
			
			// Register in database (legacy support)
			await registerGuild(
				interaction.guildId, 
				voiceChannel.id, 
				textChannel ? textChannel.id : null
			);
			
			// Register guild-specific commands
			await registerGuildCommands(client.user.id, interaction.guildId);
			
			const disclaimer = `
# ✅ DnD Scribe Setup Complete!

**Your server is now configured with:**
- Voice channel: ${voiceChannel.name}
- Text channel: ${textChannel ? textChannel.name : 'Not set'}
- OpenAI API key: ✅ Configured and tested

**Next steps:**
- Use \`/session start\` to begin a new D&D session
- Use \`/summary\` to get a full summary anytime
- Use \`/interval\` to change summary frequency
- Use \`/session end\` to end the session

**Important:** All transcriptions and summaries use your OpenAI API key, so you control the costs and usage.
`;
			
			await interaction.editReply(disclaimer);
		} catch (error) {
			console.error('Error during registration:', error);
			try {
				// Try to edit the deferred reply
				await interaction.editReply({ 
					content: 'An error occurred during registration. Please try again later.'
				});
			} catch (editError) {
				// If edit fails, try to send a new reply
				if (interaction.replied || interaction.deferred) {
					await interaction.followUp({ 
						content: 'An error occurred during registration. Please try again later.',
						ephemeral: true 
					});
				} else {
					await interaction.reply({ 
						content: 'An error occurred during registration. Please try again later.',
						ephemeral: true 
					});
				}
			}
		}
	}
	else if (commandName === 'help') {
		const helpMessage = `
# DnD Scribe Help

This bot transcribes voice conversations and generates summaries for DnD sessions.

## Getting Started
1. Use \`/apikey set\` to configure your OpenAI API key
2. Use \`/register\` to set up the bot on your server
3. Select a voice channel for the bot to listen to
4. Optionally select a text channel for summaries
5. Use \`/session start\` to begin a new session

## Command Reference

**Setup & Configuration**
• \`/apikey set\` - Set your OpenAI API key for this server
• \`/apikey test\` - Test your current API key
• \`/apikey status\` - Check API key configuration
• \`/apikey remove\` - Remove your API key
• \`/mongodb set\` - Set custom MongoDB connection string
• \`/mongodb test\` - Test your MongoDB connection
• \`/mongodb status\` - Check MongoDB configuration
• \`/mongodb remove\` - Switch to default MongoDB
• \`/register\` - Set up a voice channel for transcription and an optional text channel for summaries
• \`/unregister\` - Completely remove the bot from your server
• \`/interval\` - Set how often automatic summaries are generated (in minutes)

**Session Management**
• \`/session start\` - Start a new D&D session with specified campaign name and language
• \`/session pause\` - Temporarily pause the current recording
• \`/session resume\` - Resume a paused session
• \`/session status\` - Check the current session status and details
• \`/session highlight\` - Add an important moment to the current session
• \`/session translate\` - Translate the session to another language
• \`/session end\` - End the current session and generate a final summary

**Campaign Management**
• \`/namecampaign\` - Set the name of your campaign and designate the DM
• \`/deletecampaign\` - Remove campaign information
• \`/summary\` - Get a complete summary of the current session

## Data Control
• Each server uses its own OpenAI API key and MongoDB database
• You control your own costs and data storage
• All credentials are encrypted and stored securely

## How it works
The bot uses OpenAI's Whisper API to transcribe voice conversations in real-time.
Transcriptions are stored securely and used to generate summaries of your D&D sessions.
You can access your session summaries through the bot or via the web interface.
`;
		
		await interaction.reply(helpMessage);
	}
	else if (commandName === 'summary') {
		const recordingState = activeRecordings.get(guildId);
		if (!recordingState) {
			return interaction.reply({ 
				content: 'No active recording session found. Register the bot first with `/register`.', 
				ephemeral: true 
			});
		}
		
		try {
			const summary = await generateSummary(activeRecordings, users, guildId);
			if (summary.text.trim()) {
				// Split the summary into Discord-friendly chunks
				const chunks = splitSummaryForDiscord(
					summary.text,
					summary.metadata.campaignName,
					summary.metadata.sessionDuration
				);
				
				// Send each chunk as a separate message
				for (let i = 0; i < chunks.length; i++) {
					if (i === 0) {
						// First message can be a reply
						await interaction.reply(chunks[i]);
					} else {
						// Subsequent messages need to be sent to the channel
						await interaction.channel.send(chunks[i]);
					}
				}
			} else {
				await interaction.reply({ 
					content: 'No transcriptions available yet. Start talking in a voice channel to generate content.', 
					ephemeral: true 
				});
			}
		} catch (error) {
			console.error('Error generating summary:', error);
			await interaction.reply({ 
				content: 'Failed to generate summary. Please try again later or contact support if the issue persists.', 
				ephemeral: true 
			});
		}
	}
	else if (commandName === 'interval') {
		const recordingState = activeRecordings.get(interaction.guildId);
		if (!recordingState) {
			return interaction.reply({ 
				content: 'No active recording session found. Register the bot first with `/register`.', 
				ephemeral: true 
			});
		}
		
		const minutes = interaction.options.getInteger('minutes');
		if (minutes && minutes > 0) {
			recordingState.summaryInterval = minutes * 60 * 1000;
			
			// Update the database
			await updateSummaryInterval(interaction.guildId, minutes);
			
			// Restart timer with new interval
			startSummaryTimer(interaction.guildId);
			
			await interaction.reply(`Summary interval set to ${minutes} minutes.`);
		} else {
			await interaction.reply('Please provide a valid interval in minutes.');
		}
	}
	else if (commandName === 'unregister') {
		// Check if user has admin permissions
		if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
			return interaction.reply({ 
				content: 'You need administrator permissions to unregister the bot.', 
				ephemeral: true 
			});
		}
		
		try {
			// End any active sessions first
			if (activeConnections.has(interaction.guildId)) {
				const connection = activeConnections.get(interaction.guildId);
				connection.destroy();
				activeConnections.delete(interaction.guildId);
			}
			
			if (activeRecordings.has(interaction.guildId)) {
				const recordingState = activeRecordings.get(interaction.guildId);
				if (recordingState.summaryTimer) {
					clearInterval(recordingState.summaryTimer);
				}
				activeRecordings.delete(interaction.guildId);
			}
			
			// Deactivate in database
			await deactivateGuild(interaction.guildId);
			
			// Remove guild-specific commands
			try {
				const rest = new REST({ version: '10' }).setToken(token);
				await rest.put(
					Routes.applicationGuildCommands(client.user.id, interaction.guildId),
					{ body: [] } // Empty array to remove all guild commands
				);
			} catch (cmdError) {
				console.error('Error removing guild commands:', cmdError);
			}
			
			await interaction.reply('Bot has been completely unregistered from this server. All commands and functionality have been removed.');
		} catch (error) {
			console.error('Error during unregistration:', error);
			await interaction.reply({ 
				content: 'An error occurred during unregistration. Please try again later.', 
				ephemeral: true 
			});
		}
	}
});

// When the bot joins a new guild, send a welcome message
client.on(Events.GuildCreate, async guild => {
	try {
		// Find the first text channel we can post to
		const channel = guild.channels.cache.find(channel => 
			channel.type === ChannelType.GuildText && 
			channel.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages));
			
		if (channel) {
			// Send welcome message
			const welcomeMessage = `
# Welcome to DnD Scribe!

Thank you for adding DnD Scribe to your server. I'm here to transcribe your D&D sessions and create helpful summaries.

## Getting Started
1. Use \`/register\` to set up which voice channel I should listen to
2. Use \`/session start\` to begin a new D&D session
3. I'll create transcriptions and periodic summaries automatically
4. Use \`/summary\` anytime to get a complete session summary
5. When finished, use \`/session end\` to end the session

## Available Commands
• \`/register\` - Set up a voice channel for transcription
• \`/help\` - Display this help information
• \`/unregister\` - Remove the bot from your server

**Session Management**
• \`/session start\` - Start a new D&D session with campaign name
• \`/session pause\` - Temporarily pause recording
• \`/session resume\` - Resume a paused session
• \`/session status\` - Check the current session status
• \`/session highlight\` - Add an important moment to the session
• \`/session translate\` - Translate the session to another language
• \`/session end\` - End the current session

**Campaign Management**
• \`/namecampaign\` - Set the name of your campaign and DM
• \`/deletecampaign\` - Remove campaign information
• \`/summary\` - Get a complete summary of the current session
• \`/interval\` - Set how often automatic summaries are generated

For more information, use \`/help\`
`;
			
			await channel.send(welcomeMessage);
		}
	} catch (error) {
		console.error(`Error sending welcome message to guild ${guild.id}:`, error);
	}
});

// Export client, setupVoiceConnection, and maps for use in other modules
export { client, setupVoiceConnection, activeConnections, activeRecordings, users };

client.login(token);