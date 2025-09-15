import OpenAI from 'openai';
import { config } from './config.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache for loaded character files
const characterCache = new Map();

const openai = new OpenAI({
    apiKey: config.openai.apiKey,
});

// Store conversation context per guild/user
const conversationContext = new Map();

// Store guild character selections
const guildCharacters = new Map();

/**
 * Generate response using ChatGPT with character personality
 */
export async function generateResponse(message, characterName = null, guildId, userId, username) {
    try {
        console.log(`[CHATGPT] Generating response for user ${username} (${userId}) in guild ${guildId}`);
        console.log(`[CHATGPT] Character: ${characterName || config.bot.defaultCharacter}`);
        console.log(`[CHATGPT] Message: "${message}"`);
        
        // Get character configuration
        const character = getCharacterConfig(characterName);
        if (!character) {
            throw new Error(`Character "${characterName}" not found`);
        }
        
        // Get or create conversation context
        const contextKey = `${guildId}_${character.name}`;
        let context = conversationContext.get(contextKey);
        
        if (!context) {
            // Build enhanced system prompt with character details
            let systemPrompt = character.system_prompt;
            
            // Add personality traits if available
            if (character.personality_traits && character.personality_traits.length > 0) {
                systemPrompt += ` Your personality traits include: ${character.personality_traits.join(', ')}.`;
            }
            
            // Add interests if available
            if (character.interests && character.interests.length > 0) {
                systemPrompt += ` Your interests include: ${character.interests.join(', ')}.`;
            }
            
            // Add speech patterns if available
            if (character.speech_patterns && character.speech_patterns.length > 0) {
                systemPrompt += ` Your speech patterns: ${character.speech_patterns.join(', ')}.`;
            }
            
            context = {
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt
                    }
                ],
                lastActivity: new Date(),
                participants: new Set(),
                character: character, // Store full character data
            };
            conversationContext.set(contextKey, context);
        }
        
        // Add user to participants
        context.participants.add(username);
        context.lastActivity = new Date();
        
        // Add user message to context
        context.messages.push({
            role: 'user',
            content: `${username}: ${message}`,
        });
        
        // Keep conversation context manageable (last 20 messages + system prompt)
        if (context.messages.length > 21) {
            context.messages = [
                context.messages[0], // Keep system prompt
                ...context.messages.slice(-20) // Keep last 20 messages
            ];
        }

        // Add a temporary system message to remind the AI of the current user's name
        const tempSystemMessage = {
            role: 'system',
            content: `The user you are currently responding to is named "${username}". When addressing or referring to them directly, use this name.`
        };

        // Create messages array for this specific response (includes temporary context)
        const messagesForGeneration = [...context.messages, tempSystemMessage];

        // Generate response
        const completion = await openai.chat.completions.create({
            model: config.openai.model,
            messages: messagesForGeneration,
            max_tokens: 300, // Increased to allow for longer, more natural responses
            temperature: 0.7,
            frequency_penalty: 0.5,
            presence_penalty: 0.3,
        });
        
        const response = completion.choices[0]?.message?.content?.trim();
        
        if (!response) {
            throw new Error('Empty response from ChatGPT');
        }
        
        // Add assistant response to context
        context.messages.push({
            role: 'assistant',
            content: response,
        });
        
        console.log(`[CHATGPT] Generated response: "${response}"`);
        
        return {
            text: response,
            character: character.name,
            voiceConfig: character.voice_config,
            timestamp: new Date(),
        };
        
    } catch (error) {
        console.error(`[CHATGPT] Failed to generate response:`, error);
        
        // Return fallback response
        const character = getCharacterConfig(characterName);
        return {
            text: "I'm having trouble thinking right now. Could you say that again?",
            character: character?.name || config.bot.defaultCharacter,
            voiceConfig: character?.voice_config || config.characters[config.bot.defaultCharacter]?.voice_config,
            timestamp: new Date(),
            error: true,
        };
    }
}

/**
 * Load character from individual character file
 */
function loadCharacterFile(characterName) {
    if (characterCache.has(characterName)) {
        return characterCache.get(characterName);
    }
    
    try {
        const charactersDir = join(__dirname, '..', '..', 'characters');
        const characterFile = join(charactersDir, characterName, `${characterName}.json`);
        
        console.log(`[CHATGPT] Loading character file: ${characterFile}`);
        const characterData = JSON.parse(readFileSync(characterFile, 'utf8'));
        
        // Cache the loaded character
        characterCache.set(characterName, characterData);
        
        console.log(`[CHATGPT] Loaded enhanced character data for ${characterName}`);
        return characterData;
        
    } catch (error) {
        console.warn(`[CHATGPT] Failed to load character file for ${characterName}:`, error.message);
        return null;
    }
}

