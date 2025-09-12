import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';

/**
 * Ensures the PCM file is valid and has proper headers/format
 * @param {string} inputFilePath - Path to the PCM file
 * @returns {Promise<boolean>} - Whether the file is valid
 */
const validatePCMFile = (inputFilePath) => {
	try {
		if (!fs.existsSync(inputFilePath)) {
			console.error(`Input file does not exist: ${inputFilePath}`);
			return false;
		}
		
		const stats = fs.statSync(inputFilePath);
		
		// PCM files should be at least 960 bytes (minimum valid opus frame size)
		if (stats.size < 960) {
			console.error(`Input file too small: ${inputFilePath} (${stats.size} bytes)`);
			return false;
		}
		
		return true;
	} catch (error) {
		console.error('Error validating PCM file:', error);
		return false;
	}
};

/**
 * Converts PCM audio file to WAV format
 * @param {string} inputFilePath - Path to the input PCM file
 * @param {string} outputFilePath - Path to save the output WAV file
 * @returns {Promise<string>} - Path to the converted WAV file
 */
const convertToWav = (inputFilePath, outputFilePath) => {
	return new Promise((resolve, reject) => {
		// Make sure the input file exists and has content
		if (!validatePCMFile(inputFilePath)) {
			return reject(new Error(`Invalid PCM file: ${inputFilePath}`));
		}
		
		const stats = fs.statSync(inputFilePath);
		console.log(`Converting ${inputFilePath} to WAV format, size: ${stats.size} bytes`);
		
		// Create temporary directory if it doesn't exist
		const tempDir = path.join(path.dirname(outputFilePath), 'temp');
		if (!fs.existsSync(tempDir)) {
			fs.mkdirSync(tempDir);
		}
		
		// Use a temporary output file to avoid potential file locking issues
		const tempOutputPath = path.join(tempDir, path.basename(outputFilePath));
		
		ffmpeg(inputFilePath)
			.inputFormat('s16le')
			.inputOptions([
				'-ar 48000',  // Sample rate
				'-ac 1',      // Mono audio
			])
			.outputOptions([
				'-acodec pcm_s16le'
			])
			.save(tempOutputPath)
			.on('end', () => {
				try {
					// Check if the converted file exists and has content
					if (fs.existsSync(tempOutputPath)) {
						const outStats = fs.statSync(tempOutputPath);
						
						if (outStats.size > 0) {
							// Copy the temp file to the final destination
							fs.copyFileSync(tempOutputPath, outputFilePath);
							// Clean up temp file
							fs.unlinkSync(tempOutputPath);
							
							console.log(`Successfully converted to WAV: ${outputFilePath} (${outStats.size} bytes)`);
							resolve(outputFilePath);
						} else {
							reject(new Error(`Output WAV file is empty: ${tempOutputPath}`));
						}
					} else {
						reject(new Error(`Output WAV file not created: ${tempOutputPath}`));
					}
				} catch (err) {
					reject(new Error(`Error finalizing WAV conversion: ${err.message}`));
				}
			})
			.on('error', (err) => {
				console.error('Error during conversion:', err);
				reject(err);
			});
	});
};

// Inside your subscription's 'finish' event handler
const handleAudioCapture = async (filePath, userName, userId) => {
	console.log(`Audio capture finished for ${userName}, sending to Whisper...`);
	const wavFilePath = path.join(__dirname, `audio_${userId}.wav`);

	try {
		await convertToWav(filePath, wavFilePath);
		const transcription = await createWhisperTranscription(wavFilePath);
		console.log(`${userName}: ${transcription}`);
		storeTranscription(userId, transcription);
		//fs.unlinkSync(filePath);
		//fs.unlinkSync(wavFilePath);
		
	} catch (error) {
		console.error('Error during audio conversion or transcription:', error);
	}
};

export { convertToWav, handleAudioCapture };