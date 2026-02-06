# Discord Voice Talk Chatterbox Bot

A Discord voice bot that captures audio from voice channels in real-time, transcribes speech using OpenAI Whisper, generates responses with ChatGPT using custom character personalities, and responds back with synthesized speech using Chatterbox TTS.

## Features

- **Real-time Voice Capture**: Listens to users speaking in Discord voice channels
-  **Speech-to-Text**: Transcribes audio using OpenAI GPT-4o-transcribe (with Whisper fallback)
-  **AI Responses**: Generates contextual responses using ChatGPT with character personalities  
-  **Multiple Characters**: Supports multiple AI characters with unique voices and personalities
- **Text-to-Speech**: Converts responses to speech using Chatterbox TTS
- **Context Awareness**: Maintains conversation context across interactions
-  **Slash Commands**: Easy-to-use Discord slash commands

## Prerequisites

- Node.js 18+ 
- Discord Bot Token and Client ID
- OpenAI API Key
- Docker (for Chatterbox TTS)
- NVIDIA GPU (recommended for TTS)

## Quick Start

### 1. Clone and Setup

```bash
git clone <repository-url>
cd discord-voice-talk-chatterbox
npm install
```

### 2. Configuration

Copy the example environment file and configure:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
DISCORD_BOT_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here
OPENAI_API_KEY=your_openai_api_key_here
CHATTERBOX_TTS_URL=http://localhost:8001
DEFAULT_CHARACTER=wizard

# Optional: Transcription model configuration
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-transcribe  # or gpt-4o-mini-transcribe for faster/cheaper transcription

# Optional: Audio filtering thresholds (prevents responding to empty noise)
AUDIO_SILENCE_THRESHOLD=0.01        # Very low audio level threshold
AUDIO_NOISE_THRESHOLD=0.05          # Minimum meaningful speech level
AUDIO_PEAK_THRESHOLD=0.1            # Minimum peak volume for speech
AUDIO_MIN_DURATION_MS=170           # Minimum audio duration (milliseconds)
TRANSCRIPTION_MIN_CONFIDENCE=0.3    # Minimum transcription confidence
SINGLE_WORD_CONFIDENCE_THRESHOLD=0.7 # Higher confidence required for single words
```

### 3. Start Services

#### Option A: Docker Compose (Recommended)

```bash
# Start both bot and TTS server
docker-compose up -d

# View logs
docker-compose logs -f
```

#### Option B: Manual Setup

```bash
# Start Chatterbox TTS server (in separate terminal)
docker run -d -p 8004:8004 --gpus all devnen/chatterbox-tts-server:latest

# Deploy commands to Discord
node deploy-commands.js

# Start the bot
npm start
```

### 4. Invite Bot to Server

Create an invite link with these permissions:
- `applications.commands` (for slash commands)
- `Connect` (to join voice channels)  
- `Speak` (to play audio)
- `Use Voice Activity` (to detect speech)
- `Send Messages` (to send text responses)

## Usage

### Basic Commands

- `/join` - Join your voice channel and start listening
- `/leave` - Leave voice channel and stop listening
- `/character set <name>` - Change the active character
- `/character list` - Show available characters
- `/character current` - Show current character info

### Voice Interaction

1. Use `/join` to make the bot join your voice channel
2. The bot will greet you with the selected character's voice
3. Speak naturally - the bot will transcribe your speech and respond
4. The bot responds both with text messages and synthesized speech
5. Use `/leave` when finished

### Characters

The bot includes several pre-configured characters:

- **Wizard** - A wise, mystical character who speaks in riddles
- **Maya** - A friendly, slightly anxious artist  
- **Emma** - A casual and laid-back character

## Project Structure

```
discord-voice-talk-chatterbox/
├── src/
│   ├── commands/          # Slash commands
│   │   ├── join.js        # Join voice channel
│   │   ├── leave.js       # Leave voice channel
│   │   └── character.js   # Character management
│   └── utils/             # Utility modules
│       ├── config.js      # Configuration management
│       ├── voiceConnection.js  # Discord voice handling
│       ├── transcription.js    # OpenAI Whisper integration
│       ├── chatgpt.js     # ChatGPT integration
│       └── tts.js         # Chatterbox TTS integration
├── config/
│   └── characters.json    # Character definitions
├── index.js              # Main bot application
├── deploy-commands.js    # Command deployment script
├── docker-compose.yml    # Docker services
└── package.json         # Dependencies
```

## How It Works

1. **Voice Capture**: Bot joins Discord voice channel and captures real-time audio from users
2. **Audio Processing**: Raw audio is converted to WAV format using FFmpeg
3. **Transcription**: Audio is sent to OpenAI Whisper API for speech-to-text conversion
4. **Response Generation**: Transcribed text is sent to ChatGPT with character personality prompts
5. **Speech Synthesis**: ChatGPT response is converted to speech using Chatterbox TTS
6. **Audio Playback**: Generated speech is played back in the Discord voice channel

## Character Configuration

Characters are defined in `config/characters.json`:

```json
{
  "wizard": {
    "name": "Wizard",
    "system_prompt": "You are a wise wizard...",
    "greeting": "Ah, a seeker of knowledge!",
    "voice_config": {
      "voice_id": "wizard_voice",
      "speed": 0.9,
      "pitch": 0.8,
      "style": "mystical"
    }
  }
}
```

## Development

### Local Development

```bash
# Install dependencies
npm install

# Deploy commands for testing (to specific guild)
node deploy-commands.js --guild YOUR_GUILD_ID

# Start in development mode
npm run dev
```

### Adding New Characters

1. Add character configuration to `config/characters.json`
2. Create voice samples for Chatterbox TTS (optional)
3. Update character choices in command files
4. Restart the bot

## Troubleshooting

### Common Issues

**Bot not responding to voice:**
- Check OpenAI API key and credits
- Ensure FFmpeg is installed 
- Verify voice channel permissions

**TTS not working:**
- Check if Chatterbox TTS server is running on port 8004
- Ensure GPU is available for TTS (if using GPU acceleration)
- Check Docker logs: `docker logs chatterbox-tts-server`

**Commands not appearing:**
- Re-run `node deploy-commands.js`
- Wait up to 1 hour for global command deployment
- Try guild-specific deployment for testing

### Logs and Debugging

```bash
# View bot logs
docker-compose logs discord-bot

# View TTS server logs  
docker-compose logs chatterbox-tts

# View all logs
docker-compose logs -f
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes  
4. Test thoroughly
5. Submit a pull request


## Acknowledgments

- OpenAI for Whisper and ChatGPT APIs
- Discord.js community
- Chatterbox TTS project
- FFmpeg for audio processing