/**
 * Get character configuration (enhanced version)
 */
export function getCharacterConfig(characterName) {
    const name = characterName || config.bot.defaultCharacter;
    
    // First try to load from individual character file
    let character = loadCharacterFile(name);
    
    // Fallback to config.characters
    if (!character) {
        character = config.characters[name];
    }
    
    if (!character) {
        console.warn(`[CHATGPT] Character "${name}" not found, using default`);
        character = loadCharacterFile(config.bot.defaultCharacter) || config.characters[config.bot.defaultCharacter];
    }
    
    return character;
}

/**
 * Set character for a guild
 */
export function setGuildCharacter(guildId, characterName) {
    if (!config.characters[characterName]) {
        throw new Error(`Character "${characterName}" not found`);
    }
    
    // Store guild character selection
    guildCharacters.set(guildId, characterName);
    
    // Clear existing context to switch characters
    const oldContextKey = findContextKeyForGuild(guildId);
    if (oldContextKey) {
        conversationContext.delete(oldContextKey);
    }
    
    console.log(`[CHATGPT] Set character "${characterName}" for guild ${guildId}`);
    return characterName;
}

/**
 * Get current character for a guild
 */
export function getGuildCharacter(guildId) {
    // First check if we have a stored guild character selection
    if (guildCharacters.has(guildId)) {
        return guildCharacters.get(guildId);
    }
    
    // Fallback to context-based lookup (for backwards compatibility)
    const contextKey = findContextKeyForGuild(guildId);
    if (contextKey) {
        const characterName = contextKey.split('_').slice(1).join('_'); // Remove guildId prefix
        return characterName;
    }
    
    return config.bot.defaultCharacter;
}

/**
 * Add context message (useful for adding transcriptions from multiple users)
 */
export function addContextMessage(guildId, username, message, characterName = null) {
    const character = getCharacterConfig(characterName);
    const contextKey = `${guildId}_${character.name}`;
    let context = conversationContext.get(contextKey);
    
    if (!context) {
        context = {
            messages: [
                {
                    role: 'system',
                    content: character.system_prompt
                }
            ],
            lastActivity: new Date(),
            participants: new Set(),
        };
        conversationContext.set(contextKey, context);
    }
    
    context.participants.add(username);
    context.lastActivity = new Date();
    
    // Add message without generating response
    context.messages.push({
        role: 'user',
        content: `${username}: ${message}`,
    });
    
    // Keep context manageable
    if (context.messages.length > 21) {
        context.messages = [
            context.messages[0],
            ...context.messages.slice(-20)
        ];
    }
}

/**
 * Clear conversation context for a guild
 */
export function clearGuildContext(guildId) {
    const contextKey = findContextKeyForGuild(guildId);
    if (contextKey) {
        conversationContext.delete(contextKey);
        console.log(`[CHATGPT] Cleared context for guild ${guildId}`);
        return true;
    }
    return false;
}

/**
 * Get conversation summary for a guild
 */
export function getConversationSummary(guildId) {
    const contextKey = findContextKeyForGuild(guildId);
    if (!contextKey) {
        return null;
    }
    
    const context = conversationContext.get(contextKey);
    if (!context) {
        return null;
    }
    
    return {
        character: contextKey.split('_').slice(1).join('_'),
        messageCount: context.messages.length - 1, // Exclude system prompt
        participants: Array.from(context.participants),
        lastActivity: context.lastActivity,
    };
}

/**
 * Helper function to find context key for a guild
 */
function findContextKeyForGuild(guildId) {
    for (const key of conversationContext.keys()) {
        if (key.startsWith(`${guildId}_`)) {
            return key;
        }
    }
    return null;
}

/**
 * Clean up old conversations (run periodically)
 */
export function cleanupOldContexts(maxAgeHours = 24) {
    const now = new Date();
    const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds
    
    let cleanedCount = 0;
    
    for (const [key, context] of conversationContext.entries()) {
        if (now - context.lastActivity > maxAge) {
            conversationContext.delete(key);
            cleanedCount++;
        }
    }
    
    if (cleanedCount > 0) {
        console.log(`[CHATGPT] Cleaned up ${cleanedCount} old conversation contexts`);
    }
    
    return cleanedCount;
}

/**
 * List available characters
 */
export function getAvailableCharacters() {
    return Object.keys(config.characters).map(name => ({
        name,
        displayName: config.characters[name].name,
        greeting: config.characters[name].greeting,
    }));
}