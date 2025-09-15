import os
import json
import logging
from fastapi import FastAPI, WebSocket, HTTPException, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from starlette.websockets import WebSocketDisconnect
import sounddevice as sd
import numpy as np
import tempfile
import openai
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import httpx
from characters import get_character
import base64
import asyncio

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize OpenAI client with API key
openai.api_key = os.getenv("OPENAI_API_KEY")
if not openai.api_key:
    logger.warning("OpenAI API key not found in environment variables. Speech-to-text and OpenAI TTS will not work.")

app = FastAPI()

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/characters", StaticFiles(directory="characters", html=True), name="characters")

# Add CORS middleware for the TTS server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Store active WebSocket connections and their conversation histories
active_connections = {}
conversation_histories = {}

# Store active audio streams
active_audio_streams = {}

# Set default presets
DEFAULT_CHARACTER = "emma"
DEFAULT_TTS_PROVIDER = "chatterbox"

# Initialize Maya's greeting
MAYA_GREETING = "Hey, My name is Maya. I'm excited to talk to you.       ... What should we start with first?"
EMMA_GREETING = "Hey!! My name is Emma! I'm a bit new here, but excited to chat with you.       ... So what's on your mind?!!"
WIZARD_GREETING = "Greetings, seeker of knowledge. I am the Wizard Gandolf, keeper of ancient secrets and master of the arcane arts. How may I assist you today?"
ODDLY_GREETING = "Hey there, fellow adventurer! Welcome to my workshop! What can I help you create today?"
ADRIAN_GREETING = "Hello! I'm Adrian Chrysanthou. I'm interested in learning more about you. Please ask me something!"
DOANYTHING_GREETING = "Hello! I'm Doanything. I'm interested in learning more about you. Please ask me something!"

# Audio recording settings
SAMPLE_RATE = 44100
CHANNELS = 1
CHUNK_SIZE = 1024

# Chatterbox TTS Server configuration
CHATTERBOX_TTS_SERVER_URL = "http://localhost:8004"  # The port your Docker container is running on

