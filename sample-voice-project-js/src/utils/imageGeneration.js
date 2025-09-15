import OpenAI from 'openai';
import { config } from './config.js';
import axios from 'axios';

// Store recent sketches per guild/user for reference
const recentSketches = new Map(); // guildId -> [{prompt, url, timestamp, style, originalPrompt, userId}, ...]

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
export function isImageRequest(text, guildId = null) {
    const lowerText = text.toLowerCase();

    // Check for redraw/redo requests first
    if (isRedrawRequest(text, guildId)) {
        return true;
    }

    // Check for requests to show previous sketches
    if (isShowPreviousSketchRequest(text, guildId)) {
        return true;
    }

    // More explicit patterns that indicate drawing/sketching intent
    const explicitPatterns = [
        /\b(sketch|draw|paint|create|make|design)\s+(me\s+)?a?\s*(picture|image|drawing|sketch|painting|artwork)/i,
        /\b(can you|could you|would you|please)\s+(sketch|draw|paint|create|make|design)/i,
        /\b(i want|i'd like|i would like)\s+(you to|a)?\s*(sketch|draw|paint|create|make|design)/i,
        /\b(sketch|draw|paint|create|make|design)\s+(something|an image|a picture)/i,
        /\bart time\b/i, // Emma's signature phrase
        /\b(let's|lets)\s+(draw|sketch|paint|create|make)/i,
        /\b(time to|ready to)\s+(draw|sketch|paint|create|make)/i,
        /\b(emma,?\s+)?(draw|sketch|paint|create|make)\s+/i, // Direct requests to Emma
        /\b(how about|what about|maybe)\s+(drawing|sketching|painting)/i,
        /\b(want to see|wanna see)\s+(a|an|some)?\s*(drawing|sketch|painting|artwork)/i
    ];

    // Check for explicit patterns first
    if (explicitPatterns.some(pattern => pattern.test(text))) {
        return true;
    }

    // Additional explicit keywords that must be followed by descriptive content
    const drawingKeywords = ['sketch', 'draw', 'paint', 'create art', 'make art'];
    const hasDrawingKeyword = drawingKeywords.some(keyword => lowerText.includes(keyword));

    // Only trigger if there's a drawing keyword AND some descriptive content
    if (hasDrawingKeyword) {
        const words = lowerText.split(/\s+/);
        // Must have at least 4 words and contain descriptive terms
        return words.length >= 4 && (
            lowerText.includes(' of ') ||
            lowerText.includes(' with ') ||
            lowerText.includes(' that ') ||
            /\b(cat|dog|house|tree|car|person|sunset|mountain|flower|landscape|portrait|abstract|city|forest|ocean|beach|castle|dragon|unicorn|robot|space|galaxy|planet|star)\b/.test(lowerText)
        );
    }

    return false;
}

/**
 * Check if text is asking for a redraw/redo of the previous sketch
 */
export function isRedrawRequest(text, guildId = null) {
    const lowerText = text.toLowerCase();

    const redrawPatterns = [
        /\b(try again|redo|redraw|draw again|sketch again|make another|do another|draw different|sketch different)/i,
        /\b(that's not (right|good|what i wanted|correct)|not quite (right|what i wanted)|not the right)/i,
        /\b(can you (fix|improve|redo|redraw)|could you (fix|improve|redo|redraw))/i,
        /\b(draw it (again|differently|better)|sketch it (again|differently|better))/i,
        /\b(not good|terrible|awful|bad|wrong|horrible|ugly|not what i (wanted|meant|asked for))/i,
        /\b(let me see (another|a different)|show me (another|a different))/i,
        /\b(make it (better|different|again)|do it (better|different|again))/i,
        /\b(hmm|oof|eh|meh|nah|yikes).*(not|bad|wrong|off)/i,
        /\b(doesn't look right|looks off|looks weird|something's off|not quite there)/i,
        /\b(i don't like|not feeling|not working|doesn't capture)/i,
        /\b(maybe something more|how about something|what about trying)/i,
        /\b(close but|almost but|good try but)/i,
        /\b(not really what|that's not what|not exactly what)/i,
        /\b(can we try|let's try|how about we)/i
    ];

    // Only consider it a redraw if there were recent sketches
    if (guildId && recentSketches.has(guildId)) {
        const sketches = recentSketches.get(guildId);
        const recentSketch = sketches[sketches.length - 1];

        // Only if there was a sketch in the last 10 minutes
        if (recentSketch && (Date.now() - recentSketch.timestamp) < 10 * 60 * 1000) {
            return redrawPatterns.some(pattern => pattern.test(text));
        }
    }

    return false;
}

/**
 * Check if text is asking to show a previous sketch
 */
export function isShowPreviousSketchRequest(text, guildId = null) {
    const lowerText = text.toLowerCase();

    const showPatterns = [
        /\b(show me (that|the) (sketch|drawing|artwork|image) (i|you|we) (made|drew|created|worked on))/i,
        /\b(what about (that|the) (sketch|drawing|artwork) (from|you made|we did))/i,
        /\b(remember (that|the) (sketch|drawing|artwork|image) (you made|we did|from))/i,
        /\b(the (sketch|drawing|artwork|image) (you|we) (made|did|created) (earlier|today|this morning|this afternoon))/i,
        /\b(show me (that|the) one (you|we) (made|did|drew|created))/i,
        /\b(that (sketch|drawing|artwork|painting) (you|we) were working on)/i,
        /\b(can you show me (that|the) (sketch|drawing|artwork) again)/i,
        /\b(what was (that|the) (sketch|drawing|artwork) you (made|did|created|drew))/i,
        /\b(i was talking about (that|the) (sketch|drawing|artwork) you (made|did|showed me))/i,
        /\b((that|the) one you (sketched|drew|made) (earlier|before|today))/i,
        /\b(you know, (that|the) (sketch|drawing|artwork) (from|you did))/i,
        /\b((that|the) (cat|dog|house|tree|car|person|sunset|mountain|flower) (sketch|drawing|artwork) you (made|drew))/i,
        /\b(like (that|the) (sketch|drawing|artwork) you (made|drew|created|showed me))/i,
        /\b(similar to (that|the) (sketch|drawing|artwork) you (made|drew|did) (earlier|before|today))/i,
        /\b(remember when you (sketched|drew|made) (that|the))/i
    ];

    // Only consider it a show request if there were recent sketches
    if (guildId && recentSketches.has(guildId)) {
        const sketches = recentSketches.get(guildId);

        // Check if there were sketches in the last 2 hours
        const recentSketch = sketches.find(sketch =>
            (Date.now() - sketch.timestamp) < 2 * 60 * 60 * 1000
        );

        if (recentSketch) {
            return showPatterns.some(pattern => pattern.test(text));
        }
    }

    return false;
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
 * Store a sketch in the recent sketches cache
 */
export function storeRecentSketch(guildId, sketch, userId = null) {
    if (!recentSketches.has(guildId)) {
        recentSketches.set(guildId, []);
    }

    const guildSketches = recentSketches.get(guildId);
    const sketchData = {
        ...sketch,
        userId: userId,
        timestamp: new Date()
    };

    guildSketches.push(sketchData);

    // Keep only the last 10 sketches per guild
    if (guildSketches.length > 10) {
        guildSketches.splice(0, guildSketches.length - 10);
    }
}

/**
 * Get the most recent sketch for a guild
 */
export function getLastSketch(guildId) {
    if (!recentSketches.has(guildId)) return null;

    const sketches = recentSketches.get(guildId);
    return sketches.length > 0 ? sketches[sketches.length - 1] : null;
}

/**
 * Find a sketch based on content keywords
 */
export function findSketchByContent(guildId, searchText) {
    if (!recentSketches.has(guildId)) return null;

    const sketches = recentSketches.get(guildId);
    const lowerSearchText = searchText.toLowerCase();

    // Look for sketches that match content keywords
    const matchingSketch = sketches
        .reverse() // Search from most recent first
        .find(sketch => {
            const originalPrompt = (sketch.originalPrompt || sketch.prompt || '').toLowerCase();
            const revisedPrompt = (sketch.revisedPrompt || '').toLowerCase();

            // Check for common subject keywords
            const subjects = ['cat', 'dog', 'house', 'tree', 'car', 'person', 'sunset', 'mountain', 'flower', 'forest', 'beach', 'castle', 'dragon', 'unicorn', 'robot'];

            for (const subject of subjects) {
                if (lowerSearchText.includes(subject) &&
                    (originalPrompt.includes(subject) || revisedPrompt.includes(subject))) {
                    return true;
                }
            }

            // Check for other descriptive words
            const words = lowerSearchText.split(/\s+/);
            const promptWords = [...originalPrompt.split(/\s+/), ...revisedPrompt.split(/\s+/)];

            return words.some(word =>
                word.length > 3 &&
                promptWords.some(pWord => pWord.includes(word) || word.includes(pWord))
            );
        });

    return matchingSketch || null;
}

/**
 * Generate response when showing previous sketches
 */
export function generateShowSketchResponse(character, sketch) {
    const responses = {
        emma: [
            "Oh yeah! Here's that sketch I made earlier. I'm still pretty proud of this one!",
            "Yes! You mean this one, right? I remember having so much fun working on it.",
            "Ah, this sketch! I was just thinking about this one actually. Here it is!",
            "Oh totally! Here's the one you're talking about. I loved how this turned out.",
            "Right, this sketch! I remember getting really into the zone while working on this.",
            "Yes yes yes, this one! I was wondering if anyone would ask to see it again.",
            "Oh this beauty! I'm so glad you remembered this sketch. Here you go!",
            "Absolutely! Here's that artwork. I actually learned something new while making this one.",
            "Oh for sure! This is the one you mean, right? I had such a good time creating it.",
            "Yes! Here's that sketch I made. Looking at it now, I'm still happy with how it came out!",
            "Oh my gosh, yes! This sketch! I remember exactly what I was thinking when I made this.",
            "Perfect timing! I was just admiring this sketch myself. Here it is again!"
        ],
        wizard: [
            "Ah yes! Behold, the mystical creation from our earlier conjuring session!",
            "Indeed! Here lies the fruit of our previous arcane endeavors!",
            "By the ancient arts! This vision was summoned from the ethereal realm earlier.",
            "Precisely! This manifestation from the mystical forces still holds its power!"
        ]
    };

    const characterResponses = responses[character.toLowerCase()] || responses.emma;
    const response = characterResponses[Math.floor(Math.random() * characterResponses.length)];

    return response;
}

/**
 * Generate character-appropriate response for image creation
 */
export function generateImageResponse(character, prompt, success = true, error = null, artStyle = null, isRedraw = false) {
    const responses = {
        emma: {
            generating: [
                "Ooh, I love this idea! Let me grab my pencils and sketch that for you...",
                "Oh my gosh, yes! I can totally see this in my head already. Give me just a sec to draw it!",
                "Art time! *cracks knuckles* I'm so excited about this - let me bring it to life!",
                "Perfect timing! I was just thinking about drawing something. Working on this right now...",
                "This sounds amazing! My creative brain is already buzzing with ideas. Starting the sketch now!",
                "Okay okay, I'm getting that tingly feeling when I know it's gonna be good art. One moment please!",
                "Yes! Finally something fun to draw! Let me channel my inner artist here...",
                "I'm literally bouncing in my chair right now - this is gonna be so cool to create!",
                "Alright, switching to artist mode! Time to make some magic happen on paper...",
                "Ooh, my hands are already moving! I can practically see this taking shape. Working on it!",
                "This is giving me all the creative vibes! Let me translate this into something beautiful...",
                "You know what? I've been waiting all day for someone to ask me to draw something! Here we go!",
                "My art brain just went into overdrive! This is exactly the kind of thing I love sketching.",
                "Okay, stepping into my creative zone now... I'm gonna make this look absolutely gorgeous!",
                "I'm getting those good art tingles! You picked the perfect thing to ask me to draw."
            ],
            redraw_generating: [
                "Oh! Yeah, you're totally right - let me try that again with a different approach...",
                "Ooh, good point! I can definitely do better than that. Give me another shot...",
                "You know what? I wasn't feeling it either. Let me grab a different pencil and try again!",
                "Ugh, you're so right! That one was off. My creative brain is fired up now though - take two!",
                "Okay okay, fair critique! I'm already seeing it differently in my head. Sketching again...",
                "Totally get it! Sometimes the first try just doesn't capture the vision. Round two coming up!",
                "Yep, that wasn't quite right was it? I'm feeling much more inspired for this next attempt!",
                "Oh absolutely! I can feel exactly what was missing. Let me channel that energy into a better sketch...",
                "You're not wrong! That one felt rushed. I'm taking my time with this next one - it's gonna be good!",
                "I appreciate the honest feedback! My artistic intuition is telling me exactly how to fix this...",
                "True! Let me approach this from a totally different angle. I'm excited to nail it this time!",
                "Thanks for keeping me honest! I was already feeling like I could push it further. Here we go again!",
                "Good eye! That one didn't have the right vibe at all. I'm completely reimagining it now...",
                "Oh for sure! Sometimes you gotta scrap it and start fresh. My creative juices are flowing better now!",
                "Exactly what I needed to hear! I'm already picturing how much better this next version will be..."
            ],
            success: [
                "And... done! Here's what my brain cooked up for you! What do you think?",
                "Ta-da! I'm actually really proud of how this one turned out!",
                "Okay, I might have gone a little overboard with the details, but here it is!",
                "Finished! My imaginary hands are covered in charcoal but it was so worth it!",
                "Here's your artwork! Honestly, this was such a joy to create - I had a blast!",
                "Done and done! I got so lost in the creative process there. Hope you love it!",
                "Alright, stepping back from the easel... what do you think of this masterpiece?",
                "Phew! That was fun but intense. Here's what came out of my creative brain!",
                "And there we have it! I'm always amazed by what happens when I just let my creativity flow.",
                "Finished! You know, every time I create something, I learn a little more about art.",
                "Here it is! I actually surprised myself with some of the details that emerged.",
                "Done! My artistic side is feeling very satisfied right now. Hope you dig it!",
                "Completed! There's something so magical about turning an idea into visual art.",
                "And... voilà! I really hope this captures what you were imagining!",
                "Okay, I'm officially calling this one complete! What's your honest reaction?",
                "Here's the final piece! I felt like I was in the zone the whole time I was working on this.",
                "Finished! You know what? This might be one of my favorites that I've done recently!",
                "Done! My creative energy is still buzzing from working on this one."
            ],
            error: [
                "Ugh, my creative flow just hit a wall! Maybe try describing it a little differently?",
                "Oh no, I'm having one of those artist block moments... Could you give me the idea in different words?",
                "My artistic brain is being super stubborn right now! Can you rephrase what you're thinking?",
                "Darn it! My imagination is stuck in a creative loop. Mind trying that again?",
                "Oof, my art supplies are being uncooperative today. Could you describe it another way?",
                "My creative muse just stepped out for a coffee break apparently! Try rephrasing that?",
                "Hmm, my artistic vision is getting all fuzzy. Could you paint me a word picture differently?",
                "My drawing hand is cramping up! Just kidding, but seriously, could you try again?",
                "I think my creative neurons are misfiring today. Give me that request one more time?",
                "My inner artist is having a tantrum right now. Could you approach this from a different angle?"
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
        let successResponses = characterResponses.success;

        // Add style-specific success responses for Emma
        if (character.toLowerCase() === 'emma' && artStyle) {
            const styleSpecificResponses = {
                'sketch': [
                    "And there's your sketch! I love how the pencil lines came together on this one!",
                    "Sketch complete! There's something so satisfying about those clean pencil strokes.",
                    "Done! I went with more of a loose, sketchy style - hope you like the artistic vibe!"
                ],
                'painting': [
                    "Finished painting! I got so into mixing the colors for this one.",
                    "And done! My virtual paintbrush was working overtime on those color blends.",
                    "Painting complete! I'm covered in imaginary paint splatters but it was worth it!"
                ],
                'digital_art': [
                    "Digital artwork finished! I love how crisp and vibrant this turned out.",
                    "Done! The digital medium really let me play with those colors and effects.",
                    "Digital art complete! There's something magical about creating in the digital space."
                ]
            };

            if (styleSpecificResponses[artStyle]) {
                // Mix style-specific with general responses
                successResponses = [...successResponses, ...styleSpecificResponses[artStyle]];
            }
        }

        return successResponses[Math.floor(Math.random() * successResponses.length)];
    } else {
        // Choose between redraw and regular generating responses
        let generatingResponses = isRedraw && characterResponses.redraw_generating ?
            characterResponses.redraw_generating :
            characterResponses.generating;

        // Add style-specific generating responses for Emma (only for non-redraw)
        if (character.toLowerCase() === 'emma' && artStyle && !isRedraw) {
            const styleSpecificGenerating = {
                'sketch': [
                    "Time to sketch! Let me grab my favorite pencil and get those lines flowing...",
                    "Sketching mode activated! I'm thinking loose, expressive lines for this one...",
                    "Perfect for a sketch! I can already feel the pencil moving across the paper..."
                ],
                'painting': [
                    "Painting time! Let me mix up the perfect colors for this masterpiece...",
                    "Ooh, this calls for paint! I'm already imagining the brush strokes...",
                    "Time to paint! My palette is ready and my brush is itching to create..."
                ],
                'digital_art': [
                    "Digital art mode! Time to fire up the creative software and make some magic...",
                    "Perfect for digital creation! I love how crisp and vibrant I can make this...",
                    "Digital canvas time! The pixels are calling and I must answer..."
                ]
            };

            if (styleSpecificGenerating[artStyle]) {
                // Mix style-specific with general responses
                generatingResponses = [...generatingResponses, ...styleSpecificGenerating[artStyle]];
            }
        }

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