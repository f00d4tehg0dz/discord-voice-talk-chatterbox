# Discord Voice AI Bot - Educational Sample Project

This project is a comprehensive example of a Discord bot built with Discord.js that demonstrates modern voice bot development patterns. It showcases real-time voice processing, AI integration, and text-to-speech synthesis using current Discord API best practices.

## Learning Objectives

This sample project teaches developers how to:

- Build Discord bots using modern Discord.js patterns and slash commands
- Implement voice channel connections and audio processing
- Integrate OpenAI APIs for speech transcription and text generation
- Create character-based AI systems with personality management
- Handle real-time audio streaming and voice activity detection
- Implement proper error handling and resource cleanup
- Structure modular Discord bot applications

## Features

- **Voice Channel Integration** - Connect to Discord voice channels and process user audio
- **Real-time Speech Processing** - Capture and transcribe speech using OpenAI Whisper
- **AI Character Responses** - Multiple character personalities with distinct conversation styles
- **Image Generation** - AI-powered image creation using OpenAI DALL-E API
- **Modern Slash Commands** - Uses Discord's application command system for better UX
- **Text Chat Support** - Handles both voice and text-based interactions

## Architecture Overview

### Core Components

1. **Main Application** (`index.js`)
   - Discord client initialization and event handling
   - Command loading and registration system
   - Voice state monitoring and audio event processing

2. **Slash Commands** (`src/commands/`)
   - `/join` - Connect to voice channels with permission validation
   - `/leave` - Disconnect and cleanup voice resources
   - `/character` - Manage AI personalities and conversation context

3. **Utility Modules** (`src/utils/`)
   - `voiceConnection.js` - Voice connection management and audio processing
   - `chatgpt.js` - OpenAI API integration and character management
   - `tts.js` - Text-to-speech synthesis with Chatterbox integration
   - `transcription.js` - Speech-to-text processing with fallback handling

4. **Character System** (`characters/` and `config/`)
   - JSON-based character definitions with personalities and voice settings
   - Dynamic character switching and context management
   - Conversation history and context persistence

### Audio Processing Pipeline

1. **Audio Capture** - Real-time capture from Discord voice channels using @discordjs/voice
2. **Voice Activity Detection** - Identify when users start and stop speaking
3. **Audio Buffering** - Collect audio data and convert format for transcription
4. **Speech Transcription** - Convert audio to text using OpenAI Whisper API
5. **AI Response Generation** - Generate character responses using ChatGPT
6. **Speech Synthesis** - Convert responses to audio using Chatterbox TTS
7. **Audio Playback** - Stream generated speech back to Discord voice channel

## Prerequisites

### Required Software

- **Node.js 18+** - JavaScript runtime environment
- **Discord Developer Account** - For bot token and application setup
- **OpenAI API Access** - For Whisper (transcription) and GPT-4 (text generation)
- **Docker** - For running the Chatterbox TTS server

### API Keys and Tokens

