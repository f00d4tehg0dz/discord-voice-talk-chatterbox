import mongoose from 'mongoose';
// import crypto from 'crypto';

const CampaignSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
  },
  description: String,
  dmId: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.models.Campaign || mongoose.model('Campaign', CampaignSchema); 