#!/usr/bin/env node
"""
Test PANNs audio classification on a few notification sounds
"""
import sys
from panns_inference import AudioTagging, SoundEventDetection, labels

# Print all available labels
print(f"PANNs can detect {len(labels)} sound classes:")
print("\nRelevant classes for notification sounds:")
relevant = ['Speech', 'Bell', 'Chime', 'Click', 'Beep', 'Ding', 'Buzz', 'Ping', 'Pop', 'Tap',
            'Human voice', 'Male speech', 'Female speech', 'Laughter', 'Whoop',
            'Telephone bell ringing', 'Alarm', 'Buzzer', 'Ringtone']
for i, label in enumerate(labels):
    if any(rel.lower() in label.lower() for rel in relevant):
        print(f"  [{i}] {label}")

# Test on a few sounds
at = AudioTagging(checkpoint_path=None, device='cpu')

test_sounds = [
    ('scissors', 'https://notificationsounds.com/storage/sounds/file-sounds-1000-scissors.ogg'),
    ('hey champ', 'https://notificationsounds.com/storage/sounds/file-sounds-1032-hey-champ.ogg'),
    ('cant do that', 'https://notificationsounds.com/storage/sounds/file-sounds-1017-cant-do-that.ogg'),
]

print("\n\nTesting audio classification:")
import tempfile
import urllib.request

for name, url in test_sounds:
    print(f"\n{name}:")
    # Download to temp file
    with tempfile.NamedTemporaryFile(suffix='.ogg', delete=False) as f:
        urllib.request.urlretrieve(url, f.name)
        
        # Classify
        (clipwise_output, embedding) = at.inference(f.name)
        
        # Get top 5 predictions
        top5_indices = clipwise_output[0].argsort()[-5:][::-1]
        for idx in top5_indices:
            print(f"  {labels[idx]}: {clipwise_output[0][idx]:.3f}")
