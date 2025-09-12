import { REST, Routes } from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID || '';
const guildId = process.env.GUILD_ID;

if (!token) {
	console.error('Missing TOKEN environment variable. Please check your .env file.');
	process.exit(1);
}

// Load commands from the filesystem
async function loadCommands() {
	const commands = [];
	const commandsPath = path.join(__dirname, 'commands');
	const commandFiles = [];
	const commandNames = new Set(); // Track command names to prevent duplicates
	
	// Read command files from the main commands directory
	try {
		const mainFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
		for (const file of mainFiles) {
			commandFiles.push({
				path: path.join(commandsPath, file),
				relativePath: `./commands/${file}`
			});
		}
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
			
			for (const file of subFiles) {
				commandFiles.push({
					path: path.join(subDirPath, file),
					relativePath: `./commands/${dir}/${file}`
				});
			}
		}
	} catch (error) {
		console.error('Error reading command subdirectories:', error);
	}
	
	// Import each command module
	for (const file of commandFiles) {
		try {
			// Import the command module using dynamic import
			const fullImportPath = file.relativePath;
			console.log(`Loading command from ${fullImportPath}`);
			const commandModule = await import(fullImportPath);
			
			if (commandModule.data) {
				// Check for duplicate command names
				const commandName = commandModule.data.name;
				if (commandNames.has(commandName)) {
					console.warn(`[WARNING] Duplicate command name found: "${commandName}" in ${file.path} - skipping`);
					continue;
				}
				
				commandNames.add(commandName);
				commands.push(commandModule.data);
				console.log(`Successfully loaded command: ${commandName}`);
			} else {
				console.log(`[WARNING] Command at ${file.path} is missing required "data" property`);
			}
		} catch (error) {
			console.error(`[ERROR] Failed to load command from ${file.path}:`, error);
		}
	}
	
	return { commands, commandNames };
}

// Additional built-in commands that you want to deploy as guild commands
const additionalCommands = [
	// These commands are already handled in index.js and would cause duplicates
	// if included here. Uncomment if you want to deploy them manually.
	/*
	new SlashCommandBuilder()
		.setName('namecampaign')
		.setDescription('Set the name of your DnD campaign and designate the DM')
		.addStringOption(option =>
			option.setName('name')
				.setDescription('The name of your campaign')
				.setRequired(true))
		.addUserOption(option =>
			option.setName('dm')
				.setDescription('The user who will be the DM')
				.setRequired(true)),
	
	new SlashCommandBuilder()
		.setName('deletecampaign')
		.setDescription('Remove the campaign name and DM designation'),
	*/
];

(async () => {
	try {
		// Load commands from filesystem
		const { commands: fileCommands, commandNames } = await loadCommands();
		console.log(`Loaded ${fileCommands.length} command(s) from filesystem`);
		
		// Filter additional commands to prevent duplicates
		const filteredAdditionalCommands = additionalCommands.filter(cmd => {
			if (commandNames.has(cmd.name)) {
				console.warn(`[WARNING] Skipping duplicate command name in additionalCommands: ${cmd.name}`);
				return false;
			}
			return true;
		});
		
		// Combine with additional commands
		const allCommands = [...fileCommands, ...filteredAdditionalCommands];
		console.log(`Deploying ${allCommands.length} total command(s)`);
		
		// Create REST instance
		const rest = new REST({ version: '10' }).setToken(token);

		// If no guildId is specified, deploy as global commands
		if (!guildId) {
			console.log('No GUILD_ID specified, deploying as global commands...');
			const data = await rest.put(
				Routes.applicationCommands(clientId || await getClientId()),
				{ body: allCommands.map(command => typeof command.toJSON === 'function' ? command.toJSON() : command) }
			);
			console.log(`Successfully deployed ${data.length} global command(s)`);
		} else {
			// Deploy to specific guild
			console.log(`Deploying to guild ${guildId}...`);
			const data = await rest.put(
				Routes.applicationGuildCommands(clientId || await getClientId(), guildId),
				{ body: allCommands.map(command => typeof command.toJSON === 'function' ? command.toJSON() : command) }
			);
			console.log(`Successfully deployed ${data.length} command(s) to guild ${guildId}`);
		}
	} catch (error) {
		console.error('Error deploying commands:', error);
	}
})();

// Helper function to get client ID if not provided in .env
async function getClientId() {
	try {
		const response = await fetch('https://discord.com/api/v10/users/@me', {
			headers: {
				Authorization: `Bot ${token}`,
			},
		});
		
		if (!response.ok) {
			throw new Error(`Failed to fetch bot info: ${response.status} ${response.statusText}`);
		}
		
		const data = await response.json();
		console.log(`Retrieved client ID: ${data.id}`);
		return data.id;
	} catch (error) {
		console.error('Error getting client ID:', error);
		process.exit(1);
	}
}