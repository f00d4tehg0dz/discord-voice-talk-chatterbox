#!/usr/bin/env python3
"""
Convert WAV files to Kokoro-compatible PT format.
This script converts WAV files to the format required by the Kokoro TTS system.

Requirements:
- Python 3.8+
- torch
- torchaudio
- numpy
- soundfile

Usage:
    python convert_wav_to_pt.py input.wav output.pt

The script will:
1. Load the WAV file
2. Convert to mono if stereo
3. Resample to 24000 Hz
4. Normalize the audio
5. Create a voice tensor with proper dimensions
6. Save as a PT file
"""

import os
import sys
import torch
import torchaudio
import numpy as np
import soundfile as sf
from pathlib import Path

def convert_wav_to_pt(wav_file: str, output_file: str) -> None:
    """
    Convert a WAV file to Kokoro-compatible PT format.
    
    Args:
        wav_file (str): Path to input WAV file
        output_file (str): Path to output PT file
    
    Requirements for input WAV:
    - Sample rate: Any (will be resampled to 24000 Hz)
    - Channels: Any (will be converted to mono)
    - Duration: 5-30 seconds recommended
    - Format: WAV
    - Quality: Clear audio with minimal background noise
    """
    print(f"Converting {wav_file} to {output_file}")
    
    try:
        # Load the WAV file
        waveform, sample_rate = torchaudio.load(wav_file)
        print(f"Loaded audio: {waveform.shape} at {sample_rate} Hz")
        
        # Convert to mono if stereo
        if waveform.shape[0] > 1:
            print("Converting stereo to mono")
            waveform = torch.mean(waveform, dim=0, keepdim=True)
        
        # Resample to 24000 Hz if needed
        if sample_rate != 24000:
            print(f"Resampling from {sample_rate} Hz to 24000 Hz")
            resampler = torchaudio.transforms.Resample(sample_rate, 24000)
            waveform = resampler(waveform)
        
        # Normalize the audio
        print("Normalizing audio")
        waveform = waveform / torch.max(torch.abs(waveform))
        
        # Create voice tensor with proper dimensions
        # Kokoro expects a tensor of shape [1, T] where T is the number of samples
        voice_tensor = waveform.squeeze(0)  # Remove channel dimension
        voice_tensor = voice_tensor.unsqueeze(0)  # Add batch dimension
        
        print(f"Created voice tensor with shape: {voice_tensor.shape}")
        
        # Save as PT file
        print(f"Saving to {output_file}")
        torch.save(voice_tensor, output_file)
        
        print("Conversion complete!")
        
    except Exception as e:
        print(f"Error converting file: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python convert_wav_to_pt.py input.wav output.pt")
        sys.exit(1)
    
    convert_wav_to_pt(sys.argv[1], sys.argv[2])