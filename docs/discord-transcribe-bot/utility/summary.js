import { formatTime, formatMessageContent, timeSince } from './formatting.js';
import { connectDB } from './database.js';
import { Summary } from '../models/Summary.js';
import { Campaign } from '../models/Campaign.js';
import { SessionState } from '../models/SessionState.js';
import { ServerConfig } from '../models/ServerConfig.js';
import { getServerModels } from './serverDatabase.js';
import crypto from 'crypto';
import { client } from '../index.js';
import mongoose from 'mongoose';
    
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is not set');
}

// Ensure the key is the correct length (32 bytes for AES-256)
const validateKey = (key) => {
  const keyBuffer = Buffer.from(key, 'base64');
//   if (keyBuffer.length !== 32) {
//     throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
//   }
  return keyBuffer;
};

// Function to get a Discord username from user ID
async function getUsernameFromDiscord(userId) {
  try {
    // First, check if we can find the user in cache
    let user = client.users.cache.get(userId);
    
    // If not in cache, try to fetch from API
    if (!user) {
      try {
        user = await client.users.fetch(userId, { force: true });
      } catch (fetchError) {
        console.error(`Error fetching user details for ${userId}:`, fetchError);
        return null;
      }
    }
    
    if (user) {
      return user.username;
    }
    
    return null;
  } catch (error) {
    console.error(`Error getting username for ${userId}:`, error);
    return null;
  }
}

