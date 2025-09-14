import OpenAI from 'openai';
import { config } from './config.js';
import axios from 'axios';

const openai = new OpenAI({
    apiKey: config.openai.apiKey,
});

/**
 * Generate image using DALL-E 3
 */
export async function generateImage(prompt, style = "natural", quality = "standard") {
    try {
        console.log(`[IMAGE] Generating image with prompt: "${prompt}"`);
        console.log(`[IMAGE] Style: ${style}, Quality: ${quality}`);
        
        if (!prompt || prompt.trim().length === 0) {
            throw new Error('Empty prompt provided for image generation');
        }
        
        // Enhanced prompt for better results
        let enhancedPrompt = prompt.trim();
        
        // Add style context based on character (Emma is an artist)
        if (style === "sketch") {
            enhancedPrompt = `A hand-drawn sketch of ${enhancedPrompt}, pencil drawing style, artistic sketch, black and white or light colors`;
        } else if (style === "painting") {
            enhancedPrompt = `An artistic painting of ${enhancedPrompt}, colorful, artistic style, painted artwork`;
        } else if (style === "digital_art") {
            enhancedPrompt = `Digital art of ${enhancedPrompt}, modern digital artwork, vibrant colors`;
        }
        
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: enhancedPrompt,
            n: 1,
            size: "1024x1024",
            quality: quality, // "standard" or "hd"
            response_format: "url",
        });
        
        const imageUrl = response.data[0]?.url;
        const revisedPrompt = response.data[0]?.revised_prompt;
        
        if (!imageUrl) {
            throw new Error('No image URL returned from DALL-E');
        }
        
        console.log(`[IMAGE] Generated image successfully`);
        console.log(`[IMAGE] Revised prompt: "${revisedPrompt}"`);
        
        return {
            url: imageUrl,
            originalPrompt: prompt,
            revisedPrompt: revisedPrompt,
            style: style,
            timestamp: new Date(),
        };
        
    } catch (error) {
        console.error(`[IMAGE] Failed to generate image:`, error);
        
        if (error.response) {
            console.error(`[IMAGE] API error response:`, error.response.data);
        }
        
        throw new Error(`Image generation failed: ${error.message}`);
    }
}

/**
 * Download image from URL to buffer for Discord posting
 */
export async function downloadImageBuffer(imageUrl) {
    try {
        console.log(`[IMAGE] Downloading image from URL`);
        
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
        });
        
        const imageBuffer = Buffer.from(response.data);
        console.log(`[IMAGE] Downloaded image buffer: ${imageBuffer.length} bytes`);
        
        return imageBuffer;
        
    } catch (error) {
        console.error(`[IMAGE] Failed to download image:`, error);
        throw new Error(`Image download failed: ${error.message}`);
    }
}

/**
 * Check if text contains image generation request
 */
export function isImageRequest(text) {
    const lowerText = text.toLowerCase();
    
    const imageKeywords = [
        'sketch', 'draw', 'drawing', 'paint', 'painting', 'create art',
        'make art', 'artwork', 'illustration', 'picture of', 'image of',
        'show me', 'visualize', 'design', 'create image', 'generate image'
    ];
    
    return imageKeywords.some(keyword => lowerText.includes(keyword));
}

/**
 * Extract image description from user message
 */