1. **Discord Bot Setup**
   - Create application at [Discord Developer Portal](https://discord.com/developers/applications)
   - Generate bot token and copy application (client) ID
   - Enable necessary bot permissions and intents

2. **OpenAI API Setup**
   - Create account at [OpenAI Platform](https://platform.openai.com/)
   - Generate API key with access to Whisper and GPT-4 models
   - Ensure sufficient API credits for testing

## Installation and Setup

### 1. Project Setup

```bash
# Clone or download the sample project
cd sample-voice-project-js

# Install Node.js dependencies
npm install

# Create environment configuration file
cp .env.example .env
```

### 2. Environment Configuration

Edit the `.env` file with your credentials:

```env
# Discord Bot Configuration
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here

# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key_here

# TTS Server Configuration (optional)
CHATTERBOX_TTS_URL=http://localhost:8004
```

### 3. Deploy Slash Commands

Before running the bot, register the slash commands with Discord:

```bash
# Deploy commands globally (takes up to 1 hour to sync)
npm run deploy-commands

# Or deploy to a specific guild for instant testing
node deploy-commands.js YOUR_GUILD_ID
```

### 4. Start TTS Server (Optional)

For voice synthesis functionality:

```bash
# Start Chatterbox TTS server using Docker
docker run -d -p 8004:8004 devnen/chatterbox-tts-server:latest

# Or use the provided docker-compose setup
docker-compose up -d
```

### 5. Run the Bot

```bash
# Start the bot
npm start

# Or run with auto-restart for development
npm run dev
```

## Usage Examples

### Basic Voice Interaction

1. Invite the bot to your Discord server with voice permissions
2. Join a voice channel
3. Use `/join` to make the bot connect to your voice channel
4. Speak naturally - the bot will transcribe and respond with AI-generated speech
5. Use `/leave` to disconnect the bot

### Character Management

```bash
# View current character
/character current

# Switch to a different character
/character set name:wizard

# List all available characters
/character list

# Reset conversation context
/character reset
```

### Advanced Features

- **Image Generation**: Mention drawing or sketching in voice chat for AI-generated images
- **Context Awareness**: The bot maintains conversation history for natural interactions
- **Multiple Characters**: Each character has unique personality traits and voice settings

## Code Structure for Developers

### Command Pattern

Each slash command follows a consistent structure:

```javascript
// src/commands/example.js
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('example')
    .setDescription('Example command description');

export async function execute(interaction) {
    // Command implementation
    await interaction.reply('Response');
}
```

### Voice Connection Management

```javascript
// Voice connection setup with proper error handling
const connection = await setupVoiceConnection(guildId, channelId, adapterCreator);

// Audio recording with voice activity detection
connection.receiver.speaking.on('start', (userId) => {
    const audioStream = connection.receiver.subscribe(userId);
    // Process audio stream...
});
```

### Character System Integration

```javascript
// Get guild's active character
const character = getGuildCharacter(guildId);

// Generate character-specific response
const response = await generateResponse(text, character, guildId, userId, username);

// Switch character with validation
setGuildCharacter(guildId, newCharacterName);
```

## Error Handling Best Practices

### Graceful Degradation

The bot implements multiple fallback mechanisms:

- **TTS Fallback**: If voice synthesis fails, sends text responses
- **API Fallback**: Multiple transcription models with automatic switching
- **Connection Recovery**: Automatic cleanup and reconnection handling

### Resource Management

```javascript
// Proper cleanup on shutdown
process.on('SIGINT', async () => {
    // Clean up voice connections
    for (const guildId of activeConnections.keys()) {
        cleanup(guildId);
    }

    // Destroy Discord client
    client.destroy();
    process.exit(0);
});
```

## Development Guidelines

### Code Style

- Use ES6+ modern JavaScript features
- Implement proper async/await error handling
- Follow Discord.js v14 patterns and best practices
- Include comprehensive logging for debugging

### Testing Recommendations

1. **Guild-specific Testing**: Deploy commands to a test guild for faster iteration
2. **Error Simulation**: Test with invalid inputs and network failures
3. **Resource Monitoring**: Monitor memory usage during long voice sessions
4. **API Rate Limiting**: Implement proper rate limiting for OpenAI API calls

### Performance Considerations

- **Audio Processing**: Use streaming for large audio files
- **Memory Management**: Clean up temporary files and audio buffers
- **Connection Pooling**: Reuse voice connections when possible
- **Caching**: Cache character configurations and frequent API responses

## Troubleshooting

### Common Issues

**Bot doesn't respond to voice:**
- Verify Discord bot permissions (Connect, Speak, Use Voice Activity)
- Check OpenAI API key and account credits
- Ensure TTS server is running and accessible
- Validate environment variables are properly set

**Commands not appearing:**
- Run command deployment script
- Check bot has Application Commands permission
- Wait for global command sync (up to 1 hour)

**Audio processing errors:**
- Verify Node.js version compatibility (18+)
- Check Discord voice connection stability
- Monitor console logs for specific error messages

### Development Debugging

```bash
# Enable detailed logging
LOG_LEVEL=debug npm start

# Check Discord API connectivity
curl -H "Authorization: Bot YOUR_BOT_TOKEN" https://discord.com/api/users/@me

# Test TTS server availability
curl http://localhost:8004/health
```

## Educational Extensions

### Suggested Improvements

1. **Database Integration**: Add persistent conversation storage with PostgreSQL or MongoDB
2. **Web Dashboard**: Create a web interface for character management and statistics
3. **Voice Commands**: Implement voice-triggered bot commands and controls
4. **Multi-language Support**: Add support for multiple languages in transcription and responses
5. **Analytics Dashboard**: Track usage statistics and conversation metrics

### Learning Exercises

1. **Add New Commands**: Create custom slash commands for specific bot functions
2. **Implement Webhooks**: Add webhook support for external integrations
3. **Create Custom Characters**: Design new AI personalities with unique traits
4. **Optimize Performance**: Implement caching and connection pooling
5. **Add Security Features**: Implement rate limiting and user permission systems

## Dependencies and Licensing

### Key Dependencies

- **discord.js** - Discord API library for Node.js
- **@discordjs/voice** - Voice connection and audio processing
- **openai** - Official OpenAI API client
- **axios** - HTTP client for API requests

### License

This sample project is provided for educational purposes. Please respect the terms of service for all integrated APIs and services.

## Support and Resources

### Documentation Links

- [Discord.js Guide](https://discordjs.guide/) - Comprehensive Discord.js documentation
- [Discord Developer Portal](https://discord.com/developers/docs) - Official Discord API documentation
- [OpenAI API Documentation](https://platform.openai.com/docs) - OpenAI API reference
- [Node.js Documentation](https://nodejs.org/docs/) - Node.js runtime documentation

### Community Resources

- [Discord.js Support Server](https://discord.gg/djs) - Official Discord.js community
- [Discord Developers Server](https://discord.gg/discord-developers) - Discord API community
- [OpenAI Community Forum](https://community.openai.com/) - OpenAI API discussions

Remember: This is an educational sample designed for learning Discord bot development. For production deployment, implement additional security measures, error handling, and performance optimizations based on your specific requirements.