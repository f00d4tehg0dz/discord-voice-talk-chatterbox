import { SlashCommandBuilder } from 'discord.js';
import { testGpt4oTranscribe, getTranscriptionStats } from '../utils/transcription.js';

export const data = new SlashCommandBuilder()
    .setName('transcription')
    .setDescription('Manage transcription settings and check model status')
    .addSubcommand(subcommand =>
        subcommand
            .setName('status')
            .setDescription('Check current transcription model status and capabilities')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('test')
            .setDescription('Test GPT-4o-transcribe model availability')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('stats')
            .setDescription('Show detailed transcription model statistics')
    );

export async function execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    try {
        await interaction.deferReply();

        switch (subcommand) {
            case 'status': {
                const testResult = await testGpt4oTranscribe();
                const stats = getTranscriptionStats();

                const embed = {
                    color: testResult.available ? 0x00FF00 : 0xFFAA00,
                    title: '🎙️ Transcription Model Status',
                    fields: [
                        {
                            name: 'Primary Model',
                            value: stats.primaryModel,
                            inline: true
                        },
                        {
                            name: 'Fallback Model',
                            value: stats.fallbackModel,
                            inline: true
                        },
                        {
                            name: 'Status',
                            value: testResult.available ? '✅ Available' : '⚠️ Using Fallback',
                            inline: true
                        },
                        {
                            name: 'Message',
                            value: testResult.message,
                            inline: false
                        }
                    ],
                    timestamp: new Date().toISOString()
                };

                await interaction.editReply({ embeds: [embed] });
                break;
            }

            case 'test': {
                const testResult = await testGpt4oTranscribe();

                const embed = {
                    color: testResult.available ? 0x00FF00 : 0xFF0000,
                    title: '🔍 GPT-4o-transcribe Test Results',
                    fields: [
                        {
                            name: 'Model Availability',
                            value: testResult.available ? '✅ Available' : '❌ Not Available',
                            inline: true
                        },
                        {
                            name: 'Test Result',
                            value: testResult.message,
                            inline: false
                        }
                    ],
                    timestamp: new Date().toISOString()
                };

                if (testResult.available && testResult.model) {
                    embed.fields.push({
                        name: 'Model ID',
                        value: testResult.model,
                        inline: true
                    });
                }

                if (!testResult.available && testResult.fallback) {
                    embed.fields.push({
                        name: 'Fallback Model',
                        value: testResult.fallback,
                        inline: true
                    });
                }

                await interaction.editReply({ embeds: [embed] });
                break;
            }

            case 'stats': {
                const stats = getTranscriptionStats();

                const embed = {
                    color: 0x0099FF,
                    title: '📊 Transcription Model Statistics',
                    fields: [
                        {
                            name: 'Primary Model',
                            value: stats.primaryModel,
                            inline: true
                        },
                        {
                            name: 'Fallback Model',
                            value: stats.fallbackModel,
                            inline: true
                        },
                        {
                            name: 'Max File Size',
                            value: `${stats.maxFileSizeMB} MB`,
                            inline: true
                        },
                        {
                            name: 'Supported Formats',
                            value: stats.supportedFormats.join(', '),
                            inline: false
                        },
                        {
                            name: 'Language Support',
                            value: stats.supportedLanguages,
                            inline: false
                        },
                        {
                            name: 'Key Features',
                            value: stats.features.map(feature => `• ${feature}`).join('\\n'),
                            inline: false
                        }
                    ],
                    footer: {
                        text: 'GPT-4o-transcribe provides improved accuracy over traditional Whisper models'
                    },
                    timestamp: new Date().toISOString()
                };

                await interaction.editReply({ embeds: [embed] });
                break;
            }
        }

    } catch (error) {
        console.error(`[COMMAND] Error in transcription command:`, error);

        const errorMessage = {
            color: 0xFF0000,
            title: '❌ Command Error',
            description: 'Failed to execute transcription command. Please try again.',
            timestamp: new Date().toISOString()
        };

        try {
            await interaction.editReply({ embeds: [errorMessage] });
        } catch (editError) {
            console.error(`[COMMAND] Failed to send error response:`, editError);
        }
    }
}