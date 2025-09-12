import mongoose from 'mongoose';
import LRUCache from 'lru-cache';
import 'dotenv/config';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables based on the environment
if (process.env.NODE_ENV === 'development') {
    config({ path: path.resolve(process.cwd(), '.env.local') });
} else {
    config({ path: path.resolve(process.cwd(), '.env') });
}

// Create a cache for session states
const sessionCache = new LRUCache({
    max: 100, // Maximum number of items to store
    ttl: 1000 * 60 * 5, // 5 minutes TTL
    updateAgeOnGet: true, // Update the age of an item when it is retrieved
    updateAgeOnHas: true // Update the age of an item when it is checked for existence
});

// Create a cache for summaries
const summaryCache = new LRUCache({
    max: 200, // Maximum number of items to store
    ttl: 1000 * 60 * 10, // 10 minutes TTL
    updateAgeOnGet: true,
    updateAgeOnHas: true
});

// Create a cache for campaigns
const campaignCache = new LRUCache({
    max: 50, // Maximum number of items to store
    ttl: 1000 * 60 * 15, // 15 minutes TTL
    updateAgeOnGet: true,
    updateAgeOnHas: true
});

// Define the MongoDB connection string from environment variable
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set');
}

// Cache the connection to prevent multiple connections
let cachedConnection = null;

/**
 * Connect to MongoDB
 * @returns {Promise<mongoose.Connection>} - The MongoDB connection
 */
export async function connectDB() {
    if (cachedConnection) {
        return cachedConnection;
    }

    try {
        const connection = await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 30000, // 30 seconds
            socketTimeoutMS: 45000, // 45 seconds
            connectTimeoutMS: 30000, // 30 seconds
            maxPoolSize: 10,
            minPoolSize: 1,
            family: 4,
            bufferCommands: false // Disable command buffering
        });
        
        // Set up error handling
        connection.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });
        
        connection.connection.on('disconnected', () => {
            console.log('MongoDB disconnected');
            cachedConnection = null;
        });
        
        connection.connection.on('reconnected', () => {
            console.log('MongoDB reconnected');
        });
        
        cachedConnection = connection.connection;
        return cachedConnection;
    } catch (err) {
        console.error('MongoDB connection error:', err);
        throw err;
    }
}

// Create Guild schema
const guildSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    voiceChannelId: { type: String, required: true },
    textChannelId: { type: String },
    summaryInterval: { type: Number, default: 30 * 60 * 1000 }, // Default 30 minutes
    isActive: { type: Boolean, default: true },
    campaignName: { type: String, default: 'DnD Campaign Session' },
    dmUserId: { type: String },
    registeredAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Create model from schema
const Guild = mongoose.model('Guild', guildSchema);

/**
 * Register a new guild or update an existing one
 * @param {string} guildId - Discord guild ID
 * @param {string} voiceChannelId - Voice channel to monitor
 * @param {string} textChannelId - Text channel for posting summaries
 * @returns {Promise<Object>} - The created or updated guild document
 */
export async function registerGuild(guildId, voiceChannelId, textChannelId = null) {
    try {
        // Try to find the guild first
        const existingGuild = await Guild.findOne({ guildId });
        
        if (existingGuild) {
            // Update existing guild
            existingGuild.voiceChannelId = voiceChannelId;
            if (textChannelId) existingGuild.textChannelId = textChannelId;
            existingGuild.isActive = true;
            existingGuild.updatedAt = Date.now();
            await existingGuild.save();
            return existingGuild;
        } else {
            // Create new guild
            const newGuild = new Guild({
                guildId,
                voiceChannelId,
                textChannelId
            });
            await newGuild.save();
            return newGuild;
        }
    } catch (error) {
        console.error('Error registering guild:', error);
        throw error;
    }
}

/**
 * Get guild configuration
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Object|null>} - Guild document or null if not found
 */
export async function getGuildConfig(guildId) {
    try {
        return await Guild.findOne({ guildId });
    } catch (error) {
        console.error('Error getting guild config:', error);
        return null;
    }
}

/**
 * Update guild summary interval
 * @param {string} guildId - Discord guild ID
 * @param {number} intervalMinutes - Summary interval in minutes
 * @returns {Promise<Object|null>} - Updated guild document or null if failed
 */
