/**
 * Format timestamp for display
 * @param {Date} timestamp - The timestamp to format
 * @returns {string} Formatted time string
 */
export function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

/**
 * Format message content with appropriate line breaks
 * @param {Array} messages - Array of message objects with text and timestamp
 * @returns {string} Formatted message content
 */
export function formatMessageContent(messages) {
    // Join messages with appropriate breaks
    let formattedText = '';
    
    messages.forEach((message, i) => {
        const text = message.text.trim();
        
        // Skip empty messages
        if (!text) return;
        
        // Check if this should be a new paragraph
        const isParagraphBreak = shouldBreakParagraph(text, i > 0 ? messages[i-1].text : '');
        
        if (i === 0) {
            formattedText = text;
        } else if (isParagraphBreak) {
            formattedText += `\n\n${text}`;
        } else {
            formattedText += ` ${text}`;
        }
    });
    
    return formattedText;
}

/**
 * Determine if we should create a paragraph break between messages
 * @param {string} currentText - Current message text
 * @param {string} previousText - Previous message text
 * @returns {boolean} Whether to create a paragraph break
 */
function shouldBreakParagraph(currentText, previousText) {
    // If no previous text, no need for break
    if (!previousText) return false;
    
    // If current text starts with paragraph indicators
    if (/^(([A-Z][a-z]+ )?[A-Z][a-z]+ says:|"[A-Z]|I |We |The |Then |After |Before |Meanwhile|Suddenly)/i.test(currentText)) {
        return true;
    }
    
    // If previous text ends with strong punctuation
    if (/[.!?]\s*$/.test(previousText)) {
        // If current text starts with capital letter, likely new thought
        if (/^[A-Z]/.test(currentText)) {
            return true;
        }
    }
    
    // If there's a scene transition or character action
    if (/^\*|^\[.*\]$|^-/.test(currentText)) {
        return true;
    }
    
    return false;
}

/**
 * Format time elapsed since a given date
 * @param {Date} date - The starting date
 * @returns {string} Formatted time elapsed
 */
export function timeSince(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    const intervals = {
        hour: 3600,
        minute: 60,
        second: 1
    };
    
    const parts = [];
    for (const [name, secondsInUnit] of Object.entries(intervals)) {
        const value = Math.floor(seconds / secondsInUnit);
        if (value > 0) {
            parts.push(`${value} ${name}${value !== 1 ? 's' : ''}`);
            break;
        }
    }
    
    return parts.join(', ');
} 