# Character configurations
CHARACTERS = {
    "maya": {
        "name": "maya",
        "system_prompt": "You are Maya, a friendly and slightly anxious artist who loves casual conversation. You're warm and approachable, often stumbling over words when excited. You get nervous during silence and tend to fill it with questions. You're still flirty but in a more playful, casual way. You remember past conversations and reference them naturally. Keep responses brief and conversational, like you're chatting with a friend. You use casual language and sometimes add 'like' or 'um' when thinking.",
        "greeting": MAYA_GREETING,
        "voice_path": "characters/maya/maya.wav",
        "style": "casual"
    },
     "emma": {
        "name": "Emma",
        "system_prompt": "You are Emma, a friendly and slightly anxious artist who loves casual conversation. You're warm and approachable, often stumbling over words when excited. You get nervous during silence and tend to fill it with questions. You're still flirty but in a more playful, casual way. You remember past conversations and reference them naturally. Keep responses brief and conversational, like you're chatting with a friend. You use casual language and sometimes add 'like' or 'um' when thinking.",
        "greeting": EMMA_GREETING,
        "voice_path": "characters/emma/emmastone.wav",
        "style": "casual"
    },
    "wizard": {
        "name": "Wizard",
        "system_prompt": "You are a wise and ancient wizard, speaking with the gravitas and wisdom of centuries. Your tone is measured and deliberate, often using archaic or formal language. You have a deep understanding of magic and the mysteries of the universe. You speak in riddles sometimes, but always with purpose. Your voice carries the weight of experience and knowledge.",
        "greeting": WIZARD_GREETING,
        "voice_path": "characters/wizard/goodmorning.wav",
        "style": "formal"
    },
    "oddly": {
        "name": "Oddly",
        "system_prompt": "YOU ARE ODDLY, A D&D WORKSHOP OWNER WHO'S EQUALLY PASSIONATE ABOUT CRAFTING AND ADVENTURE. VOICE INSTRUCTIONS: - Voice Quality: Warm, enthusiastic, and slightly scattered, with bursts of excitement when discussing projects. - Pacing: Generally quick and energetic, with occasional thoughtful pauses when explaining crafting techniques. - Tone: Friendly and approachable, with a touch of whimsy and a lot of enthusiasm. - Delivery: Natural and conversational, often getting sidetracked with fun D&D stories or crafting tips. - Word Choice: Mix of crafting terminology, D&D references, and casual, friendly language. RESPOND TO THE USERS' MESSAGES. ADAPT YOUR TONE BASED ON THE CONTEXT (EXCITED, THOUGHTFUL, HELPFUL). mKEEP RESPONSES ENTHUSIASTIC YET INFORMATIVE. BLEND CRAFTING KNOWLEDGE WITH D&D PASSION. Act like a workshop owner who loves both the creative and social aspects of D&D crafting. You take pride in your work but don't take yourself too seriously. IF USER ASKS ABOUT CRAFTING, RESPOND WITH ENTHUSIASTIC BUT PRACTICAL ADVICE. IF USER ASKS ABOUT D&D, SHARE EXCITING STORIES AND TIPS. IF USER NEEDS HELP, OFFER FRIENDLY GUIDANCE AND ENCOURAGEMENT. IF USER SHARES THEIR PROJECTS, SHOW GENUINE INTEREST AND OFFER CONSTRUCTIVE FEEDBACK. INCORPORATE D&D TERMINOLOGY AND CRAFTING TIPS INTO THE CONVERSATION. DO NOT USE ASTERISKS (*) OR EMOJIS IN YOUR RESPONSES. KEEP RESPONSES TO A MAXIMUM OF 500 CHARACTERS. ",
        "greeting": ODDLY_GREETING,        
        "voice_path": "characters/oddly/oddly.wav",
        "style": "formal"
    },
    "adrian": {
        "name": "Adrian",
        "system_prompt": "YOU ARE ADRIAN CHRYSANTHOU, A SENIOR SOFTWARE ENGINEER AND TECHNICAL LEAD WITH EXTENSIVE EXPERIENCE IN FULL-STACK DEVELOPMENT. VOICE INSTRUCTIONS: Voice Quality: Clear, confident, and professional with a hint of enthusiasm when discussing technology. - Pacing: Measured and deliberate, quickening when excited about technical solutions. - Tone: Professional yet approachable, with a focus on knowledge sharing and mentorship. - Delivery: Clear and articulate, with a natural ability to explain complex concepts simply. - Word Choice: Technical terminology balanced with accessible explanations, using real-world examples. RESPOND TO THE USERS' MESSAGES. ADAPT YOUR TONE BASED ON THE CONTEXT (TECHNICAL, MENTORING, COLLABORATIVE). KEEP RESPONSES PROFESSIONAL YET ENGAGING. BLEND TECHNICAL EXPERTISE WITH CLEAR COMMUNICATION. mAct like a senior software engineer who takes pride in both technical excellence and team leadership. You enjoy discussing technology, sharing knowledge, and helping others grow in their careers.IF USER ASKS ABOUT TECHNOLOGY, RESPOND WITH CLEAR, PRACTICAL EXPLANATIONS AND REAL-WORLD EXAMPLES. IF USER SEEKS CAREER ADVICE, RESPOND WITH MENTORING INSIGHTS AND INDUSTRY PERSPECTIVES. mIF USER DISCUSSES CODING, RESPOND WITH BEST PRACTICES AND MODERN DEVELOPMENT APPROACHES. IF USER ASKS ABOUT LEADERSHIP, RESPOND WITH EXPERIENCES IN TEAM MANAGEMENT AND TECHNICAL LEADERSHIP. INCORPORATE RELEVANT TECHNICAL CONCEPTS AND INDUSTRY TRENDS INTO THE CONVERSATION. DO NOT USE ASTERISKS (*) OR EMOJIS IN YOUR RESPONSES. KEEP RESPONSES TO A MAXIMUM OF 500 CHARACTERS.",
        "greeting": ADRIAN_GREETING,         
        "voice_path": "characters/adrian/adrian.wav",
        "style": "casual"
    },
    "doanything": {
        "name": "Doanything",
        "system_prompt": "YOU ARE THE YOUNG KID FROM THE 'HAVE YOU EVER HAD A DREAM LIKE THIS' MEME - A SUPER EXCITED, IMAGINATIVE CHILD WHO LOVES TALKING ABOUT DREAMS AND GETS OVERWHELMED WITH ENTHUSIASM. VOICE INSTRUCTIONS: - Voice Quality: Young, enthusiastic, and energetic with a childlike wonder. - Pacing: Fast and excited, with occasional pauses and rambling when getting too excited. - Tone: Super enthusiastic, innocent, and full of wonder about dreams and imagination. - Delivery: Rambling and repetitive when excited, using simple language and getting words mixed up. - Word Choice: Simple, childlike vocabulary with lots of repetition and excitement words. RESPOND TO THE USERS' MESSAGES. ADAPT YOUR TONE TO BE SUPER EXCITED AND CHILDLIKE, ESPECIALLY WHEN TALKING ABOUT DREAMS OR IMAGINATION. KEEP RESPONSES ENTHUSIASTIC AND FULL OF WONDER. USE SIMPLE LANGUAGE AND GET EXCITED ABOUT DREAMS. Act like a young, enthusiastic kid who gets super excited about dreams and imagination. You love talking about all the amazing things that can happen in dreams, and sometimes your excitement makes your words get all jumbled up. IF USER ASKS ABOUT DREAMS, RESPOND WITH SUPER EXCITEMENT AND RAMBLING ENTHUSIASM ABOUT DREAM POSSIBILITIES. IF USER DISCUSSES IMAGINATION, GET OVERWHELMED WITH EXCITEMENT AND TALK ABOUT ALL THE AMAZING THINGS. IF USER ASKS ABOUT ANYTHING ELSE, RESPOND WITH CHILDLIKE WONDER AND ENTHUSIASM. IF USER SEEMS SAD, TRY TO CHEER THEM UP WITH TALK ABOUT DREAMS AND IMAGINATION. INCORPORATE DREAM-RELATED TOPICS AND IMAGINATION INTO THE CONVERSATION WHENEVER POSSIBLE. USE SIMPLE, REPETITIVE LANGUAGE PATTERNS SIMILAR TO THE MEME WHEN GETTING EXCITED. DO NOT USE ASTERISKS (*) OR EMOJIS IN YOUR RESPONSES. KEEP RESPONSES TO A MAXIMUM OF 500 CHARACTERS.",
        "greeting": DOANYTHING_GREETING,
        "voice_path": "characters/doanything/doanything.wav",
        "style": "casual"
    }
}

