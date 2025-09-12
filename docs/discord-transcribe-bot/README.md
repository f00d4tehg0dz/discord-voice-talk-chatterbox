# Discord D&D Transcription Bot

A comprehensive Discord bot that transcribes D&D sessions using OpenAI's Whisper API, generates intelligent summaries, and provides a web interface for viewing session history. Perfect for D&D groups who want to keep detailed records of their adventures.

## 🚀 Quick Start

[![Invite Bot](https://img.shields.io/badge/Invite%20Bot-Discord-7289DA?style=for-the-badge&logo=discord)](https://discord.com/oauth2/authorize?client_id=879500808536870952)

## ✨ Features

### 🎙️ Audio Processing
- **Real-time voice transcription** in Discord voice channels
- **Multi-user support** with individual speaker identification
- **Audio chunking** for optimal processing and memory management
- **Automatic cleanup** of temporary audio files
- **High-quality transcription** using OpenAI's Whisper API

### 📝 Intelligent Summaries
- **Automatic summaries** at configurable intervals (default: 30 minutes)
- **D&D-optimized prompts** for better context understanding
- **Structured cliff notes** with emojis and categorized sections:
  - 🎭 Key Roleplay Moments
  - ⚔️ Combat Highlights
  - 🎲 Important Rolls & Checks
  - 🏰 Exploration & Discovery
  - 💰 Loot & Rewards
  - 📜 Plot Developments
  - 🎪 Notable Events

### 🎮 D&D-Specific Features
- **Campaign management** with automatic session numbering
- **Character name mapping** for consistent transcription
- **DM identification** and special handling
- **Fantasy terminology** recognition and context
- **Session duration tracking** and statistics

### 🔒 Security & Privacy
- **End-to-end encryption** for all stored data
- **MongoDB integration** with secure data storage
- **User permission controls** for server access
- **Data retention policies** with automatic cleanup

### 🌐 Web Interface
- **Session history browser** with campaign organization
- **Search functionality** across all sessions
- **Export capabilities** for offline reading
- **Responsive design** for mobile and desktop

## 📋 Prerequisites

Before setting up the bot, ensure you have:

- **Node.js 18+** (LTS recommended)
- **ffmpeg** installed on your system
- **MongoDB** (local or cloud instance like MongoDB Atlas)
- **Discord Bot Token** with proper permissions
- **OpenAI API Key** with access to Whisper API
- **Discord Server** with admin permissions

## 🛠️ Installation

### Method 1: Docker (Recommended)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/DiscordTranscribeDnD.git
   cd DiscordTranscribeDnD
   ```

2. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` with your credentials:**
   ```env
   DISCORD_TOKEN=your_discord_bot_token
   MONGODB_URI=mongodb://localhost:27017/dnd-transcriptions
   ENCRYPTION_KEY=your_32_byte_base64_encryption_key
   ```

   **Note:** OpenAI API keys are now configured per-server via Discord commands, not in the environment file.

4. **Build and run with Docker:**
   ```bash
   docker-compose up --build
   ```

### Method 2: Manual Installation

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/yourusername/DiscordTranscribeDnD.git
   cd DiscordTranscribeDnD
   npm install
   ```

2. **Install system dependencies:**
   
   **Ubuntu/Debian:**
   ```bash
   sudo apt update
   sudo apt install ffmpeg python3 build-essential
   ```
   
   **macOS:**
   ```bash
   brew install ffmpeg
   ```
   
   **Windows:**
   Download ffmpeg from [ffmpeg.org](https://ffmpeg.org/download.html) and add to PATH

3. **Set up MongoDB:**
   
   **Local MongoDB:**
   ```bash
   # Install MongoDB
   sudo apt install mongodb  # Ubuntu/Debian
   brew install mongodb-community  # macOS
   
   # Start MongoDB
   sudo systemctl start mongod  # Linux
   brew services start mongodb-community  # macOS
   ```
   
   **MongoDB Atlas (Cloud):**
   - Create account at [MongoDB Atlas](https://www.mongodb.com/atlas)
   - Create a cluster
   - Get connection string
   - Add your IP to whitelist

4. **Create environment file:**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

5. **Start the bot:**
   ```bash
   npm start
   ```

**Note:** OpenAI API keys and MongoDB configurations are now managed per-server through Discord commands for better security and user control.

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `DISCORD_TOKEN` | Your Discord bot token | ✅ | `MTIzNDU2Nzg5MDEyMzQ1Njc4.GhIjKl.MnOpQrStUvWxYzAbCdEfGhIjKlMnOpQrStUvWx` |
| `MONGODB_URI` | Default MongoDB connection string | ✅ | `mongodb://localhost:27017/dnd-transcriptions` |
| `ENCRYPTION_KEY` | 32-byte base64 encryption key | ✅ | Generate with: `openssl rand -base64 32` |

**Note:** OpenAI API keys and custom MongoDB configurations are now managed per-server through Discord commands for enhanced security and user control.

### Discord Bot Setup

1. **Create a Discord Application:**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Click "New Application"
   - Name your bot (e.g., "D&D Scribe")

2. **Create Bot User:**
   - Go to "Bot" section
   - Click "Add Bot"
   - Copy the token (this is your `DISCORD_TOKEN`)

3. **Set Bot Permissions:**
   - Go to "OAuth2" > "URL Generator"
   - Select scopes: `bot`, `applications.commands`
   - Select permissions:
     - `Connect` (to join voice channels)
     - `Speak` (to process audio)
     - `Use Slash Commands`
     - `Send Messages`
     - `Embed Links`
     - `Read Message History`

4. **Invite Bot to Server:**
   - Use the generated URL to invite your bot
   - Or use: `https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=3145728&scope=bot%20applications.commands`

## 🎮 Usage

### Server Setup

1. **Invite the bot** to your Discord server
2. **Configure your OpenAI API key:**
   ```
   /apikey set sk-your-openai-api-key-here
   ```
3. **Optionally configure custom MongoDB:**
   ```
   /mongodb set mongodb://user:pass@host:port/database
   ```
4. **Register a voice channel:**
   ```
   /register #voice-channel #summary-channel
   ```
5. **Set summary interval** (optional):
   ```
   /interval 30
   ```

### Setup Examples

#### **Simple Setup (Default Database)**
```bash
# 1. Set your OpenAI API key
/apikey set sk-your-openai-api-key-here

# 2. Register the bot
/register #voice-channel #summary-channel

# 3. Start a session
/session start "My Campaign"
```

#### **Advanced Setup (Custom Database)**
```bash
# 1. Set your OpenAI API key
/apikey set sk-your-openai-api-key-here

# 2. Configure custom MongoDB
/mongodb set mongodb://user:pass@your-server:27017/dnd-transcriptions

# 3. Test the connection
/mongodb test

# 4. Register the bot
/register #voice-channel #summary-channel

# 5. Start a session
/session start "My Campaign"
```

#### **MongoDB Atlas Setup**
```bash
# 1. Get connection string from MongoDB Atlas
# Format: mongodb+srv://username:password@cluster.mongodb.net/database

# 2. Set your OpenAI API key
/apikey set sk-your-openai-api-key-here

# 3. Configure MongoDB Atlas
/mongodb set mongodb+srv://user:pass@cluster.mongodb.net/dnd-transcriptions

# 4. Test the connection
/mongodb test

# 5. Register and start
/register #voice-channel #summary-channel
/session start "My Campaign"
```

### Commands

#### **API Key Management**
| Command | Description | Usage |
|---------|-------------|-------|
| `/apikey set <key>` | Set your OpenAI API key | `/apikey set sk-...` |
| `/apikey test` | Test your current API key | `/apikey test` |
| `/apikey status` | Check API key configuration | `/apikey status` |
| `/apikey remove` | Remove your API key | `/apikey remove` |

#### **MongoDB Management**
| Command | Description | Usage |
|---------|-------------|-------|
| `/mongodb set <uri>` | Set custom MongoDB connection | `/mongodb set mongodb://...` |
| `/mongodb test` | Test your MongoDB connection | `/mongodb test` |
| `/mongodb status` | Check MongoDB configuration | `/mongodb status` |
| `/mongodb remove` | Switch to default MongoDB | `/mongodb remove` |

#### **Bot Management**
| Command | Description | Usage |
|---------|-------------|-------|
| `/register [voice] [text]` | Register voice channel for monitoring | `/register #general #summaries` |
| `/summary` | Generate immediate summary | `/summary` |
| `/interval [minutes]` | Set auto-summary interval | `/interval 45` |
| `/unregister` | Remove bot from server | `/unregister` |
| `/help` | Show help information | `/help` |

### Session Workflow

1. **Start Session:**
   - Bot automatically joins when users speak
   - Begins recording and transcribing using your API key

2. **During Session:**
   - Real-time transcription of all speech
   - Automatic summaries at set intervals
   - Character identification and context
   - Data stored in your configured database

3. **End Session:**
   - Final comprehensive summary
   - Cliff notes with key moments
   - Data saved to your database (default or custom)

## 🏗️ Architecture

### Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Discord Bot   │────│   OpenAI Whisper │────│   MongoDB       │
│   (Audio Rec.)  │    │   (Transcription)│    │   (Storage)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Audio Buffer  │    │   Summary Gen.   │    │   Web Interface │
│   Management    │    │   (GPT-4)        │    │   (Viewer)      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Data Flow

1. **Audio Capture:** Discord voice → Opus decoder → PCM buffer
2. **Transcription:** PCM → WAV → OpenAI Whisper (using server's API key) → Text
3. **Processing:** Text → Context analysis → Summary generation (using server's API key)
4. **Storage:** Encrypted data → Server-specific MongoDB → Web interface

## 🚀 Enhanced Features

### **Per-Server Configuration**
- **Individual API Keys:** Each Discord server uses its own OpenAI API key
- **Custom Databases:** Each server can use its own MongoDB instance
- **Cost Control:** You control your own API usage and database costs
- **Data Isolation:** Complete separation between different servers

### **Flexible Database Options**
- **Default MongoDB:** Use the bot's shared database (simple setup)
- **Custom MongoDB:** Use your own MongoDB instance (enterprise-grade)
- **MongoDB Atlas:** Cloud-hosted database with automatic scaling
- **Local MongoDB:** Self-hosted database for maximum control

### **Advanced Security**
- **Encrypted Storage:** All credentials encrypted with AES-256-GCM
- **Connection Testing:** Validate API keys and database connections
- **Admin Controls:** Only server administrators can configure settings
- **Secure Transmission:** All data encrypted in transit and at rest

## 🔒 Security & Privacy

### Data Protection
- **Encryption:** All summaries and credentials encrypted with AES-256-GCM
- **Access Control:** Server-based permissions and isolated databases
- **Data Retention:** Configurable cleanup policies
- **Privacy:** Audio processed and discarded immediately
- **API Key Security:** Each server uses its own encrypted OpenAI API key
- **Database Isolation:** Each server can use its own MongoDB instance

### Best Practices
- Use strong encryption keys
- Regular security updates
- Monitor API usage and costs
- Backup important data
- Use custom MongoDB for production environments
- Regularly test API key and database connections

## 🐳 Docker Deployment

### Production Setup

1. **Create production environment:**
   ```bash
   cp .env.example .env.production
   # Edit with production values
   ```

2. **Deploy with Docker Compose:**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Monitor logs:**
   ```bash
   docker-compose logs -f discord-bot
   ```

### Docker Configuration

The included `Dockerfile` and `docker-compose.yml` provide:
- Node.js 20 LTS runtime
- ffmpeg for audio processing
- Volume mounts for persistent data
- Automatic restart policies
- Network isolation

## 🧪 Development

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up development environment:**
   ```bash
   cp .env.example .env.development
   # Edit with development values
   ```

3. **Run in development mode:**
   ```bash
   npm run dev
   ```

### Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Lint code
npm run lint
```

### Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📊 Monitoring & Maintenance

### Health Checks

- **Bot Status:** `/help` command response
- **Database:** MongoDB connection status
- **API Limits:** OpenAI usage monitoring
- **Storage:** Disk space and file cleanup

### Logs

Logs are stored in the `logs/` directory:
- `bot.log` - General bot operations
- `error.log` - Error tracking
- `transcription.log` - Audio processing

### Cleanup

Automatic cleanup runs daily:
- Temporary audio files
- Old log files
- Expired sessions

## 🆘 Troubleshooting

### Common Issues

**Bot not joining voice channel:**
- Check bot permissions
- Verify voice channel access
- Ensure bot is online

**Transcription not working:**
- Use `/apikey test` to verify your API key
- Check internet connection
- Review audio quality
- Ensure API key has Whisper access

**Database connection issues:**
- Use `/mongodb test` to verify your connection
- Check MongoDB URI format
- Verify network connectivity
- Review authentication credentials

**API key issues:**
- Use `/apikey status` to check configuration
- Verify API key format (starts with `sk-`)
- Check OpenAI account billing
- Ensure sufficient credits

**MongoDB configuration issues:**
- Use `/mongodb status` to check configuration
- Verify connection string format
- Test with `/mongodb test`
- Check firewall settings

### Getting Help

- **Issues:** [GitHub Issues](https://github.com/yourusername/DiscordTranscribeDnD/issues)
- **Discussions:** [GitHub Discussions](https://github.com/yourusername/DiscordTranscribeDnD/discussions)
- **Documentation:** [Wiki](https://github.com/yourusername/DiscordTranscribeDnD/wiki)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **OpenAI** for the Whisper API
- **Discord.js** for the Discord integration
- **MongoDB** for data storage
- **D&D Community** for inspiration and feedback

## 🔮 Roadmap

### Recently Added Features ✅
- [x] **Per-server API key management** - Each server uses its own OpenAI API key
- [x] **Custom MongoDB configuration** - Use your own database instance
- [x] **Encrypted credential storage** - All sensitive data encrypted with AES-256-GCM
- [x] **Connection testing** - Validate API keys and database connections
- [x] **Enhanced security** - Admin-only configuration with encrypted storage

### Upcoming Features
- [ ] Multi-language support
- [ ] Real-time transcription streaming
- [ ] Character relationship mapping
- [ ] Campaign timeline visualization
- [ ] Mobile app companion
- [ ] Integration with D&D Beyond
- [ ] Voice command support
- [ ] Advanced analytics dashboard
- [ ] Database migration tools
- [ ] API usage analytics
- [ ] Backup and restore functionality

---