export async function updateSummaryInterval(guildId, intervalMinutes) {
    try {
        const guild = await Guild.findOne({ guildId });
        if (!guild) return null;
        
        guild.summaryInterval = intervalMinutes * 60 * 1000; // Convert to milliseconds
        guild.updatedAt = Date.now();
        await guild.save();
        return guild;
    } catch (error) {
        console.error('Error updating summary interval:', error);
        return null;
    }
}

/**
 * Get all active guilds
 * @returns {Promise<Array>} - Array of active guild documents
 */
export async function getAllActiveGuilds() {
    try {
        // Ensure database connection is established
        await connectDB();
        return await Guild.find({ isActive: true });
    } catch (error) {
        console.error('Error getting active guilds:', error);
        return [];
    }
}

/**
 * Deactivate a guild
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<boolean>} - Success status
 */
export async function deactivateGuild(guildId) {
    try {
        const guild = await Guild.findOne({ guildId });
        if (!guild) return false;
        
        guild.isActive = false;
        guild.updatedAt = Date.now();
        await guild.save();
        return true;
    } catch (error) {
        console.error('Error deactivating guild:', error);
        return false;
    }
}

/**
 * Set campaign name and DM for a guild
 * @param {string} guildId - Discord guild ID
 * @param {string} campaignName - Name of the campaign
 * @param {string} dmUserId - Discord user ID of the DM
 * @returns {Promise<Object>} - The updated guild document
 */
export async function setCampaignInfo(guildId, campaignName, dmUserId) {
    try {
        const guild = await Guild.findOne({ guildId });
        if (!guild) {
            throw new Error('Guild not found');
        }

        guild.campaignName = campaignName;
        guild.dmUserId = dmUserId;
        guild.updatedAt = new Date();
        await guild.save();
        return guild;
    } catch (error) {
        console.error('Error setting campaign info:', error);
        throw error;
    }
}

/**
 * Remove campaign name and DM for a guild
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Object>} - The updated guild document
 */
export async function removeCampaignInfo(guildId) {
    try {
        const guild = await Guild.findOne({ guildId });
        if (!guild) {
            throw new Error('Guild not found');
        }

        guild.campaignName = 'DnD Campaign Session';
        guild.dmUserId = null;
        guild.updatedAt = new Date();
        await guild.save();
        return guild;
    } catch (error) {
        console.error('Error removing campaign info:', error);
        throw error;
    }
}

// Add new functions for session caching
export async function getCachedSession(guildId) {
    const cacheKey = `session:${guildId}`;
    let session = sessionCache.get(cacheKey);
    
    if (!session) {
        session = await SessionState.findOne({ guildId, status: { $in: ['active', 'paused'] } });
        if (session) {
            sessionCache.set(cacheKey, session);
        }
    }
    
    return session;
}

export async function getCachedSummaries(guildId, campaignId = null, page = 1, limit = 10) {
    const cacheKey = `summaries:${guildId}:${campaignId || 'all'}:${page}:${limit}`;
    let summaries = summaryCache.get(cacheKey);
    
    if (!summaries) {
        const query = { guildId };
        if (campaignId) {
            query.campaignId = campaignId;
        }
        
        summaries = await Summary.find(query)
            .sort({ sessionNumber: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('campaignId')
            .populate('sessionId');
            
        if (summaries.length > 0) {
            summaryCache.set(cacheKey, summaries);
        }
    }
    
    return summaries;
}

export async function getCachedCampaign(guildId, campaignName) {
    const cacheKey = `campaign:${guildId}:${campaignName}`;
    let campaign = campaignCache.get(cacheKey);
    
    if (!campaign) {
        campaign = await Campaign.findOne({ guildId, name: campaignName });
        if (campaign) {
            campaignCache.set(cacheKey, campaign);
        }
    }
    
    return campaign;
}

// Add cache invalidation functions
export function invalidateSessionCache(guildId) {
    const cacheKey = `session:${guildId}`;
    sessionCache.delete(cacheKey);
}

export function invalidateSummariesCache(guildId, campaignId = null) {
    // Delete all summary cache entries for this guild
    const pattern = new RegExp(`^summaries:${guildId}:${campaignId ? campaignId : '.*'}:.*`);
    for (const key of summaryCache.keys()) {
        if (pattern.test(key)) {
            summaryCache.delete(key);
        }
    }
}

export function invalidateCampaignCache(guildId, campaignName) {
    const cacheKey = `campaign:${guildId}:${campaignName}`;
    campaignCache.delete(cacheKey);
} 