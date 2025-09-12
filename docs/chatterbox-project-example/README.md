# AI Voice Assistant

A web-based voice chat application that allows you to interact with AI characters using voice input and output. The application uses OpenAI's GPT-4 for natural language processing and Chatterbox TTS for voice synthesis.

## Prerequisites

- Docker and Docker Compose
- NVIDIA GPU with CUDA support (for TTS server)
- OpenAI API key

## Quick Start

1. Clone the repository:
```bash
git clone https://github.com/yourusername/AIVoiceAssistant.git
cd AIVoiceAssistant
```

2. Create a `.env` file in the root directory:
```bash
OPENAI_API_KEY=your_openai_api_key_here
```

3. Start the application:
```bash
docker-compose up --build
```

4. Open your browser and navigate to:
```
http://localhost:8000
```

## Deployment

### Docker Hub Deployment

1. **Build and Push to Docker Hub**:
```bash
# Make the build script executable
chmod +x build-and-push.sh

# Edit build-and-push.sh to set your Docker Hub username
# Replace "yourusername" with your actual Docker Hub username

# Run the build and push script
./build-and-push.sh
```

2. **Deploy using the production compose file**:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### RunPod.io Deployment

1. **Create a RunPod.io account** and set up a GPU instance

2. **Upload the docker-compose.runpod.yml file** to your RunPod instance

3. **Set environment variables** in RunPod:
   - `OPENAI_API_KEY`: Your OpenAI API key

4. **Deploy the application**:
```bash
docker-compose -f docker-compose.runpod.yml up -d
```

5. **Access the application** through RunPod's port forwarding or public IP

### Docker Images

- **Main Application**: `yourusername/ai-voice-assistant:latest`
- **TTS Server**: `devnen/chatterbox-tts-server:latest`

## Using the Web App

1. **Select a Character**: Choose from the available characters in the dropdown menu.
2. **Start Chatting**: 
   - Click and hold the microphone button to record your voice
   - Release to send your message
   - The character will respond with both text and voice
3. **Switch Characters**: Use the dropdown menu to switch between different characters. The chat history will be cleared when switching characters.

## Character Management

### Existing Characters

The application comes with several pre-configured characters:
- Maya: A friendly and slightly anxious artist
- Emma: A casual and approachable character
- Wizard: A wise and ancient wizard
- Oddly: A D&D workshop owner
- Adrian: A senior software engineer

### Modifying Existing Characters

Each character has its own directory under `characters/` with the following structure:
```
characters/
└── character_name/
    ├── character_name.wav    # Voice sample file
    ├── prompts.json         # Character configuration
    └── biography.txt        # Character background
```

To modify a character:

1. Edit `prompts.json` to update:
   - System prompt
   - Greeting message
   - Voice style
   - Personality traits
   - Interests
   - Speech patterns

2. Edit `biography.txt` to update the character's background story

3. Replace `character_name.wav` with a new voice sample (must be a WAV file)

### Adding New Characters

1. Create a new directory under `characters/`:
```bash
mkdir -p characters/new_character
```

2. Add the required files:
   - `new_character.wav`: Voice sample file
   - `prompts.json`: Character configuration
   - `biography.txt`: Character background

3. Create `prompts.json` with this structure:
```json
{
    "system_prompt": "Your character's personality and behavior description",
    "greeting": "Initial greeting message",
    "voice_style": "casual or formal",
    "personality_traits": ["trait1", "trait2", "trait3"],
    "interests": ["interest1", "interest2", "interest3"],
    "speech_patterns": ["pattern1", "pattern2", "pattern3"]
}
```

4. Add your character to `main.py`:
   - Add the character to the `CHARACTERS` dictionary
   - Add the character's greeting to the greetings section
   - Add voice configuration to `VOICE_CONFIGS`

5. Add the character to the dropdown in `static/index.html`:
```html
<select id="character">
    <!-- ... existing options ... -->
    <option value="new_character">New Character</option>
</select>
```

## Docker Configuration

The application uses two Docker containers:

1. **Main App Container**:
   - Runs the FastAPI backend
   - Serves the web interface
   - Handles OpenAI API communication
   - Port: 8000

2. **TTS Server Container**:
   - Runs the Chatterbox TTS server
   - Handles voice synthesis
   - Requires NVIDIA GPU
   - Port: 8001

### Customizing Docker Configuration

- Edit `Dockerfile.app` to modify the main application container
- Edit `docker-compose.yml` for local development
- Edit `docker-compose.prod.yml` for production deployment
- Edit `docker-compose.runpod.yml` for RunPod.io deployment

## Troubleshooting

1. **TTS Server Issues**:
   - Ensure NVIDIA drivers are installed
   - Check GPU availability: `nvidia-smi`
   - Verify CUDA installation

2. **Voice Recording Issues**:
   - Check microphone permissions in your browser
   - Ensure the microphone is properly connected
   - Try a different browser if issues persist

3. **Character Voice Issues**:
   - Ensure voice sample files are valid WAV files
   - Check file permissions
   - Verify voice configuration in `VOICE_CONFIGS`

4. **Deployment Issues**:
   - Check Docker Hub image availability
   - Verify environment variables are set correctly
   - Ensure GPU resources are available on RunPod

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

