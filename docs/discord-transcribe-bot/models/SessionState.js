import mongoose from 'mongoose';

const sessionStateSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true
    },
    campaignName: {
        type: String,
        required: true
    },
    dmUserId: {
        type: String,
        required: true
    },
    language: {
        type: String,
        required: true,
        default: 'en'
    },
    startTime: {
        type: Date,
        required: true
    },
    endTime: {
        type: Date
    },
    status: {
        type: String,
        enum: ['active', 'paused', 'ended'],
        default: 'active'
    },
    transcription: {
        type: String
    },
    highlights: [{
        timestamp: Date,
        description: String
    }],
    characters: [{
        name: String,
        playerId: String,
        description: String
    }]
}, {
    timestamps: true
});

// Add a character to the session
sessionStateSchema.methods.addCharacter = async function(characterData) {
    this.characters.push(characterData);
    await this.save();
};

// Add a highlight to the session
sessionStateSchema.methods.addHighlight = async function(highlightData) {
    this.highlights.push(highlightData);
    await this.save();
};

// Pause the session
sessionStateSchema.methods.pauseSession = async function() {
    this.status = 'paused';
    await this.save();
};

// Resume the session
sessionStateSchema.methods.resumeSession = async function() {
    this.status = 'active';
    await this.save();
};

// End the session
sessionStateSchema.methods.endSession = async function() {
    this.status = 'ended';
    this.endTime = new Date();
    await this.save();
};

// Get session duration in milliseconds
sessionStateSchema.methods.getSessionDuration = function() {
    const endTime = this.status === 'ended' ? this.endTime : new Date();
    return endTime - this.startTime;
};

// Get active session for a guild
sessionStateSchema.statics.getActiveSession = async function(guildId) {
    return this.findOne({
        guildId,
        status: { $in: ['active', 'paused'] }
    });
};

// Get all sessions for a guild
sessionStateSchema.statics.getGuildSessions = async function(guildId) {
    return this.find({ guildId }).sort({ startTime: -1 });
};

const SessionState = mongoose.model('SessionState', sessionStateSchema);

export { SessionState }; 