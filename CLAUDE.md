# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This project aims to build a Discord voice bot that provides real-time conversational AI with custom character voices. The bot:

1. **Captures audio** from Discord voice channels in real-time
2. **Transcribes speech** to text using OpenAI Whisper
3. **Generates responses** using OpenAI ChatGPT with character personalities
4. **Synthesizes speech** using Chatterbox TTS for custom character voices
5. **Plays audio responses** back through Discord voice channels

## Architecture Reference

The project combines patterns from two existing reference implementations:

### Discord Transcription Bot (`docs/discord-transcribe-bot/`)
- **Core Bot Logic**: `index.js` - Discord client setup and voice connection management
- **Session Management**: `commands/session.js` - Voice session lifecycle (start/pause/resume/end)
- **Audio Processing**: Voice connection setup with real-time audio capture
- **Database Integration**: MongoDB for session persistence and transcription storage
- **Key Dependencies**: discord.js, @discordjs/voice, mongodb

### Chatterbox TTS Integration (`docs/chatterbox-project-example/`)
- **Character System**: Each character has a dedicated folder with voice samples and personality configs
- **Character Configuration**: `characters/*/prompts.json` - System prompts, voice styles, personality traits
- **Voice Synthesis**: Integration with `devnen/chatterbox-tts-server:latest` Docker container
- **Custom Voices**: `.wav` files for voice cloning with character-specific settings

## Development Commands

### Python Environment Setup
```bash
# Create and activate virtual environment
python -m venv .venv
# Windows
.venv\Scripts\activate
# Unix/MacOS
source .venv/bin/activate

# Install dependencies
pip install -e .

# With platform-specific magic support
pip install -e .[magic-win]  # Windows
pip install -e .[magic-unix] # Unix/MacOS
```

### Docker Development (for TTS integration)
```bash
# Build and start services
docker-compose up --build

# Production deployment
docker-compose -f docker-compose.prod.yml up -d

# Access main app at http://localhost:8000
# TTS server runs on port 8004
```

## Key Implementation Patterns

### Discord Voice Connection Setup
- Use `@discordjs/voice` for voice channel connections
- Implement voice connection lifecycle management (connect/disconnect/error handling)
- Set up audio receivers for real-time capture from multiple users

### Audio Processing Pipeline
1. **Voice Capture**: Real-time audio streaming from Discord users
2. **Audio Buffering**: Segment audio for transcription processing
3. **Whisper Integration**: Convert audio segments to text using OpenAI API
4. **Context Management**: Maintain conversation context per user/channel

### Character Response Generation
1. **Personality System**: Load character configs from `characters/*/prompts.json`
2. **ChatGPT Integration**: Send transcribed text with character system prompts
3. **Response Processing**: Format AI responses for character voice synthesis

### TTS Voice Synthesis
1. **Character Voice Mapping**: Map character to specific voice models and settings
2. **Chatterbox API**: Send text to TTS server with character-specific voice configs
3. **Audio Playback**: Stream generated audio back through Discord voice connection

## Required Environment Variables

```bash
# Discord Bot Configuration
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id

# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key

# Database Configuration (if using MongoDB)
MONGODB_URI=mongodb://localhost:27017/discord-voice-bot

# TTS Server Configuration
CHATTERBOX_TTS_URL=http://localhost:8004
```

## File Structure Patterns

```
/
├── main.py                 # Main bot application
├── pyproject.toml         # Python dependencies
├── docker-compose.yml     # Multi-service setup
├── characters/            # Character voice and personality configs
│   ├── wizard/
│   │   ├── wizard.json    # Character configuration
│   │   ├── wizard.wav     # Voice sample
│   │   └── biography.txt  # Character background
├── utils/
│   ├── discord_client.py  # Discord connection management
│   ├── voice_handler.py   # Audio capture and processing
│   ├── transcription.py   # OpenAI Whisper integration
│   ├── chatgpt_client.py  # ChatGPT API integration
│   └── tts_client.py      # Chatterbox TTS integration
└── docs/                  # Reference implementations
    ├── discord-transcribe-bot/  # Discord voice capture patterns
    └── chatterbox-project-example/  # TTS character system
```

## Key Dependencies

- **discord.py**: Discord bot framework with voice support
- **@discordjs/voice**: Discord voice connection management (if using Node.js)
- **openai**: OpenAI API client for Whisper transcription and ChatGPT
- **requests**: HTTP client for TTS server communication
- **pyaudio**: Audio processing capabilities
- **docker**: Container orchestration for TTS services