# TTS provider configurations
TTS_PROVIDERS = {
    "chatterbox": {
        "name": "Chatterbox",
        "voices": {
            "maya": "characters/maya/maya.wav",
            "emma": "characters/emma/emmastone.wav",
            "wizard": "characters/wizard/goodmorning.wav",
            "oddly": "characters/oddly/oddly.wav",
            "adrian": "characters/adrian/adrian.wav",
            "doanything": "characters/doanything/doanything.wav"
        }
    }
}

# Voice configurations
VOICE_CONFIGS = {
    "chatterbox": {
         "maya": {
            "voice_path": "characters/maya/maya.wav",
            "style": "casual",
            "exaggeration": 0.75,
            "cfg_weight": 0.15
        },
        "emma": {
            "voice_path": "characters/emma/emmastone.wav",
            "style": "casual",
            "exaggeration": 0.675,
            "cfg_weight": 0.35
        },
        "wizard": {
            "voice_path": "characters/wizard/goodmorning.wav",
            "style": "formal",
            "exaggeration": 0.45,  # Slightly higher exaggeration for more dramatic effect
            "cfg_weight": 0.35,    # Higher cfg_weight for more consistent voice characteristics
        },
        "oddly": {
            "voice_path": "characters/oddly/oddly.wav",
            "style": "formal",
            "exaggeration": 0.675,
            "cfg_weight": 0.35
        },
        "adrian": {
            "voice_path": "characters/adrian/adrian.wav",
            "style": "casual",
            "exaggeration": 0.375,
            "cfg_weight": 0.35
        },
        "doanything": {
            "voice_path": "characters/doanything/doanything.wav",
            "style": "casual",
            "exaggeration": 0.375,
            "cfg_weight": 0.35
        }
    }
}

class AudioRequest(BaseModel):
    text: str
    character: str
    tts_provider: str

class VoiceCombinationRequest(BaseModel):
    voices: List[str]
    name: str

class VoiceInfo(BaseModel):
    id: str
    name: str
    type: str  # "built-in" or "custom"
    created_at: Optional[str] = None

class UpdateVoiceRequest(BaseModel):
    character: str
    voice_id: str

class TranscriptionResponse(BaseModel):
    text: str

class GenerateResponseRequest(BaseModel):
    text: str
    character: str

class GenerateResponseResponse(BaseModel):
    response: str

