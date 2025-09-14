import { SlashCommandBuilder } from 'discord.js';
import { config } from '../utils/config.js';

export const data = new SlashCommandBuilder()
    .setName('audiofilter')
    .setDescription('Manage audio filtering and noise detection settings')
    .addSubcommand(subcommand =>
        subcommand
            .setName('status')
            .setDescription('Show current audio filtering configuration and statistics')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('settings')
            .setDescription('Display detailed audio filtering threshold settings')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('test')
            .setDescription('Test current audio filtering settings with sample thresholds')
    );

export async function execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    try {
        await interaction.deferReply();

        switch (subcommand) {
            case 'status': {
                const embed = {
                    color: 0x0099FF,
                    title: '🔊 Audio Filtering Status',
                    description: 'Current audio filtering and noise detection configuration',
                    fields: [
                        {
                            name: 'Audio Level Thresholds',
                            value: [
                                `**Silence Threshold**: ${config.audioFilter.silenceThreshold} (${(config.audioFilter.silenceThreshold * 100).toFixed(1)}%)`,
                                `**Noise Threshold**: ${config.audioFilter.noiseThreshold} (${(config.audioFilter.noiseThreshold * 100).toFixed(1)}%)`,
                                `**Peak Threshold**: ${config.audioFilter.peakThreshold} (${(config.audioFilter.peakThreshold * 100).toFixed(1)}%)`
                            ].join('\\n'),
                            inline: false
                        },
                        {
                            name: 'Duration & Confidence',
                            value: [
                                `**Min Duration**: ${config.audioFilter.minDurationMs}ms`,
                                `**Min Confidence**: ${config.audioFilter.minConfidence} (${(config.audioFilter.minConfidence * 100).toFixed(1)}%)`,
                                `**Single Word Confidence**: ${config.audioFilter.singleWordConfidenceThreshold} (${(config.audioFilter.singleWordConfidenceThreshold * 100).toFixed(1)}%)`
                            ].join('\\n'),
                            inline: false
                        },
                        {
                            name: 'Filtering Features',
                            value: [
                                '✅ Real-time audio level analysis',
                                '✅ Silence and background noise detection',
                                '✅ Transcription content validation',
                                '✅ Confidence-based filtering',
                                '✅ Noise pattern recognition',
                                '✅ Duration-based filtering'
                            ].join('\\n'),
                            inline: false
                        }
                    ],
                    footer: {
                        text: 'These settings help prevent the bot from responding to empty noise, silence, or meaningless audio'
                    },
                    timestamp: new Date().toISOString()
                };

                await interaction.editReply({ embeds: [embed] });
                break;
            }

            case 'settings': {
                const embed = {
                    color: 0x00FF00,
                    title: '⚙️ Audio Filter Settings',
                    description: 'Detailed configuration thresholds for audio filtering',
                    fields: [
                        {
                            name: 'Audio Analysis Thresholds',
                            value: [
                                `\`AUDIO_SILENCE_THRESHOLD\`: ${config.audioFilter.silenceThreshold}`,
                                `\`AUDIO_NOISE_THRESHOLD\`: ${config.audioFilter.noiseThreshold}`,
                                `\`AUDIO_PEAK_THRESHOLD\`: ${config.audioFilter.peakThreshold}`,
                                `\`AUDIO_MIN_DURATION_MS\`: ${config.audioFilter.minDurationMs}ms`
                            ].join('\\n'),
                            inline: false
                        },
                        {
                            name: 'Transcription Validation',
                            value: [
                                `\`TRANSCRIPTION_MIN_CONFIDENCE\`: ${config.audioFilter.minConfidence}`,
                                `\`SINGLE_WORD_CONFIDENCE_THRESHOLD\`: ${config.audioFilter.singleWordConfidenceThreshold}`
                            ].join('\\n'),
                            inline: false
                        },
                        {
                            name: 'Environment Variable Configuration',
                            value: [
                                'Add these to your `.env` file to customize thresholds:',
                                '',
                                '```env',
                                '# Audio level thresholds (0.0-1.0)',
                                'AUDIO_SILENCE_THRESHOLD=0.01',
                                'AUDIO_NOISE_THRESHOLD=0.05',
                                'AUDIO_PEAK_THRESHOLD=0.1',
                                '',
                                '# Duration and confidence',
                                'AUDIO_MIN_DURATION_MS=170',
                                'TRANSCRIPTION_MIN_CONFIDENCE=0.3',
                                'SINGLE_WORD_CONFIDENCE_THRESHOLD=0.7',
                                '```'
                            ].join('\\n'),
                            inline: false
                        }
                    ],
                    footer: {
                        text: 'Lower values = more sensitive, Higher values = more strict filtering'
                    },
                    timestamp: new Date().toISOString()
                };

                await interaction.editReply({ embeds: [embed] });
                break;
            }

            case 'test': {
                // Simulate different audio scenarios
                const testResults = [
                    {
                        scenario: 'Silent audio',
                        volume: 0.005,
                        peak: 0.001,
                        duration: 0.5,
                        confidence: 0.1,
                        shouldFilter: true
                    },
                    {
                        scenario: 'Background noise',
                        volume: 0.03,
                        peak: 0.08,
                        duration: 0.8,
                        confidence: 0.25,
                        shouldFilter: true
                    },
                    {
                        scenario: 'Whisper speech',
                        volume: 0.08,
                        peak: 0.15,
                        duration: 1.2,
                        confidence: 0.75,
                        shouldFilter: false
                    },
                    {
                        scenario: 'Normal speech',
                        volume: 0.25,
                        peak: 0.4,
                        duration: 2.0,
                        confidence: 0.90,
                        shouldFilter: false
                    }
                ];

                const results = testResults.map(test => {
                    const audioFilter = test.volume < config.audioFilter.silenceThreshold ||
                        (test.volume < config.audioFilter.noiseThreshold && test.peak < config.audioFilter.peakThreshold) ||
                        test.duration < (config.audioFilter.minDurationMs / 1000);

                    const transcriptionFilter = test.confidence < config.audioFilter.minConfidence;

                    const wouldFilter = audioFilter || transcriptionFilter;
                    const status = wouldFilter ? '🚫 FILTERED' : '✅ PASSED';

                    return `**${test.scenario}**: ${status}\\n` +
                        `Volume: ${test.volume.toFixed(3)}, Peak: ${test.peak.toFixed(3)}, Duration: ${test.duration}s, Confidence: ${test.confidence}`;
                });

                const embed = {
                    color: 0xFFAA00,
                    title: '🧪 Audio Filter Test Results',
                    description: 'Simulated test scenarios with current filter settings',
                    fields: [
                        {
                            name: 'Test Scenarios',
                            value: results.join('\\n\\n'),
                            inline: false
                        },
                        {
                            name: 'Filter Logic',
                            value: [
                                '**Audio Level Filter**: Blocks very quiet or background noise',
                                '**Duration Filter**: Blocks very short audio clips',
                                '**Confidence Filter**: Blocks low-confidence transcriptions',
                                '**Content Filter**: Blocks common noise patterns and gibberish'
                            ].join('\\n'),
                            inline: false
                        }
                    ],
                    footer: {
                        text: 'These tests show how different audio scenarios would be handled by the current filter settings'
                    },
                    timestamp: new Date().toISOString()
                };

                await interaction.editReply({ embeds: [embed] });
                break;
            }
        }

    } catch (error) {
        console.error(`[COMMAND] Error in audiofilter command:`, error);

        const errorMessage = {
            color: 0xFF0000,
            title: '❌ Command Error',
            description: 'Failed to execute audio filter command. Please try again.',
            timestamp: new Date().toISOString()
        };

        try {
            await interaction.editReply({ embeds: [errorMessage] });
        } catch (editError) {
            console.error(`[COMMAND] Failed to send error response:`, editError);
        }
    }
}