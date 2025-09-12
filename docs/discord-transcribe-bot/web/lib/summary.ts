/**
 * Generates cliff notes from the full summary using OpenAI
 * @param {string} summaryText - The complete session summary
 * @param {string} apiKey - OpenAI API key
 * @param {string} rules - Additional rules for cliff notes generation
 * @returns {Promise<string>} Concise cliff notes version of the summary
 */
export async function generateCliffNotes(
  summaryText: string, 
  apiKey: string, 
  rules?: string
): Promise<string> {
  try {
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
    let processedText = sanitizedText;
    if (sanitizedText.length > 4000) {
      console.warn('Summary text too long, truncating for cliff notes generation');
      processedText = sanitizedText.substring(0, 4000);
    }

    const systemPrompt = `You are a D&D session summarizer that creates concise, well-structured cliff notes. Focus on key story beats, major decisions, and important discoveries. Organize the summary into these sections:

1. 🎭 Key Roleplay Moments
2. ⚔️ Combat Highlights
3. 🎲 Important Rolls & Checks
4. 🏰 Exploration & Discovery
5. 💰 Loot & Rewards
6. 📜 Plot Developments
7. 🎪 Notable Events

Use these emojis for different types of actions:
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
- 🧪 for potions and consumables
- 🗡️ for stealth and deception
- 🎨 for illusions and trickery
- 🌟 for magical items and artifacts
- 🏹 for archery and ranged combat
- 🗣️ for important NPC interactions
- 📜 for quest updates and story progression

Format the cliff notes with clear sections and use emojis to make the summary more engaging and visually appealing. Focus on the most impactful moments and decisions that will affect future sessions.

IMPORTANT: Do not include any phrases like "Thank you for listening" or "Thank you for watching" in your response.`;

    const userPrompt = rules 
      ? `Please create structured cliff notes from this D&D session summary with these additional rules: ${rules}\n\n${processedText}`
      : `Please create structured cliff notes from this D&D session summary:\n\n${processedText}`;

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
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 800
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

    // Clean up unwanted phrases
    const unwantedPhrases = [
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
      'Cliff Notes:',
      '[Character Name (DISCORD USERNAME)]: [Dialogue].'
    ];

    let cleanedCliffNotes = cliffNotes;
    unwantedPhrases.forEach(phrase => {
      cleanedCliffNotes = cleanedCliffNotes.replace(new RegExp(phrase, 'gi'), '').trim();
    });

    // Remove multiple consecutive newlines
    cleanedCliffNotes = cleanedCliffNotes.replace(/\n{3,}/g, '\n\n');
    
    // Remove leading/trailing whitespace
    cleanedCliffNotes = cleanedCliffNotes.trim();

    return cleanedCliffNotes;
  } catch (error) {
    console.error('Error generating cliff notes:', error);
    throw error;
  }
}