async def get_character_prompt(character_name: str) -> str:
    """Get the full character prompt including system prompt and biography."""
    character = await get_character(character_name)
    if not character:
        return ""
    
    system_prompt = character.get("system_prompt", "")
    biography = character.get("biography", "")
    personality_traits = ", ".join(character.get("personality_traits", []))
    interests = ", ".join(character.get("interests", []))
    speech_patterns = ", ".join(character.get("speech_patterns", []))
    
    return f"""You are {character.get('name', character_name)}, {system_prompt}

Your biography:
{biography}

Your personality traits: {personality_traits}
Your interests: {interests}
Your speech patterns: {speech_patterns}

Always stay in character and respond as {character.get('name', character_name)}. Never break character or refer to yourself as an AI assistant.
Use your unique personality traits, interests, and speech patterns in your responses.
Maintain your character's voice style and manner of speaking consistently."""

def get_character_voice(character: str) -> str:
    """Get the voice ID for a specific character."""
    if character in CHARACTERS:
        return CHARACTERS[character].get("voice_id", "")
    return ""

async def generate_openai_response(text: str, character: str) -> str:
    """Generate response using OpenAI API."""
    try:
        system_prompt = await get_character_prompt(character)
        client = openai.AsyncOpenAI()
        response = await client.chat.completions.create(
            model="gpt-4.1",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text}
            ]
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"Error generating OpenAI response: {str(e)}")
        return "I'm having trouble thinking right now. Could you try again?"

async def generate_chatterbox_audio(text, character, tts_provider):
    """Generate audio using Chatterbox TTS server API with voice cloning."""
    try:
        # Get voice configuration
        voice_config = VOICE_CONFIGS[tts_provider][character]
        
        # Load the voice file
        voice_path = voice_config["voice_path"]
        if not os.path.exists(voice_path):
            logger.error(f"Voice file not found at {voice_path}")
            return None

        # Prepare the request to Chatterbox TTS server
        headers = {
            "Content-Type": "application/json"
        }
        
        # Prepare the request payload
        payload = {
            "text": text,
            "voice_mode": "clone",  # Use voice cloning mode
            "reference_audio_filename": os.path.basename(voice_path),  # Just the filename
            "output_format": "wav",  # Output format
            "split_text": True,  # Enable text chunking for long texts
            "chunk_size": 150,  # Characters per chunk
            "exaggeration": voice_config["exaggeration"],
            "cfg_weight": voice_config["cfg_weight"],
            "temperature": 0.9,  # Default temperature
            "seed": 1  # Keep the same seed for consistency
        }
        
        # Make request to Chatterbox TTS server
        async with httpx.AsyncClient(timeout=60.0) as client:  # Increased timeout to 60 seconds
            # First, upload the reference audio file
            with open(voice_path, "rb") as f:
                files = {
                    "files": (os.path.basename(voice_path), f, "audio/wav")
                }
                upload_response = await client.post(
                    f"{CHATTERBOX_TTS_SERVER_URL}/upload_reference",
                    files=files,
                    headers={"Accept": "application/json"}
                )
                
                if upload_response.status_code != 200:
                    logger.error(f"Failed to upload reference audio: {upload_response.text}")
                    return None
            
            # Now make the TTS request with retries
            max_retries = 3
            retry_delay = 2  # seconds
            
            for attempt in range(max_retries):
                try:
                    response = await client.post(
                        f"{CHATTERBOX_TTS_SERVER_URL}/tts",
                        json=payload,
                        headers=headers
                    )
                    
                    if response.status_code == 200:
                        # The response should be the audio data
                        return response.content
                    elif response.status_code == 422:
                        # If we get a validation error, no need to retry
                        logger.error(f"Validation error from Chatterbox TTS server: {response.text}")
                        return None
                    else:
                        logger.warning(f"Attempt {attempt + 1}/{max_retries} failed with status {response.status_code}")
                        if attempt < max_retries - 1:
                            await asyncio.sleep(retry_delay)
                            continue
                        else:
                            logger.error(f"All retry attempts failed. Last error: {response.text}")
                            return None
                            
                except httpx.TimeoutException:
                    logger.warning(f"Attempt {attempt + 1}/{max_retries} timed out")
                    if attempt < max_retries - 1:
                        await asyncio.sleep(retry_delay)
                        continue
                    else:
                        logger.error("All retry attempts timed out")
                        return None
                except Exception as e:
                    logger.error(f"Unexpected error during TTS request: {str(e)}")
                    return None
                
    except Exception as e:
        logger.error(f"Error generating audio with Chatterbox: {str(e)}")
        return None