export function extractImagePrompt(text) {
    const lowerText = text.toLowerCase();
    
    // Common patterns to extract the subject
    const patterns = [
        /(?:sketch|draw|paint|create|make|show me|visualize|design).+?(?:of|a|an)\s+(.+)/i,
        /(?:can you|could you|please).+?(?:sketch|draw|paint|create|make|show|visualize).+?(?:of|a|an)\s+(.+)/i,
        /(?:i want|i'd like|i would like).+?(?:sketch|draw|paint|image|picture).+?(?:of|a|an)\s+(.+)/i,
        /(?:sketch|draw|paint|create|make|generate).+?(.+)/i,
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            return match[1].trim();
        }
    }
    
    // Fallback: return the original text cleaned up
    return text
        .replace(/(?:sketch|draw|paint|create|make|show me|visualize|design|please|can you|could you|i want|i'd like|i would like)/gi, '')
        .replace(/(?:of|a|an)\s+/gi, '')
        .trim();
}

/**
 * Determine art style based on user request
 */
export function determineArtStyle(text) {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('sketch') || lowerText.includes('draw')) {
        return 'sketch';
    } else if (lowerText.includes('paint') || lowerText.includes('painting')) {
        return 'painting';
    } else if (lowerText.includes('digital') || lowerText.includes('modern')) {
        return 'digital_art';
    }
    
    return 'natural'; // Default style
}

/**
 * Generate character-appropriate response for image creation
 */
export function generateImageResponse(character, prompt, success = true, error = null) {
    const responses = {
        emma: {
            generating: [
                "Ooh, I love this idea! Let me sketch that for you real quick...",
                "Perfect! I'm totally inspired - give me just a sec to draw this...",
                "Yes! My hands are already itching to create this. Working on it now...",
                "Oh this sounds amazing! I can already picture it... let me bring it to life!",
                "Art time! I'm so excited to create this for you - just a moment..."
            ],
            success: [
                "Ta-da! Here's what I created for you! What do you think?",
                "I'm so happy with how this turned out! Hope you love it as much as I do!",
                "Done! This was so fun to make - I got a bit carried away with the details!",
                "Here's your artwork! I had such a blast creating this!",
                "Finished! My hands are covered in imaginary paint but it was worth it!"
            ],
            error: [
                "Oh no! I'm having trouble with my art supplies right now... Maybe try describing it differently?",
                "Ugh, my creative block is acting up! Can you give me another idea to work with?",
                "Sorry! My canvas isn't cooperating today. Could you rephrase what you'd like?",
                "Oops! Something went wrong with my art tools. Mind trying again?"
            ]
        },
        wizard: {
            generating: [
                "Ah, you seek visual magic! The ancient runes are stirring... conjuring your vision...",
                "By the mystical arts! I shall weave this image from the ethereal realm...",
                "The crystal ball clouds with arcane energy... your vision materializes...",
                "Ancient magic flows through my staff... manifesting your desire..."
            ],
            success: [
                "Behold! The mystical arts have rendered your vision into reality!",
                "The ancient powers have spoken! Your image emerges from the magical mists!",
                "By the stars! The conjuring is complete - witness the fruits of arcane knowledge!",
                "The spell is woven! Gaze upon what the mystical forces have created!"
            ],
            error: [
                "Alas! The magical energies are in discord today... perhaps rephrase your mystical request?",
                "The ancient runes reject this incantation... try speaking your desire differently!",
                "The ethereal realm resists... the vision cannot manifest at this time...",
                "Dark forces interfere with the conjuring! Attempt the spell anew!"
            ]
        }
    };
    
    const characterResponses = responses[character.toLowerCase()] || responses.emma;
    
    if (!success && error) {
        const errorResponses = characterResponses.error;
        return errorResponses[Math.floor(Math.random() * errorResponses.length)];
    } else if (success) {
        const successResponses = characterResponses.success;
        return successResponses[Math.floor(Math.random() * successResponses.length)];
    } else {
        const generatingResponses = characterResponses.generating;
        return generatingResponses[Math.floor(Math.random() * generatingResponses.length)];
    }
}

/**
 * Test image generation with sample prompt
 */
export async function testImageGeneration() {
    const testPrompt = "a cute cat wearing a wizard hat";
    
    try {
        console.log(`[IMAGE] Running image generation test`);
        
        const result = await generateImage(testPrompt, "sketch", "standard");
        
        console.log(`[IMAGE] Test successful - generated image URL: ${result.url}`);
        return { success: true, result };
        
    } catch (error) {
        console.error(`[IMAGE] Test failed:`, error.message);
        return { success: false, error: error.message };
    }
}