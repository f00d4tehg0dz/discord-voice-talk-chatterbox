import fs from 'fs';
import FormData from 'form-data';
import axios from 'axios';
import 'dotenv/config';
import { ServerConfig } from '../models/ServerConfig.js';

/**
 * Checks if audio file is long enough for Whisper API
 * @param {string} filePath - Path to the audio file
 * @returns {Promise<boolean>} - True if the file is valid and long enough
 */
async function isAudioLongEnough(filePath) {
	try {
		// Verify the file exists and has content
		if (!fs.existsSync(filePath)) {
			return false;
		}

		const stats = fs.statSync(filePath);
		
		// WAV header is 44 bytes, and minimum required audio is about 4800 bytes 
		// (0.1 seconds at 48kHz with 16-bit samples)
		const minWavSize = 4844; 
		
		return stats.size >= minWavSize;
	} catch (error) {
		console.error('Error checking audio file size:', error);
		return false;
	}
}

/**
 * Creates a transcription using OpenAI's Whisper API
 * @param {string} filePath - Path to the WAV audio file to transcribe
 * @param {string} guildId - Discord guild ID to get the API key for
 * @param {Object} [sessionState] - Optional session state containing language and character information
 * @returns {Promise<string>} - The transcribed text
 */
export async function createWhisperTranscription(filePath, guildId, sessionState = null) {
	try {
		// Get server configuration and API key
		const serverConfig = await ServerConfig.findOne({ guildId });
		if (!serverConfig || !serverConfig.openaiApiKey) {
			console.error(`No API key configured for guild ${guildId}`);
			return '[No API key configured. Use /apikey set to configure one.]';
		}

		const apiKey = serverConfig.getDecryptedApiKey();
		if (!apiKey) {
			console.error(`Failed to decrypt API key for guild ${guildId}`);
			return '[API key decryption failed. Please reconfigure with /apikey set.]';
		}

		// Verify the file exists and has content
		if (!fs.existsSync(filePath)) {
			throw new Error(`File does not exist: ${filePath}`);
		}

		const stats = fs.statSync(filePath);
		if (stats.size === 0) {
			throw new Error(`File is empty: ${filePath}`);
		}

		// Check if the audio file is long enough
		const isLongEnough = await isAudioLongEnough(filePath);
		if (!isLongEnough) {
			console.log(`Audio file is too short (${stats.size} bytes), skipping Whisper API call`);
			return '[Audio too short]';
		}

		console.log(`Sending file to Whisper API for guild ${guildId}, size: ${stats.size} bytes`);
		
		// Create form data with the audio file
		const formData = new FormData();
		formData.append('file', fs.createReadStream(filePath));
		formData.append('model', 'gpt-4o-transcribe');
		// Adding parameters to improve transcription quality for DnD context
		formData.append('language', sessionState?.language || 'en');
		formData.append('prompt', `This is a Dungeons & Dragons session with fantasy terms, character names, and role-playing game terminology. ${sessionState ? getCharacterPrompt(sessionState) : ''}`);
		
		// Send request to OpenAI API
		const response = await axios.post(
			'https://api.openai.com/v1/audio/transcriptions',
			formData,
			{
				headers: {
					...formData.getHeaders(),
					Authorization: `Bearer ${apiKey}`,
				},
				timeout: 60000, // 60 second timeout for longer audio clips
			},
		);
		
		// Check for successful response
		if (response.data && response.data.text) {
			const transcribedText = response.data.text.trim();
			// Check if the transcribed text is empty or contains only non-speech sounds
			if (!transcribedText || 
				transcribedText.match(/^\s*$/) || 
				transcribedText.match(/^\[.*\]$/) ||
				transcribedText.toLowerCase().includes('background noise') ||
				transcribedText.toLowerCase().includes('silence')) {
				console.log('Empty or non-speech audio detected, returning empty result');
				return '[No speech detected]';
			}
			return transcribedText;
		} else {
			console.error('Invalid response from Whisper API:', response.data);
			return '[Transcription failed]';
		}
	}
	catch (error) {
		// Handle audio_too_short error more gracefully
		if (error.response?.data?.error?.code === 'audio_too_short') {
			console.log('Whisper API reports audio too short, skipping');
			return '[Audio too short]';
		}
		
		console.error('Error with Whisper transcription:', error.response?.data || error.message);
		return '[Transcription failed]';
	}
}

// Add new function to get character prompt
function getCharacterPrompt(sessionState) {
	if (!sessionState?.characters?.length) return '';
	
	const characterList = sessionState.characters.map(char => 
		`Character: ${char.name}${char.aliases?.length ? ` (also known as: ${char.aliases.join(', ')})` : ''}${char.isNPC ? ' (NPC)' : ''}`
	).join('\n');
	
	return `\n\nKnown characters:\n${characterList}`;
}

// Add new function for translation
export async function translateText(text, targetLanguage) {
	try {
		const response = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
			},
			body: JSON.stringify({
				model: 'gpt-3.5-turbo',
				messages: [
					{
						role: 'system',
						content: `You are a professional translator. Translate the following D&D session text to ${targetLanguage}. Preserve all formatting, character names, and game terminology.`
					},
					{
						role: 'user',
						content: text
					}
				],
				temperature: 0.3
			})
		});

		if (!response.ok) {
			throw new Error(`Translation API error: ${response.status}`);
		}

		const data = await response.json();
		return data.choices[0].message.content;
	} catch (error) {
		console.error('Translation error:', error);
		throw error;
	}
}

// Add new function for language detection
export async function detectLanguage(text) {
	try {
		const response = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
			},
			body: JSON.stringify({
				model: 'gpt-3.5-turbo',
				messages: [
					{
						role: 'system',
						content: 'You are a language detection system. Respond with only the ISO 639-1 language code of the following text.'
					},
					{
						role: 'user',
						content: text
					}
				],
				temperature: 0
			})
		});

		if (!response.ok) {
			throw new Error(`Language detection API error: ${response.status}`);
		}

		const data = await response.json();
		return data.choices[0].message.content.trim();
	} catch (error) {
		console.error('Language detection error:', error);
		throw error;
	}
}