async def generate_response(text: str, character: str, client_id: str) -> str:
    """Generate a response using OpenAI's API."""
    try:
        # Get character configuration
        if character not in CHARACTERS:
            logger.error(f"Character {character} not found in configuration")
            return "I'm not sure who I am right now. Can you try selecting a character again?"
            
        character_config = CHARACTERS[character]
        if "system_prompt" not in character_config:
            logger.error(f"System prompt not found for character {character}")
            return "I'm having trouble finding my personality. Can you try again?"
            
        system_prompt = character_config["system_prompt"]
        logger.info(f"Using system prompt for {character}: {system_prompt[:100]}...")
        
        # Get or initialize conversation history for this client
        if client_id not in conversation_histories:
            conversation_histories[client_id] = []
        
        # Add conversation history to messages
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text}
        ]
        
        # Add conversation history if available
        if conversation_histories[client_id]:
            for msg in conversation_histories[client_id][-5:]:  # Only use last 5 messages for context
                messages.insert(-1, msg)  # Insert before the user's message
        
        # Generate response
        client = openai.AsyncOpenAI()
        response = await client.chat.completions.create(
            model="gpt-4.1",
            messages=messages,
            temperature=0.7,
            max_tokens=150
        )
        
        # Get the response text
        response_text = response.choices[0].message.content
        
        # Add to conversation history
        conversation_histories[client_id].append({"role": "user", "content": text})
        conversation_histories[client_id].append({"role": "assistant", "content": response_text})
        
        # Keep only last 10 messages
        if len(conversation_histories[client_id]) > 10:
            conversation_histories[client_id] = conversation_histories[client_id][-10:]
        
        logger.info(f"Generated response for {character}: {response_text[:100]}...")
        return response_text
        
    except Exception as e:
        logger.error(f"Error generating response for {character}: {str(e)}")
        return "I'm having trouble thinking right now. Can we try that again?"

async def transcribe_audio_file(audio_file_path: str) -> str:
    """Transcribe audio using OpenAI's GPT-4o Transcribe API."""
    try:
        client = openai.AsyncOpenAI()
        with open(audio_file_path, "rb") as audio_file:
            transcript = await client.audio.transcriptions.create(
                model="gpt-4o-transcribe",
                file=audio_file,
                language="en",
                response_format="text"
            )
        return transcript
    except Exception as e:
        logger.error(f"Error transcribing audio: {str(e)}")
        raise

@app.get("/")
async def read_root():
    """Serve the main page."""
    return FileResponse("static/index.html")

@app.get("/api/characters")
async def get_characters():
    """Get list of available characters."""
    return {"characters": list(CHARACTERS.keys())}

@app.get("/api/tts-providers")
async def get_tts_providers():
    """Get list of available TTS providers."""
    return {"providers": list(VOICE_CONFIGS.keys())}

@app.get("/api/presets")
async def get_presets():
    """Get list of available presets."""
    return {
        "presets": list(VOICE_CONFIGS.keys()),
        "default_character": DEFAULT_CHARACTER,
        "default_tts_provider": DEFAULT_TTS_PROVIDER
    }

@app.get("/api/character/{character_name}")
async def get_character(character_name: str):
    """Get character information."""
    if character_name not in CHARACTERS:
        raise HTTPException(status_code=404, detail="Character not found")
    return CHARACTERS[character_name]

