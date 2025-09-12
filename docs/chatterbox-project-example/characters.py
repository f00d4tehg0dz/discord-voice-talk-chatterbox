import os
import json
from typing import Dict, Any

class Character:
    def __init__(self, name: str, prompts_file: str, biography_file: str):
        self.name = name
        self.prompts = self._load_prompts(prompts_file)
        self.biography = self._load_biography(biography_file)
        
    def _load_prompts(self, prompts_file: str) -> Dict[str, Any]:
        """Load character prompts from JSON file."""
        try:
            with open(prompts_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading prompts for {self.name}: {e}")
            return {}
            
    def _load_biography(self, biography_file: str) -> str:
        """Load character biography from text file."""
        try:
            with open(biography_file, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            print(f"Error loading biography for {self.name}: {e}")
            return ""
            
    def get_system_prompt(self) -> str:
        """Get the system prompt for the character."""
        return self.prompts.get('system_prompt', '')
        
    def get_greeting(self) -> str:
        """Get the character's greeting message."""
        return self.prompts.get('greeting', '')
        
    def get_farewell(self) -> str:
        """Get the character's farewell message."""
        return self.prompts.get('farewell', '')
        
    def get_error_response(self) -> str:
        """Get the character's error response."""
        return self.prompts.get('error_response', '')
        
    def get_thinking(self) -> str:
        """Get the character's thinking message."""
        return self.prompts.get('thinking', '')
        
    def get_voice_style(self) -> str:
        """Get the character's voice style."""
        return self.prompts.get('voice_style', '')
        
    def get_personality_traits(self) -> list:
        """Get the character's personality traits."""
        return self.prompts.get('personality_traits', [])
        
    def get_interests(self) -> list:
        """Get the character's interests."""
        return self.prompts.get('interests', [])
        
    def get_speech_patterns(self) -> list:
        """Get the character's speech patterns."""
        return self.prompts.get('speech_patterns', [])
        
    def get_biography(self) -> str:
        """Get the character's biography."""
        return self.biography

def load_character(name: str) -> Character:
    """Load a character by name."""
    base_path = os.path.join('characters', name.lower())
    prompts_file = os.path.join(base_path, 'prompts.json')
    biography_file = os.path.join(base_path, 'biography.txt')
    
    return Character(name, prompts_file, biography_file)

# Available characters
CHARACTERS = {
    'maya': load_character('maya'),
    'emma': load_character('emma'),
    'oddly': load_character('oddly'),
    'adrian': load_character('adrian'),
    'wizard': load_character('wizard'),
    'doanything': load_character('doanything')
}

def get_character(name: str) -> Character:
    """Get a character by name."""
    return CHARACTERS.get(name.lower())

# # Voice configurations for different TTS providers
# VOICE_CONFIGS = {
#     "kokoro": {
        
#         "maya": {
#             "voice_file": CHARACTERS["maya"].prompts.get("voice_file", ""),
#             "example_text": CHARACTERS["maya"].prompts.get("example_text", "")
#         },
#         "wizard": {
#             "voice_file": CHARACTERS["wizard"].prompts.get("voice_file", ""),
#             "example_text": CHARACTERS["wizard"].prompts.get("example_text", "")
#         }
#     }
# } 