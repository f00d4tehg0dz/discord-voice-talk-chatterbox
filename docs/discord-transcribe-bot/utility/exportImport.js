import { Summary } from '../models/Summary.js';
import { Campaign } from '../models/Campaign.js';
import { SessionState } from '../models/SessionState.js';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { pipeline } from 'stream';
import { createGzip } from 'zlib';

const pipelineAsync = promisify(pipeline);

export async function exportCampaignData(guildId, campaignId) {
    try {
        // Get campaign data
        const campaign = await Campaign.findOne({ _id: campaignId, guildId });
        if (!campaign) {
            throw new Error('Campaign not found');
        }

        // Get all summaries for the campaign
        const summaries = await Summary.find({ guildId, campaignId })
            .populate('sessionId')
            .sort({ sessionNumber: 1 });

        // Get all session states for the campaign
        const sessions = await SessionState.find({ guildId, campaignName: campaign.name });

        // Prepare export data
        const exportData = {
            campaign: {
                name: campaign.name,
                dmUserId: campaign.dmUserId,
                createdAt: campaign.createdAt,
                updatedAt: campaign.updatedAt
            },
            summaries: summaries.map(summary => ({
                sessionNumber: summary.sessionNumber,
                sessionStart: summary.sessionStart,
                sessionEnd: summary.sessionEnd,
                participants: summary.participants,
                encryptedSummary: summary.encryptedSummary,
                encryptedCliffNotes: summary.encryptedCliffNotes
            })),
            sessions: sessions.map(session => ({
                startTime: session.startTime,
                endTime: session.endTime,
                status: session.status,
                transcription: session.transcription,
                highlights: session.highlights,
                characters: session.characters
            }))
        };

        // Create export directory if it doesn't exist
        const exportDir = path.join(process.cwd(), 'exports');
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir);
        }

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `campaign_${campaign.name.replace(/[^a-z0-9]/gi, '_')}_${timestamp}.json.gz`;
        const filePath = path.join(exportDir, filename);

        // Write and compress the data
        const writeStream = fs.createWriteStream(filePath);
        const gzipStream = createGzip();
        
        await pipelineAsync(
            fs.createReadStream(Buffer.from(JSON.stringify(exportData))),
            gzipStream,
            writeStream
        );

        return {
            success: true,
            filePath,
            filename
        };
    } catch (error) {
        console.error('Error exporting campaign data:', error);
        throw error;
    }
}

export async function importCampaignData(guildId, filePath) {
    try {
        // Read and decompress the file
        const readStream = fs.createReadStream(filePath);
        const gunzip = createGzip();
        const chunks = [];
        
        await pipelineAsync(
            readStream,
            gunzip,
            async function* (source) {
                for await (const chunk of source) {
                    chunks.push(chunk);
                }
            }
        );

        const importData = JSON.parse(Buffer.concat(chunks).toString());

        // Create or update campaign
        const campaign = await Campaign.findOneAndUpdate(
            { guildId, name: importData.campaign.name },
            {
                dmUserId: importData.campaign.dmUserId,
                updatedAt: new Date()
            },
            { upsert: true, new: true }
        );

        // Import summaries
        for (const summaryData of importData.summaries) {
            await Summary.findOneAndUpdate(
                {
                    guildId,
                    campaignId: campaign._id,
                    sessionNumber: summaryData.sessionNumber
                },
                {
                    sessionStart: summaryData.sessionStart,
                    sessionEnd: summaryData.sessionEnd,
                    participants: summaryData.participants,
                    encryptedSummary: summaryData.encryptedSummary,
                    encryptedCliffNotes: summaryData.encryptedCliffNotes,
                    updatedAt: new Date()
                },
                { upsert: true }
            );
        }

        // Import sessions
        for (const sessionData of importData.sessions) {
            await SessionState.findOneAndUpdate(
                {
                    guildId,
                    campaignName: campaign.name,
                    startTime: sessionData.startTime
                },
                {
                    endTime: sessionData.endTime,
                    status: sessionData.status,
                    transcription: sessionData.transcription,
                    highlights: sessionData.highlights,
                    characters: sessionData.characters,
                    updatedAt: new Date()
                },
                { upsert: true }
            );
        }

        return {
            success: true,
            campaignId: campaign._id,
            summaryCount: importData.summaries.length,
            sessionCount: importData.sessions.length
        };
    } catch (error) {
        console.error('Error importing campaign data:', error);
        throw error;
    }
}

export async function listExports() {
    try {
        const exportDir = path.join(process.cwd(), 'exports');
        if (!fs.existsSync(exportDir)) {
            return [];
        }

        const files = fs.readdirSync(exportDir)
            .filter(file => file.endsWith('.json.gz'))
            .map(file => {
                const stats = fs.statSync(path.join(exportDir, file));
                return {
                    filename: file,
                    size: stats.size,
                    createdAt: stats.birthtime,
                    modifiedAt: stats.mtime
                };
            });

        return files;
    } catch (error) {
        console.error('Error listing exports:', error);
        throw error;
    }
}

export async function deleteExport(filename) {
    try {
        const filePath = path.join(process.cwd(), 'exports', filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return { success: true };
        }
        throw new Error('Export file not found');
    } catch (error) {
        console.error('Error deleting export:', error);
        throw error;
    }
} 