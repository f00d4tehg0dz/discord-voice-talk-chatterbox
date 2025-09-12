import mongoose from 'mongoose';
import { encryptSummary, decryptSummary } from '../utility/encryption.js';

const summarySchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    index: true
  },
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    index: true
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SessionState',
    index: true
  },
  sessionNumber: {
    type: Number,
    required: true
  },
  sessionStart: {
    type: Date,
    required: true
  },
  sessionEnd: {
    type: Date,
    required: true
  },
  encryptedSummary: {
    iv: String,
    encryptedData: String,
    authTag: String
  },
  encryptedCliffNotes: {
    iv: String,
    encryptedData: String,
    authTag: String
  },
  participants: [{
    userId: String,
    username: String,
    isDM: Boolean
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Add methods for encryption/decryption
summarySchema.methods.encryptSummary = function(text) {
  if (!text) {
    console.error('No text provided for summary encryption');
    return;
  }
  console.log('Encrypting summary text:', text.substring(0, 100) + '...');
  this.encryptedSummary = encryptSummary(text);
  console.log('Summary encryption result:', this.encryptedSummary);
};

summarySchema.methods.decryptSummary = function() {
  if (!this.encryptedSummary) return null;
  return decryptSummary(this.encryptedSummary);
};

summarySchema.methods.encryptCliffNotes = function(text) {
  if (!text) {
    console.error('No text provided for cliff notes encryption');
    return;
  }
  console.log('Encrypting cliff notes:', text.substring(0, 100) + '...');
  this.encryptedCliffNotes = encryptSummary(text);
  console.log('Cliff notes encryption result:', this.encryptedCliffNotes);
};

summarySchema.methods.decryptCliffNotes = function() {
  if (!this.encryptedCliffNotes) return null;
  return decryptSummary(this.encryptedCliffNotes);
};

// Add virtuals for decrypted content
summarySchema.virtual('summary').get(function() {
  return this.decryptSummary();
});

summarySchema.virtual('cliffNotes').get(function() {
  return this.decryptCliffNotes();
});

// Update the updatedAt timestamp before saving
summarySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const Summary = mongoose.models.Summary || mongoose.model('Summary', summarySchema);

export { Summary }; 