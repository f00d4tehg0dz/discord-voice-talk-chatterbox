import mongoose from 'mongoose';
import { encryptSummary, decryptSummary } from '@/lib/encryption';

interface ISummary {
  guildId: string;
  campaignId?: mongoose.Types.ObjectId | {
    _id: mongoose.Types.ObjectId;
    name: string;
  };
  sessionId?: mongoose.Types.ObjectId;
  sessionNumber: number;
  sessionStart: Date;
  sessionEnd: Date;
  encryptedSummary: {
    iv: string;
    encryptedData: string;
    authTag: string;
  };
  encryptedCliffNotes: {
    iv: string;
    encryptedData: string;
    authTag: string;
  };
  participants: Array<{
    userId: string;
    username: string;
    isDM: boolean;
  }>;
  tags: string[];
  searchableText: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ISummaryMethods {
  encryptSummary(text: string): void;
  encryptCliffNotes(text: string): void;
  decryptSummary(): string | null;
  decryptCliffNotes(): string | null;
  updateSearchableText(): void;
}

type SummaryModel = mongoose.Model<ISummary, object, ISummaryMethods>;

const SummarySchema = new mongoose.Schema<ISummary, SummaryModel, ISummaryMethods>({
  guildId: {
    type: String,
    required: true,
    index: true,
  },
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    index: true,
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SessionState',
    index: true,
  },
  sessionNumber: {
    type: Number,
    required: true,
  },
  sessionStart: {
    type: Date,
    required: true,
    index: true,
  },
  sessionEnd: {
    type: Date,
    required: true,
    index: true,
  },
  encryptedSummary: {
    iv: String,
    encryptedData: String,
    authTag: String,
  },
  encryptedCliffNotes: {
    iv: String,
    encryptedData: String,
    authTag: String,
  },
  participants: [{
    userId: String,
    username: String,
    isDM: Boolean,
  }],
  tags: {
    type: [String],
    default: [],
    index: true,
  },
  searchableText: {
    type: String,
    default: '',
    index: 'text',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add methods for encryption/decryption
SummarySchema.methods.encryptSummary = function(text: string): void {
  if (!text) {
    throw new Error('No text provided for summary encryption');
  }
  console.log('Encrypting summary text:', text.substring(0, 100) + '...');
  this.encryptedSummary = encryptSummary(text);
  this.updateSearchableText();
  console.log('Summary encryption result:', this.encryptedSummary);
};

SummarySchema.methods.encryptCliffNotes = function(text: string): void {
  if (!text) {
    throw new Error('No text provided for cliff notes encryption');
  }
  console.log('Encrypting cliff notes:', text.substring(0, 100) + '...');
  this.encryptedCliffNotes = encryptSummary(text);
  this.updateSearchableText();
  console.log('Cliff notes encryption result:', this.encryptedCliffNotes);
};

SummarySchema.methods.decryptSummary = function(): string | null {
  if (!this.encryptedSummary) return null;
  return decryptSummary(this.encryptedSummary);
};

SummarySchema.methods.decryptCliffNotes = function(): string | null {
  if (!this.encryptedCliffNotes) return null;
  return decryptSummary(this.encryptedCliffNotes);
};

// Add method to update searchable text
SummarySchema.methods.updateSearchableText = function(): void {
  const summary = this.decryptSummary() || '';
  const cliffNotes = this.decryptCliffNotes() || '';
  const participantNames = this.participants?.map(p => p.username)?.join(' ') || '';
  const tags = this.tags?.join(' ') || '';
  
  // Include campaign name if available and populated
  const campaignName = typeof this.campaignId === 'object' && this.campaignId && 'name' in this.campaignId
    ? this.campaignId.name
    : '';
  
  this.searchableText = [
    summary,
    cliffNotes,
    participantNames,
    tags,
    campaignName,
    `Session ${this.sessionNumber}`
  ].filter(Boolean).join(' ');
};

// Ensure text index is created
SummarySchema.index({ searchableText: 'text' });

// Update the updatedAt timestamp and searchable text before saving
SummarySchema.pre('save', async function(next) {
  this.updatedAt = new Date();
  this.updateSearchableText();
  next();
});

// Add virtuals for decrypted content
SummarySchema.virtual('summary').get(function() {
  return this.decryptSummary();
});

SummarySchema.virtual('cliffNotes').get(function() {
  return this.decryptCliffNotes();
});

export default mongoose.models.Summary || mongoose.model<ISummary, SummaryModel>('Summary', SummarySchema); 