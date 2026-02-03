#!/usr/bin/env python3
"""
Use PANNs to classify audio files
Returns JSON with predicted sound classes and confidence scores

IMPORTANT: Must import panns_inference BEFORE librosa to avoid conflicts
"""
import sys
import json
import io
import os

# Suppress PANNs initialization messages
_original_stdout = sys.stdout
_original_stderr = sys.stderr
sys.stdout = open(os.devnull, 'w')
sys.stderr = open(os.devnull, 'w')

# Import PANNs first (before librosa) to avoid library conflicts
from panns_inference import AudioTagging, labels

# Restore stdout/stderr
sys.stdout.close()
sys.stderr.close()
sys.stdout = _original_stdout
sys.stderr = _original_stderr

# Now import other libraries
import librosa
import numpy as np

def classify_audio(file_path):
    """Classify audio file and return top predictions"""
    try:
        # Load audio at 32kHz (PANNs default)
        audio, sr = librosa.load(file_path, sr=32000, mono=True)
        
        # Pad audio to at least 1 second (32000 samples) if needed
        if len(audio) < 32000:
            audio = np.pad(audio, (0, 32000 - len(audio)), mode='constant')
        
        # Add batch dimension
        audio = audio[None, :]
        
        # Initialize model and run inference
        at = AudioTagging(checkpoint_path=None, device='cpu')
        (clipwise_output, embedding) = at.inference(audio)
        
        # Get top 10 predictions
        top_indices = clipwise_output[0].argsort()[-10:][::-1]
        
        results = []
        for idx in top_indices:
            results.append({
                'label': labels[idx],
                'score': float(clipwise_output[0][idx])
            })
        
        return results
    except Exception as e:
        import traceback
        return {'error': str(e), 'traceback': traceback.format_exc()}

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(json.dumps({'error': 'Usage: classify-audio-panns.py <audio_file>'}))
        sys.exit(1)
    
    file_path = sys.argv[1]
    results = classify_audio(file_path)
    
    # Print JSON to stdout (checkpoint messages go to stderr)
    print(json.dumps(results), flush=True)
