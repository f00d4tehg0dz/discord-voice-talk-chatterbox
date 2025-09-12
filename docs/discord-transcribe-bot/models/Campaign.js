import mongoose from 'mongoose';

const campaignSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true
    },
    dmUserId: {
        type: String,
        required: true
    },
    sessionNumber: {
        type: Number,
        default: 1
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update the updatedAt timestamp before saving
campaignSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

const Campaign = mongoose.models.Campaign || mongoose.model('Campaign', campaignSchema);

export { Campaign }; 