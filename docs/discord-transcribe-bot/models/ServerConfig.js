import mongoose from 'mongoose';
import crypto from 'crypto';

const serverConfigSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        unique: true
    },
    openaiApiKey: {
        type: String,
        required: false // Will be encrypted
    },
    voiceChannelId: {
        type: String,
        required: false
    },
    textChannelId: {
        type: String,
        required: false
    },
    summaryInterval: {
        type: Number,
        default: 30 // minutes
    },
    isActive: {
        type: Boolean,
        default: false
    },
    settings: {
        language: {
            type: String,
            default: 'en'
        },
        autoJoin: {
            type: Boolean,
            default: true
        },
        transcriptionEnabled: {
            type: Boolean,
            default: true
        },
        summaryEnabled: {
            type: Boolean,
            default: true
        }
    },
    mongodb: {
        uri: {
            type: String,
            required: false // Will be encrypted
        },
        useCustom: {
            type: Boolean,
            default: false
        }
    }
}, {
    timestamps: true
});

// Encrypt sensitive data before saving
serverConfigSchema.pre('save', function(next) {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
        return next(new Error('ENCRYPTION_KEY environment variable is not set'));
    }
    
    try {
        const keyBuffer = Buffer.from(encryptionKey, 'base64');
        
        // Encrypt API key if modified
        if (this.isModified('openaiApiKey') && this.openaiApiKey) {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
            
            let encrypted = cipher.update(this.openaiApiKey, 'utf8', 'base64');
            encrypted += cipher.final('base64');
            const authTag = cipher.getAuthTag();
            
            // Store encrypted data with IV and auth tag
            this.openaiApiKey = JSON.stringify({
                iv: iv.toString('base64'),
                encryptedData: encrypted,
                authTag: authTag.toString('base64')
            });
        }
        
        // Encrypt MongoDB URI if modified
        if (this.isModified('mongodb.uri') && this.mongodb.uri) {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
            
            let encrypted = cipher.update(this.mongodb.uri, 'utf8', 'base64');
            encrypted += cipher.final('base64');
            const authTag = cipher.getAuthTag();
            
            // Store encrypted data with IV and auth tag
            this.mongodb.uri = JSON.stringify({
                iv: iv.toString('base64'),
                encryptedData: encrypted,
                authTag: authTag.toString('base64')
            });
        }
    } catch (error) {
        return next(new Error('Failed to encrypt sensitive data: ' + error.message));
    }
    next();
});

// Generic decryption method
function decryptField(encryptedField) {
    if (!encryptedField) {
        return null;
    }
    
    try {
        const encryptionKey = process.env.ENCRYPTION_KEY;
        if (!encryptionKey) {
            throw new Error('ENCRYPTION_KEY environment variable is not set');
        }
        
        const keyBuffer = Buffer.from(encryptionKey, 'base64');
        const encryptedData = JSON.parse(encryptedField);
        
        const iv = Buffer.from(encryptedData.iv, 'base64');
        const authTag = Buffer.from(encryptedData.authTag, 'base64');
        const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encryptedData.encryptedData, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        console.error('Failed to decrypt field:', error.message);
        return null;
    }
}

// Decrypt API key when retrieving
serverConfigSchema.methods.getDecryptedApiKey = function() {
    return decryptField(this.openaiApiKey);
};

// Decrypt MongoDB URI when retrieving
serverConfigSchema.methods.getDecryptedMongoUri = function() {
    return decryptField(this.mongodb.uri);
};

// Static method to get server config with decrypted API key
serverConfigSchema.statics.getServerConfig = async function(guildId) {
    const config = await this.findOne({ guildId });
    if (config && config.openaiApiKey) {
        config.openaiApiKey = config.getDecryptedApiKey();
    }
    return config;
};

// Validate API key format
serverConfigSchema.methods.validateApiKey = function(apiKey) {
    if (!apiKey) return false;
    // OpenAI API keys start with 'sk-' and are typically 51 characters long
    return /^sk-[a-zA-Z0-9]{48}$/.test(apiKey);
};

// Test API key with OpenAI
serverConfigSchema.methods.testApiKey = async function(apiKey) {
    try {
        const response = await fetch('https://api.openai.com/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            // Check if Whisper model is available
            const hasWhisper = data.data.some(model => model.id.includes('whisper'));
            return { valid: true, hasWhisper };
        } else {
            return { valid: false, error: `HTTP ${response.status}` };
        }
    } catch (error) {
        return { valid: false, error: error.message };
    }
};

// Validate MongoDB URI format
serverConfigSchema.methods.validateMongoUri = function(uri) {
    if (!uri) return false;
    // Basic MongoDB URI validation
    const mongoUriRegex = /^mongodb(\+srv)?:\/\/([^:]+):([^@]+)@([^\/]+)\/(.+)$/;
    return mongoUriRegex.test(uri);
};

// Test MongoDB connection
serverConfigSchema.methods.testMongoConnection = async function(uri) {
    try {
        const mongoose = require('mongoose');
        
        // Create a temporary connection to test
        const testConnection = mongoose.createConnection(uri, {
            serverSelectionTimeoutMS: 5000, // 5 second timeout
            connectTimeoutMS: 5000
        });
        
        // Wait for connection
        await new Promise((resolve, reject) => {
            testConnection.on('connected', resolve);
            testConnection.on('error', reject);
            setTimeout(() => reject(new Error('Connection timeout')), 5000);
        });
        
        // Test basic operations
        const testCollection = testConnection.collection('connection_test');
        await testCollection.insertOne({ test: true, timestamp: new Date() });
        await testCollection.deleteOne({ test: true });
        
        // Close the test connection
        await testConnection.close();
        
        return { valid: true, message: 'Connection successful' };
    } catch (error) {
        return { valid: false, error: error.message };
    }
};

const ServerConfig = mongoose.model('ServerConfig', serverConfigSchema);

export { ServerConfig };