const encrypt = (text) => {
  try {
    const keyBuffer = validateKey(ENCRYPTION_KEY);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();
    return {
      iv: iv.toString('base64'),
      encryptedData: encrypted,
      authTag: authTag.toString('base64')
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt summary: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
};

// Player name mappings
const PLAYER_NAME_MAPPINGS = {
    'Risen': 'Rhysand',
    'Alphen': 'Elfin',
    'Ilmari': 'Illmuri',
    'Smokey': 'Smokey',
    'Ozzy': 'Ozzy',
    'DM': 'DM',
    'Ryzen': 'Rhysand'
};

// Phrases to remove from summaries
const UNWANTED_PHRASES = [
    'Thank you for listening!',
    'Thank you for watching!',
    'Thank you for watching! 🙂',
    'Use emojis to indicate the tone of the dialogue, but only when appropriate, but only when they enhance the emotional context or action. Thank you for watching!',
    '🙏🏼',
    'Use the following format for the transcription, but only when appropriate.',
    'Use the following format for the transcription, but only when appropriate, but only when appropriate.',
    'This is a Dungeons & Dragons session with fantasy terms, character names, and role-playing game terminology. Use the following format for the transcription.',
    'Use emojis to indicate the tone of the dialogue, but only when appropriate.',
    'Use emojis to indicate the tone of the dialogue, but only when appropriate, but not when they enhance the emotional context or action.',
    'Session Summary:',
    'Participants:',
    'Summary:',
    'Thank you for listening!',
    'Thank you for watching!',
    'Thank you for watching! 🙂',
    'Use emojis to indicate the tone of the dialogue, but only when appropriate, but only when they enhance the emotional context or action. Thank you for watching!',
    '🙏🏼',
    'Use the following format for the transcription, but only when appropriate.',
    'Use the following format for the transcription, but only when appropriate, but only when appropriate.',
    'Use emojis to indicate the tone of the dialogue, but only when appropriate.',
    'Use emojis to indicate the tone of the dialogue, but only when appropriate, but not when they enhance the emotional context or action.',
    'Session Summary:',
    'Participants:',
    'Summary:',
    'Cliff Notes:',
    '[Lorelei (LUNA)]:',
    'context',
    '(DISCORD USERNAME):',
    '[Aris (DISCORD USERNAME)]:',
    'Please reattach the audio file',
    '[Character Name (DISCORD USERNAME)]:',
    '[Luna (MoonlitMystic)]:',
    '[Character Name]:',
    '[Template (DISCORD USERNAME)]:',
    '[Arthur (DISCORD USERNAME)]:',
    '[Liam (DISCORD USERNAME)]:',
    '[Adventurer (USERNAME):',
    '[[Sorcerer (DISCORD USERNAME)]:',
    '[Sir Gareth (DISCORD USERNAME)]:',
    '[Player 1 (DISCORD USERNAME)]:',
    '[Zarix (DISCORD USERNAME)]:',
    '[Athena (DISCORD USERNAME)]:',
    '[DM (DISCORD USERNAME)]:',
    '[Character Name (DISCORD USERNAME)]: [Dialogue].'
];

function cleanSummaryText(text) {
    if (!text) return '';
    let cleanedText = text;
    
    // Remove unwanted phrases
    UNWANTED_PHRASES.forEach(phrase => {
        cleanedText = cleanedText.replace(new RegExp(phrase, 'gi'), '').trim();
    });
    
    // Replace player names
    Object.entries(PLAYER_NAME_MAPPINGS).forEach(([incorrect, correct]) => {
        const regex = new RegExp(`\\b${incorrect}\\b`, 'gi');
        cleanedText = cleanedText.replace(regex, correct);
    });
    
    // Remove multiple consecutive newlines
    cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n');
    
    // Remove leading/trailing whitespace
    cleanedText = cleanedText.trim();
    
    return cleanedText;
}

/**
 * Generates a comprehensive summary from the active recordings and users
 * @param {Map} activeRecordings - Map of active recordings
 * @param {Object} users - Object containing user information
 * @param {string} guildId - The guild ID
 * @param {Date} [fromTime=null] - Optional start time for filtering messages
 * @param {Object} [campaign=null] - Optional campaign object
 * @returns {Object} Summary object containing text and metadata
 */
export async function generateSummary(activeRecordings, users, guildId, fromTime = null, campaign = null) {
    try {
        // Validate inputs
        if (!activeRecordings || !users || !guildId) {
            console.error('Missing required parameters for generateSummary');
            return { text: '', cliffNotes: '' };
        }

        const recordingState = activeRecordings.get(guildId);
        if (!recordingState) {
            console.error('No recording state found for guild:', guildId);
            return { text: '', cliffNotes: '' };
        }

        // Get server-specific models
        const { Summary, Campaign } = await getServerModels(guildId);
        
        // Initialize transcriptions variable
        let transcriptions = recordingState.transcriptions || {};
        
        // Add retry mechanism for checking transcriptions
        let retries = 3;
        let hasTranscriptions = false;
        
        while (retries > 0) {
            hasTranscriptions = Object.values(transcriptions).some(userTranscriptions => 
                Array.isArray(userTranscriptions) && userTranscriptions.length > 0
            );
            
            if (hasTranscriptions) {
                break;
            }
            
            console.log(`No transcriptions found yet, retrying in 2 seconds... (${retries} attempts remaining)`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            retries--;
            
            // Update transcriptions after delay
            transcriptions = recordingState.transcriptions || {};
        }
        
        if (!hasTranscriptions) {
            console.log('No transcriptions found after retries for guild:', guildId);
            return { text: '', cliffNotes: '' };
        }

        // Get campaign ID from the recording state or provided campaign
        let campaignId = campaign?._id || recordingState.campaignId;
        if (!campaignId) {
            // Validate required fields
            if (!recordingState.campaignName) {
                console.error('Campaign name is required but not found in recording state');
                return { text: '', cliffNotes: '' };
            }
            if (!recordingState.dmUserId) {
                console.error('DM user ID is required but not found in recording state');
                return { text: '', cliffNotes: '' };
            }

            // Try to find an existing campaign
            const existingCampaign = await Campaign.findOne({
                guildId: guildId,
                name: recordingState.campaignName
            });
            
            if (existingCampaign) {
                campaignId = existingCampaign._id;
            } else {
                // Create a new campaign if none exists
                const newCampaign = new Campaign({
                    guildId: guildId,
                    name: recordingState.campaignName,
                    dmUserId: recordingState.dmUserId
                });
                await newCampaign.save();
                campaignId = newCampaign._id;
            }
        }

        // Get campaign name for display purposes
        const campaignName = campaign?.name || recordingState.campaignName || 'Unnamed Campaign';

        // Validate session times
        const sessionStart = recordingState.sessionStart;
        const sessionEnd = new Date();
        if (!sessionStart || isNaN(sessionStart.getTime())) {
            throw new Error('Invalid session start time');
        }
        if (sessionEnd < sessionStart) {
            throw new Error('Session end time is before start time');
        }

        // Process transcriptions in chunks to avoid memory issues
        const CHUNK_SIZE = 1000;
        const allTranscriptionsSorted = [];
        
        // Sort transcriptions by user first to maintain conversation context
        Object.entries(transcriptions).forEach(([userId, userTranscriptions]) => {
            if (Array.isArray(userTranscriptions)) {
                // Sort user's transcriptions by timestamp
                userTranscriptions.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
                
                // Process in chunks
                for (let i = 0; i < userTranscriptions.length; i += CHUNK_SIZE) {
                    const chunk = userTranscriptions.slice(i, i + CHUNK_SIZE);
                    chunk.forEach(t => {
                        if (t && t.text && t.timestamp) {
                            // Clean the text before processing
                            let sanitizedText = cleanSummaryText(t.text);
                            if (sanitizedText.length > 0) {
                                allTranscriptionsSorted.push({
                                    userId,
                                    text: sanitizedText,
                                    timestamp: t.timestamp
                                });
                            }
                        }
                    });
                }
            }
        });

        // Sort all transcriptions chronologically
        allTranscriptionsSorted.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        console.log('Sorted transcriptions:', allTranscriptionsSorted);

        // Generate summary text
        const summaryLines = [];
        let currentSpeaker = null;
        let currentMessages = [];
        let lastTimestamp = null;
        let messageCount = 0;

        // Add campaign name as the first line
        summaryLines.push(`# ${campaignName}\n`);
        console.log('Added campaign name:', campaignName);

        // Create a sanitized user map to avoid undefined issues
        const userMap = {};
        Object.entries(users).forEach(([id, name]) => {
            if (id && name) {
                userMap[id] = name;
            }
        });
        
        console.log('User map:', userMap);
        console.log('DM User ID:', recordingState.dmUserId);

        for (const t of allTranscriptionsSorted) {
            console.log('Processing transcription:', t);
            // Try to get username from the Discord API if not in userMap
            let userName = userMap[t.userId];
            if (!userName) {
                const discordUserName = await getUsernameFromDiscord(t.userId);
                if (discordUserName) {
                    userName = discordUserName;
                    // Add to userMap for future reference
                    userMap[t.userId] = discordUserName;
                } else {
                    // Only use fallback if Discord API also fails
                    userName = `User-${t.userId.substring(0, 6)}`;
                }
            }
            
            const formattedTime = formatTime(t.timestamp);
            
            if (currentSpeaker !== t.userId || 
                (lastTimestamp && (t.timestamp.getTime() - lastTimestamp.getTime()) > 120000)) {
                
                if (currentMessages.length > 0) {
                    const formattedContent = formatMessageContent(currentMessages);
                    // Get speaker name with advanced fallback
                    let speakerName = userMap[currentSpeaker];
                    if (!speakerName) {
                        const discordUserName = await getUsernameFromDiscord(currentSpeaker);
                        if (discordUserName) {
                            speakerName = discordUserName;
                            // Cache for future use
                            userMap[currentSpeaker] = discordUserName;
                        } else {
                            speakerName = `User-${currentSpeaker.substring(0, 6)}`;
                        }
                    }
                    
                    const speakerLabel = currentSpeaker === recordingState.dmUserId ? 
                        `**${speakerName} (DM)**` : 
                        `**${speakerName}**`;
                    summaryLines.push(`${speakerLabel} (${formatTime(currentMessages[0].timestamp)}):\n${formattedContent}`);
                    messageCount++;
                }
                
                currentSpeaker = t.userId;
                currentMessages = [{text: t.text, timestamp: t.timestamp}];
            } else {
                currentMessages.push({text: t.text, timestamp: t.timestamp});
            }
            
            lastTimestamp = t.timestamp;
        }

        // Handle last speaker
        if (currentMessages.length > 0) {
            const formattedContent = formatMessageContent(currentMessages);
            // Get speaker name with advanced fallback
            let speakerName = userMap[currentSpeaker];
            if (!speakerName) {
                const discordUserName = await getUsernameFromDiscord(currentSpeaker);
                if (discordUserName) {
                    speakerName = discordUserName;
                    // Cache for future use
                    userMap[currentSpeaker] = discordUserName;
                } else {
                    speakerName = `User-${currentSpeaker.substring(0, 6)}`;
                }
            }
            
            const speakerLabel = currentSpeaker === recordingState.dmUserId ? 
                `**${speakerName} (DM)**` : 
                `**${speakerName}**`;
            summaryLines.push(`${speakerLabel} (${formatTime(currentMessages[0].timestamp)}):\n${formattedContent}`);
        }

        const summaryText = summaryLines.join('\n\n');
        console.log('Generated summary text:', summaryText);
        if (!summaryText.trim()) {
            console.log('No valid transcriptions to summarize');
            return { text: '', cliffNotes: '' };
        }

        // Clean the summary text
        const cleanedSummary = cleanSummaryText(summaryText);
        if (!cleanedSummary) {
            console.log('Summary is empty after cleaning');
            return { text: '', cliffNotes: '' };
        }

        // Generate cliff notes
        let cliffNotes;
        try {
            console.log('Generating cliff notes...');
            cliffNotes = await generateCliffNotes(cleanedSummary, guildId);
            console.log('Cliff notes generated successfully');
        } catch (error) {
            console.error('Failed to generate cliff notes:', error);
            cliffNotes = 'Failed to generate cliff notes. Please check the full summary for details.';
        }

        const summaryMetadata = {
            users: Object.values(userMap),
            sessionDuration: timeSince(recordingState.sessionStart),
            timestamp: new Date(),
            campaignName: campaignName,
            messageCount: messageCount
        };

        // Store summary in MongoDB
        try {
            await connectDB();
            
            // Find active session or create a new campaign if no session exists
            let sessionId = null;
            
            // Try to find an active session for this guild
            const activeSession = await SessionState.getActiveSession(guildId);
            
            if (activeSession) {
                console.log('Found active session:', activeSession._id);
                sessionId = activeSession._id;
            }
            
            // Get the last summary for this campaign to determine the next session number
            const lastSummary = await Summary.findOne({ campaignId })
                .sort({ sessionNumber: -1 })
                .select('sessionNumber')
                .lean();

            const sessionNumber = lastSummary ? lastSummary.sessionNumber + 1 : 1;
            
            // Create the summary
            const summary = new Summary({
                guildId,
                campaignId,
                sessionNumber,
                sessionStart: recordingState.sessionStart,
                sessionEnd: new Date(),
                encryptedSummary: encrypt(cleanedSummary),
                encryptedCliffNotes: encrypt(cliffNotes),
                language: 'en', // Default to English
                participants: Object.entries(userMap).map(([userId, username]) => ({
                    userId,
                    username,
                    isDM: userId === recordingState.dmUserId
                }))
            });
            
            // Link to session if available, otherwise link to campaign
            if (sessionId) {
                summary.sessionId = sessionId;
            } else if (!summary.campaignId) {
                // If no campaign provided, find or create one
                const existingCampaign = await Campaign.findOneAndUpdate(
                    { guildId, name: campaignName },
                    {
                        $setOnInsert: {
                            name: campaignName,
                            dmUserId: recordingState.dmUserId
                        }
                    },
                    { 
                        upsert: true,
                        new: true,
                        setDefaultsOnInsert: true
                    }
                );
                summary.campaignId = existingCampaign._id;
            }
            
            // Encrypt and store the summary
            console.log('Encrypting summary and cliff notes...');
            console.log('Summary text length:', cleanedSummary.length);
            console.log('Cliff notes length:', cliffNotes.length);
            
            console.log('Encryption completed. Saving to database...');
            await summary.save();
            console.log('Summary and cliff notes saved successfully');
            
            return {
                text: cleanedSummary,
                cliffNotes,
                campaignId,
                campaignName,
                metadata: summaryMetadata
            };
        } catch (error) {
            console.error('Error saving summary to database:', error);
            throw error;
        }
    } catch (error) {
        console.error('Error in generateSummary:', error);
        throw error;
    }
}

/**
 * Generates cliff notes from the full summary using ChatGPT
 * @param {string} summaryText - The complete session summary
 * @param {string} guildId - Discord guild ID to get the API key for
 * @returns {Promise<string>} Concise cliff notes version of the summary
 */
export async function generateCliffNotes(summaryText, guildId) {
    try {
        // Get server configuration and API key
        const serverConfig = await ServerConfig.findOne({ guildId });
        if (!serverConfig || !serverConfig.openaiApiKey) {
            throw new Error(`No API key configured for guild ${guildId}. Use /apikey set to configure one.`);
        }

        const apiKey = serverConfig.getDecryptedApiKey();
        if (!apiKey) {
            throw new Error(`Failed to decrypt API key for guild ${guildId}. Please reconfigure with /apikey set.`);
        }

        // Validate input
        if (!summaryText || typeof summaryText !== 'string') {
            throw new Error('Invalid summary text provided for cliff notes generation');
        }

        // Sanitize and validate summary text
        const sanitizedText = summaryText.trim();
        if (sanitizedText.length === 0) {
            throw new Error('Empty summary text provided');
        }

        // Check if the text is too long for the API
        if (sanitizedText.length > 4000) {
            console.warn('Summary text too long, truncating for cliff notes generation');
            summaryText = sanitizedText.substring(0, 4000);
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `You are a D&D session summarizer that creates concise, well-structured cliff notes. Focus on key story beats, major decisions, and important discoveries. If the session is a one-shot, focus on the plot and the characters' actions. If the session is a campaign, focus on the campaign's plot and the characters' actions. If the summary is a campaign, focus on the campaign's plot and the characters' actions. If the summary is a short, don't make up a story, just say that the session was short.
                        
                        Add appropriate emojis for different types of actions:
                        - ⚔️ for melee attacks and combat
                        - 🎯 for ranged attacks
                        - 💥 for critical hits and explosions
                        - 🛡️ for defensive actions and saving throws
                        - 🧙‍♂️ for spellcasting and magic
                        - 🎲 for skill checks and ability rolls
                        - 💰 for treasure and loot
                        - 🏰 for locations and exploration
                        - 🤝 for social interactions and diplomacy
                        - ❓ for mysteries and discoveries
                        - 💀 for death and danger
                        - 🎭 for roleplaying moments
                        - 🎪 for dramatic events
                        - 🏆 for achievements and level-ups
                        
                        Format the cliff notes with clear sections and use emojis to make the summary more engaging and visually appealing.
                        
                        IMPORTANT: Do not include any phrases like "Thank you for listening" or "Thank you for watching" in your response.`
                    },
                    {
                        role: 'user',
                        content: `Please create structured cliff notes from this D&D session summary:\n\n${summaryText}`
                    }
                ],
                temperature: 0.7,
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`OpenAI API error: ${response.status} ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        if (!data.choices?.[0]?.message?.content) {
            throw new Error('Invalid response from OpenAI API');
        }

        const cliffNotes = data.choices[0].message.content.trim();
        if (!cliffNotes) {
            throw new Error('Empty cliff notes generated');
        }

        let cleanedCliffNotes = cliffNotes;
        UNWANTED_PHRASES.forEach(phrase => {
            cleanedCliffNotes = cleanedCliffNotes.replace(phrase, '').trim();
        });

        return cleanedCliffNotes;
    } catch (error) {
        console.error('Error generating cliff notes:', error);
        throw error;
    }
}

/**
 * Splits a summary into Discord-friendly chunks
 * @param {string} summaryText - The full summary text
 * @param {string} campaignName - The campaign name
 * @param {string} sessionDuration - The session duration
 * @returns {Array} Array of formatted message chunks
 */
export function splitSummaryForDiscord(summaryText, campaignName, sessionDuration) {
    try {
        // Validate inputs
        if (!summaryText || typeof summaryText !== 'string') {
            throw new Error('Invalid summary text provided');
        }
        if (!campaignName || typeof campaignName !== 'string') {
            throw new Error('Invalid campaign name provided');
        }
        if (!sessionDuration || typeof sessionDuration !== 'string') {
            throw new Error('Invalid session duration provided');
        }

        // Sanitize inputs
        const sanitizedText = summaryText.trim();
        const sanitizedCampaignName = campaignName.trim();
        const sanitizedDuration = sessionDuration.trim();

        if (sanitizedText.length === 0) {
            throw new Error('Empty summary text provided');
        }

        const chunks = [];
        let currentChunk = '';
        const lines = sanitizedText.split('\n\n');
        
        // Process each line
        for (const line of lines) {
            const lineLength = line.length;
            
            // If adding this line would exceed Discord's limit
            if (currentChunk.length + lineLength + 2 > 1900) {
                // If the current chunk is not empty, save it
                if (currentChunk) {
                    chunks.push(currentChunk);
                    currentChunk = '';
                }
                
                // If a single line is too long, split it
                if (lineLength > 1900) {
                    const words = line.split(' ');
                    let tempLine = '';
                    for (const word of words) {
                        if (tempLine.length + word.length + 1 > 1900) {
                            chunks.push(tempLine);
                            tempLine = word;
                        } else {
                            tempLine += (tempLine ? ' ' : '') + word;
                        }
                    }
                    if (tempLine) {
                        currentChunk = tempLine;
                    }
                } else {
                    currentChunk = line;
                }
            } else {
                currentChunk += (currentChunk ? '\n\n' : '') + line;
            }
        }
        
        // Add the last chunk if it exists
        if (currentChunk) {
            chunks.push(currentChunk);
        }
        
        // Format each chunk with headers and footers
        return chunks.map((chunk, i) => {
            const header = i === 0 ? '' : '';
            const footer = i === chunks.length - 1 ? `\n\n*Session Duration: ${sanitizedDuration}*` : '';
            return `${header}${chunk}${footer}`;
        });
    } catch (error) {
        console.error('Error splitting summary for Discord:', error);
        throw error;
    }
}