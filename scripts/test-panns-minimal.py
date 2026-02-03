#!/usr/bin/env python3
"""
Minimal PANNs test - classify one audio file
Import PANNs BEFORE loading audio
"""
import sys
print("Step 1: Importing PANNs first...", file=sys.stderr)
from panns_inference import AudioTagging, labels

print("Step 2: Other imports...", file=sys.stderr)
import librosa
import numpy as np

print("Step 3: Loading audio...", file=sys.stderr)
audio, sr = librosa.load('/tmp/opencode-boops-analysis/1000-scissors.ogg', sr=32000, mono=True)
print(f"  Loaded {len(audio)} samples at {sr}Hz", file=sys.stderr)

# Pad to 1 second minimum
if len(audio) < 32000:
    audio = np.pad(audio, (0, 32000 - len(audio)), mode='constant')
    print(f"  Padded to {len(audio)} samples", file=sys.stderr)

# Add batch dimension
audio = audio[None, :]
print(f"  Audio shape: {audio.shape}", file=sys.stderr)

print("Step 4: Initializing model...", file=sys.stderr)
at = AudioTagging(checkpoint_path=None, device='cpu')

print("Step 5: Running inference...", file=sys.stderr)
(clipwise_output, embedding) = at.inference(audio)

print("Step 6: Getting top predictions...", file=sys.stderr)
top_indices = clipwise_output[0].argsort()[-5:][::-1]

print("\nTop 5 predictions:", file=sys.stderr)
for idx in top_indices:
    print(f"  {labels[idx]}: {clipwise_output[0][idx]:.3f}", file=sys.stderr)

print("\nSuccess!")