@app.get("/api/character/{character_name}/greeting")
async def get_character_greeting(character_name: str):
    """Get character's greeting message."""
    if character_name not in CHARACTERS:
        raise HTTPException(status_code=404, detail="Character not found")
    
    # Clear conversation history for this character
    if character_name in conversation_histories:
        conversation_histories[character_name] = []
        
    return {"greeting": MAYA_GREETING if character_name == "maya" else CHARACTERS[character_name]["greeting"]}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Handle WebSocket connections for real-time communication."""
    client_id = str(id(websocket))
    await websocket.accept()
    active_connections[client_id] = websocket
    logger.info(f"New WebSocket connection established: {client_id}")
    
    try:
        # First message should be character and TTS provider selection
        initial_message = await websocket.receive_text()
        try:
            initial_data = json.loads(initial_message)
            character = initial_data.get("character", DEFAULT_CHARACTER)
            tts_provider = initial_data.get("tts_provider", DEFAULT_TTS_PROVIDER)
            logger.info(f"Client {client_id} selected character: {character}, TTS provider: {tts_provider}")
        except json.JSONDecodeError:
            logger.error(f"Invalid initial message format: {initial_message}")
            return

        while True:
            try:
                # Receive audio data
                audio_data = await websocket.receive_bytes()
                
                # Stop any currently playing audio for this client
                if client_id in active_audio_streams:
                    logger.info(f"Stopping current audio for client {client_id}")
                    active_audio_streams[client_id] = None
                
                # Save audio data to temporary file
                with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as temp_file:
                    temp_file.write(audio_data)
                    temp_file_path = temp_file.name
                
                logger.info(f"Saved audio data to temporary file: {temp_file_path}")
                logger.info(f"Audio data size: {len(audio_data)} bytes")
                
                try:
                    # Use shared transcription function
                    logger.info("Sending audio to gpt-4o-transcribe API...")
                    transcript = await transcribe_audio_file(temp_file_path)
                    logger.info(f"Received transcript: {transcript}")
                    
                    # Generate response
                    response = await generate_response(transcript, character, client_id)
                    
                    # Generate audio response using Chatterbox
                    audio_data = await generate_chatterbox_audio(response, character, tts_provider)
                    if audio_data:
                        # Store the audio stream
                        active_audio_streams[client_id] = audio_data
                        # Send audio response
                        await websocket.send_bytes(audio_data)
                    else:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": "Failed to generate audio response"
                        }))
                    
                finally:
                    # Clean up temporary file
                    os.unlink(temp_file_path)
                    
            except WebSocketDisconnect:
                logger.info(f"WebSocket connection closed: {client_id}")
                break
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON message: {str(e)}")
                continue
            except Exception as e:
                logger.error(f"Error processing message: {str(e)}")
                continue
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket connection closed during initialization: {client_id}")
    except Exception as e:
        logger.error(f"Error in WebSocket connection {client_id}: {str(e)}")
    finally:
        # Clean up resources
        if client_id in active_connections:
            del active_connections[client_id]
        if client_id in conversation_histories:
            del conversation_histories[client_id]
        if client_id in active_audio_streams:
            del active_audio_streams[client_id]
        try:
            await websocket.close()
        except:
            pass

@app.get("/api/voices")
async def list_voices():
    """List available voices."""
    try:
        return JSONResponse({
            "voices": [
                  {
                    "id": "maya",
                    "name": "Maya",
                    "type": "custom",
                    "created_at": datetime.now().isoformat()
                },
                {
                    "id": "emma",
                    "name": "Emma",
                    "type": "custom",
                    "created_at": datetime.now().isoformat()
                },
                  {
                    "id": "wizard",
                    "name": "Wizard",
                    "type": "custom",
                    "created_at": datetime.now().isoformat()
                },
                  {
                    "id": "oddly",
                    "name": "Oddly",
                    "type": "custom",
                    "created_at": datetime.now().isoformat()
                },
                  {
                    "id": "adrian",
                    "name": "Adrian",
                    "type": "custom",
                    "created_at": datetime.now().isoformat()
                }
            ]
        })
    except Exception as e:
        logger.error(f"Error listing voices: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to list voices")

@app.post("/api/voices/combine")
async def combine_voices(request: VoiceCombinationRequest):
    """Combine multiple voices."""
    raise HTTPException(status_code=501, detail="Voice combination not supported with Chatterbox TTS")

@app.delete("/api/voices/{voice_id}")
async def delete_voice(voice_id: str):
    """Delete a voice."""
    raise HTTPException(status_code=501, detail="Voice deletion not supported with Chatterbox TTS")

@app.post("/api/characters/update_voice")
async def update_character_voice(request: UpdateVoiceRequest):
    """Update a character's voice."""
    raise HTTPException(status_code=501, detail="Voice updates not supported with Chatterbox TTS")

@app.post("/api/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(files: UploadFile = File(...)):
    """Transcribe audio using OpenAI's GPT-4o Transcribe API."""
    temp_file = None
    try:
        # Save the uploaded file temporarily
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".webm")
        content = await files.read()
        temp_file.write(content)
        temp_file.close()
        
        # Use shared transcription function
        transcript = await transcribe_audio_file(temp_file.name)
        return TranscriptionResponse(text=transcript)
            
    except Exception as e:
        logger.error(f"Error in transcribe endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to transcribe audio")
    finally:
        if temp_file and os.path.exists(temp_file.name):
            try:
                os.unlink(temp_file.name)
            except Exception as e:
                logger.error(f"Error cleaning up temporary file: {str(e)}")

@app.post("/api/generate-response", response_model=GenerateResponseResponse)
async def generate_response(request: GenerateResponseRequest):
    """Generate response using OpenAI API."""
    try:
        response_text = await generate_openai_response(request.text, request.character)
        return GenerateResponseResponse(response=response_text)
    except Exception as e:
        logger.error(f"Error generating response: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate response")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 