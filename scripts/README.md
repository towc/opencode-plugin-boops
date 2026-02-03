# Scripts

Development scripts for maintaining the boops plugin.

## organize-sounds.js

Analyzes all 449 sounds by downloading them and using ffmpeg/ffprobe to generate descriptive tags.

**Requirements:**
- ffmpeg and ffprobe installed
- Internet connection to download sounds
- ~50MB disk space in `/tmp/opencode-boops-analysis/`

**Usage:**
```bash
# Test with first 10 sounds
TEST_LIMIT=10 node scripts/organize-sounds.js

# Test with first 50 sounds
TEST_LIMIT=50 node scripts/organize-sounds.js

# Process all 449 sounds (takes 10-15 minutes)
node scripts/organize-sounds.js
```

**What it does:**
1. Downloads each sound file to `/tmp/opencode-boops-analysis/`
2. Analyzes audio properties (duration, volume, frequency)
3. Generates semantic tags based on audio analysis + name patterns
4. Updates `sounds.json` with tags array for each sound

**Tags generated:**
- **Sound types**: beep, bell, click, whoosh, buzz, chirp
- **Human**: voice, speech, vocal sounds
- **Emotional**: positive, negative, neutral
- **Texture**: digital, realistic, mechanical, soft, sharp
- **Quality**: musical, percussion, rising, falling
- **Duration**: short (<0.3s), long (>2s)
- **Volume**: loud, quiet
- **Special**: weird, glitch

**Note:** This script takes a while to run (~10-15 minutes for all sounds).
