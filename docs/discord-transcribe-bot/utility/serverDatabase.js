import mongoose from 'mongoose';
import { ServerConfig } from '../models/ServerConfig.js';

// Cache for server-specific connections
const serverConnections = new Map();

/**
 * Get or create a MongoDB connection for a specific server
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<mongoose.Connection>} - MongoDB connection
 */
export async function getServerConnection(guildId) {
    // Return cached connection if it exists and is ready
    if (serverConnections.has(guildId)) {
        const connection = serverConnections.get(guildId);
        if (connection.readyState === 1) { // Connected
            return connection;
        }
    }

    try {
        // Get server configuration
        const config = await ServerConfig.findOne({ guildId });
        let connectionString;

        if (config && config.mongodb.useCustom && config.mongodb.uri) {
            // Use custom MongoDB URI
            connectionString = config.getDecryptedMongoUri();
            if (!connectionString) {
                throw new Error('Failed to decrypt MongoDB URI');
            }
        } else {
            // Use default MongoDB URI
            connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017/dnd-transcriptions';
        }

        // Create new connection with server-specific database name
        const dbName = `dnd_${guildId}`;
        const serverConnectionString = connectionString.replace(/\/[^\/]*$/, `/${dbName}`);
        
        const connection = mongoose.createConnection(serverConnectionString, {
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000,
            maxPoolSize: 10,
            bufferCommands: false,
            bufferMaxEntries: 0
        });

        // Cache the connection
        serverConnections.set(guildId, connection);

        // Handle connection events
        connection.on('connected', () => {
            console.log(`[DB] Connected to MongoDB for guild ${guildId}`);
        });

        connection.on('error', (error) => {
            console.error(`[DB] MongoDB connection error for guild ${guildId}:`, error);
            serverConnections.delete(guildId);
        });

        connection.on('disconnected', () => {
            console.log(`[DB] Disconnected from MongoDB for guild ${guildId}`);
            serverConnections.delete(guildId);
        });

        return connection;

    } catch (error) {
        console.error(`[DB] Failed to create MongoDB connection for guild ${guildId}:`, error);
        throw error;
    }
}

/**
 * Get server-specific models using the server's connection
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Object>} - Object containing server-specific models
 */
export async function getServerModels(guildId) {
    const connection = await getServerConnection(guildId);
    
    // Define schemas for server-specific collections
    const summarySchema = new mongoose.Schema({
        guildId: { type: String, required: true },
        campaignId: { type: String, required: true },
        campaignName: { type: String, required: true },
        sessionNumber: { type: Number, required: true },
        summary: { type: String, required: true },
        cliffNotes: { type: String, required: true },
        participants: [{ type: String }],
        sessionDuration: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        metadata: { type: Object }
    }, { timestamps: true });

    const campaignSchema = new mongoose.Schema({
        guildId: { type: String, required: true },
        name: { type: String, required: true },
        dmUserId: { type: String, required: true },
        description: { type: String },
        sessionCount: { type: Number, default: 0 },
        createdAt: { type: Date, default: Date.now },
        isActive: { type: Boolean, default: true }
    }, { timestamps: true });

    const sessionStateSchema = new mongoose.Schema({
        guildId: { type: String, required: true },
        campaignName: { type: String, required: true },
        dmUserId: { type: String, required: true },
        language: { type: String, default: 'en' },
        startTime: { type: Date, required: true },
        endTime: { type: Date },
        status: { type: String, enum: ['active', 'paused', 'ended'], default: 'active' },
        transcription: { type: String },
        highlights: [{
            timestamp: Date,
            description: String
        }],
        characters: [{
            name: String,
            playerId: String,
            description: String
        }]
    }, { timestamps: true });

    // Create models using the server-specific connection
    const Summary = connection.model('Summary', summarySchema);
    const Campaign = connection.model('Campaign', campaignSchema);
    const SessionState = connection.model('SessionState', sessionStateSchema);

    return {
        Summary,
        Campaign,
        SessionState,
        connection
    };
}

/**
 * Close all server connections
 */
export function closeAllConnections() {
    for (const [guildId, connection] of serverConnections) {
        connection.close();
        console.log(`[DB] Closed connection for guild ${guildId}`);
    }
    serverConnections.clear();
}

/**
 * Close connection for a specific server
 * @param {string} guildId - Discord guild ID
 */
export function closeServerConnection(guildId) {
    if (serverConnections.has(guildId)) {
        const connection = serverConnections.get(guildId);
        connection.close();
        serverConnections.delete(guildId);
        console.log(`[DB] Closed connection for guild ${guildId}`);
    }
}

/**
 * Test MongoDB connection for a server
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Object>} - Test result
 */
export async function testServerConnection(guildId) {
    try {
        const connection = await getServerConnection(guildId);
        
        // Test basic operations
        const testCollection = connection.collection('connection_test');
        await testCollection.insertOne({ test: true, timestamp: new Date() });
        await testCollection.deleteOne({ test: true });
        
        return { valid: true, message: 'Connection successful' };
    } catch (error) {
        return { valid: false, error: error.message };
    }
}
