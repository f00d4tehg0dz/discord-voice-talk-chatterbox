import mongoose from 'mongoose';

interface ISessionState {
  guildId: string;
  campaignName: string;
  language: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'paused' | 'ended';
  transcription: string;
  highlights: Array<{
    timestamp: Date;
    description: string;
    addedBy: string;
  }>;
  characters: Array<{
    name: string;
    aliases?: string[];
    isNPC: boolean;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

interface ISessionStateMethods {
  addCharacter(characterData: { name: string; aliases?: string[]; isNPC?: boolean }): Promise<void>;
  addHighlight(highlightData: { timestamp: Date; description: string; addedBy: string }): Promise<void>;
  pauseSession(): Promise<void>;
  resumeSession(): Promise<void>;
  endSession(): Promise<void>;
  getSessionDuration(): number;
}

interface SessionStateModel extends mongoose.Model<ISessionState, object, ISessionStateMethods> {
  getActiveSession(guildId: string): Promise<mongoose.Document<unknown, object, ISessionState> & ISessionState & ISessionStateMethods>;
  getGuildSessions(guildId: string): Promise<(mongoose.Document<unknown, object, ISessionState> & ISessionState & ISessionStateMethods)[]>;
}

const sessionStateSchema = new mongoose.Schema<ISessionState, SessionStateModel, ISessionStateMethods>({
  guildId: {
    type: String,
    required: true
  },
  campaignName: {
    type: String,
    required: true
  },
  language: {
    type: String,
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
    type: String,
    default: ''
  },
  highlights: [{
    timestamp: {
      type: Date,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    addedBy: {
      type: String,
      required: true
    }
  }],
  characters: [{
    name: {
      type: String,
      required: true
    },
    aliases: [String],
    isNPC: {
      type: Boolean,
      default: false
    }
  }]
}, {
  timestamps: true
});

// Add a character to the session
sessionStateSchema.methods.addCharacter = async function(characterData: { name: string; aliases?: string[]; isNPC?: boolean }) {
  this.characters.push({
    ...characterData,
    isNPC: characterData.isNPC ?? false // Provide default value for isNPC
  });
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
  const endTime = this.status === 'ended' && this.endTime ? this.endTime : new Date();
  return endTime.getTime() - this.startTime.getTime();
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

const SessionState = (mongoose.models.SessionState || mongoose.model<ISessionState, SessionStateModel>('SessionState', sessionStateSchema)) as SessionStateModel;

export { SessionState }; 