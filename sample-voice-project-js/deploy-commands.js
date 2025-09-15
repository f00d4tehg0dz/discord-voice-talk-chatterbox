import { REST, Routes } from 'discord.js';
import { config, validateConfig } from './src/utils/config.js';
import { readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Validate configuration
try {
    validateConfig();
} catch (error) {
    console.error('❌ Configuration error:', error.message);
    process.exit(1);
}

/**
 * Deploy slash commands to Discord
 */
async function deployCommands() {
    try {
        console.log('🔄 Loading commands for deployment...');
        
        // Load all command files
        const commands = [];
        const commandsPath = join(__dirname, 'src', 'commands');
        const commandFiles = (await readdir(commandsPath)).filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            const commandPath = join(commandsPath, file);
            const command = await import(`file://${commandPath.replace(/\\/g, '/')}`);
            
            if (command.data && command.execute) {
                commands.push(command.data.toJSON());
                console.log(`✅ Loaded command: ${command.data.name}`);
            } else {
                console.warn(`⚠️ Command ${file} is missing data or execute function`);
            }
        }
        
        console.log(`📤 Deploying ${commands.length} commands to Discord...`);
        
        // Create REST client
        const rest = new REST({ version: '10' }).setToken(config.discord.token);
        
        // Deploy commands globally
        const data = await rest.put(
            Routes.applicationCommands(config.discord.clientId),
            { body: commands }
        );
        
        console.log(`✅ Successfully deployed ${data.length} commands globally!`);
        
        // List deployed commands
        console.log('\\n📋 Deployed commands:');
        commands.forEach(command => {
            console.log(`   • /${command.name} - ${command.description}`);
        });
        
        console.log('\\n🎉 Deployment complete! Commands may take up to an hour to appear globally.');
        
    } catch (error) {
        console.error('❌ Failed to deploy commands:', error);
        
        if (error.code === 50001) {
            console.error('\\n💡 This error usually means:');
            console.error('   • The bot token is invalid');
            console.error('   • The client ID is incorrect');
            console.error('   • The bot doesn\\t have the applications.commands scope');
        }
        
        process.exit(1);
    }
}

// Check command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Discord Voice Bot - Command Deployment

Usage:
  node deploy-commands.js [options]

Options:
  --help, -h     Show this help message
  --guild <id>   Deploy commands to a specific guild (for testing)

Examples:
  node deploy-commands.js              # Deploy globally
  node deploy-commands.js --guild 123  # Deploy to specific guild

Environment Variables:
  DISCORD_BOT_TOKEN    Your bot token
  DISCORD_CLIENT_ID    Your bot's client ID
`);
    process.exit(0);
}

// Handle guild-specific deployment
const guildIndex = args.indexOf('--guild');
if (guildIndex !== -1 && args[guildIndex + 1]) {
    const guildId = args[guildIndex + 1];
    console.log(`🎯 Deploying commands to guild: ${guildId}`);
    
    // Modify deployment for guild-specific
    deployCommands = async function() {
        try {
            console.log('🔄 Loading commands for guild deployment...');
            
            const commands = [];
            const commandsPath = join(__dirname, 'src', 'commands');
            const commandFiles = (await readdir(commandsPath)).filter(file => file.endsWith('.js'));
            
            for (const file of commandFiles) {
                const commandPath = join(commandsPath, file);
                const command = await import(`file://${commandPath.replace(/\\/g, '/')}`);
                
                if (command.data && command.execute) {
                    commands.push(command.data.toJSON());
                    console.log(`✅ Loaded command: ${command.data.name}`);
                }
            }
            
            console.log(`📤 Deploying ${commands.length} commands to guild ${guildId}...`);
            
            const rest = new REST({ version: '10' }).setToken(config.discord.token);
            
            const data = await rest.put(
                Routes.applicationGuildCommands(config.discord.clientId, guildId),
                { body: commands }
            );
            
            console.log(`✅ Successfully deployed ${data.length} commands to guild ${guildId}!`);
            console.log('\\n🚀 Guild commands are available immediately!');
            
        } catch (error) {
            console.error('❌ Failed to deploy guild commands:', error);
            process.exit(1);
        }
    };
}

// Run deployment
deployCommands();