#!/usr/bin/env node
/**
 * Download and analyze audio files to generate descriptive tags using PANNs (Pretrained Audio Neural Networks)
 * This will take a while - analyzing 444 sounds with deep learning!
 * 
 * PANNs is trained on AudioSet with 527 sound classes and achieves 43.9% mAP.
 * It can accurately detect: speech, bells, clicks, beeps, buzzes, and many more.
 * 
 * Usage: 
 *   node scripts/organize-sounds.js
 *   TEST_LIMIT=10 node scripts/organize-sounds.js
 * 
 * Requirements:
 *   - Python 3 with panns_inference installed: pip install panns_inference
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import https from 'https';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const execAsync = promisify(exec);

const soundsPath = path.join(projectRoot, 'sounds.json');
const allSounds = JSON.parse(readFileSync(soundsPath, 'utf-8'));

// For testing: limit to first N sounds or test a specific sound by name
const TEST_LIMIT = process.env.TEST_LIMIT ? parseInt(process.env.TEST_LIMIT) : null;
const TEST_SOUND = process.env.TEST_SOUND;

let sounds;
if (TEST_SOUND) {
  // Test a specific sound by name (don't reset all tags, just this one)
  const targetSound = allSounds.find(s => s.name.toLowerCase() === TEST_SOUND.toLowerCase());
  if (!targetSound) {
    console.error(`Error: Sound "${TEST_SOUND}" not found`);
    console.error(`Try one of: ${allSounds.slice(0, 10).map(s => s.name).join(', ')}...`);
    process.exit(1);
  }
  targetSound.tags = []; // Only reset this sound's tags
  sounds = [targetSound];
} else {
  // Reset all tags before full/partial analysis
  console.log('Resetting all existing tags...');
  allSounds.forEach(sound => {
    sound.tags = [];
  });
  sounds = TEST_LIMIT ? allSounds.slice(0, TEST_LIMIT) : allSounds;
}

const cacheDir = '/tmp/opencode-boops-analysis';
mkdirSync(cacheDir, { recursive: true });

console.log(`Processing ${sounds.length} sound${sounds.length === 1 ? '' : 's'}...`);
if (TEST_SOUND) {
  console.log(`(Test mode: analyzing single sound "${TEST_SOUND}")\n`);
} else if (TEST_LIMIT) {
  console.log(`(Test mode: limited to first ${TEST_LIMIT} sounds)\n`);
}

// Download a sound file
async function downloadSound(url, id) {
  const cachePath = path.join(cacheDir, `${id}.ogg`);
  
  if (existsSync(cachePath)) {
    return cachePath;
  }
  
  return new Promise((resolve, reject) => {
    const file = [];
    https.get(url, (response) => {
      response.on('data', (chunk) => file.push(chunk));
      response.on('end', () => {
        writeFileSync(cachePath, Buffer.concat(file));
        resolve(cachePath);
      });
    }).on('error', reject);
  });
}

// Analyze audio properties using ffprobe (for duration/volume only)
async function analyzeAudioProperties(filePath) {
  try {
    // Get duration
    const { stdout: durationOutput } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of json "${filePath}"`
    );
    const duration = JSON.parse(durationOutput)?.format?.duration;
    
    // Get RMS volume
    const { stdout: rmsOutput } = await execAsync(
      `ffmpeg -i "${filePath}" -af astats -f null /dev/null 2>&1 | grep "RMS level dB:" | head -1`
    );
    const rmsMatch = rmsOutput.match(/RMS level dB: (-?\d+\.?\d*)/);
    const rms = rmsMatch ? parseFloat(rmsMatch[1]) : null;
    
    return { duration: duration ? parseFloat(duration) : null, rms };
  } catch (e) {
    return { duration: null, rms: null };
  }
}

// Track all discovered tags across batches
const discoveredTags = new Set([
  // Initial reference tags
  'bell', 'click', 'buzz', 'ping', 'snap', 'thud', 'squeak', 'pop', 'whoosh', 'chime', 'ding',
  'human', 'voice', 'vocal', 'speech',
  'positive', 'negative', 'weird',
  'sharp', 'soft', 'harsh', 'warm', 'metallic', 'organic', 'mechanical', 'realistic', 'smooth',
  'musical', 'percussion', 'rhythmic',
  'rising', 'falling', 'bouncing', 'pulsing',
  'short', 'long', 'quiet', 'loud',
  'glitch', 'retro', 'futuristic'
]);

// Use PANNs (Pretrained Audio Neural Networks) to classify audio
async function analyzeWithAI(filePath, soundName) {
  try {
    // Call Python script with PANNs
    // Use tail -1 to get only the JSON output line (ignoring PANNs init messages)
    const pythonScript = path.join(__dirname, 'classify-audio-panns.py');
    const { stdout } = await execAsync(`python3 "${pythonScript}" "${filePath}" 2>&1 | tail -1`);
    
    const predictions = JSON.parse(stdout.trim());
    
    if (predictions.error) {
      console.error(`  PANNs classification failed: ${predictions.error}`);
      return { tags: [], panns: [] };
    }
    
    // Return both raw PANNs predictions and processed tags
    return { tags: [], panns: predictions }; // We'll process tags later
    
    // Just return raw predictions - we'll process them later
    if (predictions.length === 0) return { tags: [], panns: [] };
    
    return { tags: [], panns: predictions };
  } catch (e) {
    console.error(`  PANNs analysis failed: ${e.message}`);
    return [];
  }
}

// Analyze and tag a sound
async function analyzeSound(sound, index) {
  console.log(`[${index + 1}/${sounds.length}] Analyzing: ${sound.name}`);
  
  const tags = new Set();
  
  try {
    const filePath = await downloadSound(sound.url, sound.id);
    
    // Get audio properties (duration, volume)
    const { duration, rms } = await analyzeAudioProperties(filePath);
    
    // Duration-based tags
    if (duration !== null) {
      if (duration < 0.3) tags.add('short');
      else if (duration > 2) tags.add('long');
    }
    
    // Volume-based tags (RMS in dB - typical notification sounds range from -5 to -25)
    if (rms !== null) {
      if (rms > -12) tags.add('loud');
      else if (rms < -20) tags.add('quiet');
    }
    
    // AI semantic analysis - get raw PANNs output
    const aiResult = await analyzeWithAI(filePath, sound.name);
    
    console.log(`  Technical tags: ${Array.from(tags).sort().join(', ')}`);
    console.log(`  PANNs top 3: ${aiResult.panns.slice(0, 3).map(p => `${p.label}(${(p.score * 100).toFixed(1)}%)`).join(', ')}`);
    
    return { 
      tags: Array.from(tags).sort(),
      panns: aiResult.panns
    };
  } catch (e) {
    console.error(`  Failed to analyze: ${e.message}`);
    return { tags: [], panns: [] };
  }
}

// Compact similar tags to avoid redundancy
function compactTags(tags) {
  const tagMap = {
    // Consolidate similar sound types
    'beep': ['beep', 'boop', 'blip'],
    'bell': ['bell', 'chime', 'ding'],
    'click': ['click', 'tap', 'pop'],
    'whoosh': ['whoosh', 'swoosh', 'swish'],
    
    // Consolidate texture descriptors
    'digital': ['digital', 'electronic', 'synthetic'],
    'mechanical': ['mechanical', 'robotic'],
    'soft': ['soft', 'gentle', 'mellow', 'smooth'],
    'sharp': ['sharp', 'crisp', 'bright'],
    
    // Consolidate musical terms
    'musical': ['musical', 'melodic', 'harmonic'],
    
    // Motion
    'rising': ['rising', 'ascending'],
    'falling': ['falling', 'descending'],
    
    // Special
    'retro': ['retro', '8bit', 'arcade'],
    'weird': ['weird', 'strange', 'odd', 'unusual', 'quirky']
  };
  
  const result = new Set();
  const used = new Set();
  
  for (const tag of tags) {
    if (used.has(tag)) continue;
    
    // Check if this tag should be consolidated
    let foundMapping = false;
    for (const [canonical, variants] of Object.entries(tagMap)) {
      if (variants.includes(tag)) {
        result.add(canonical);
        variants.forEach(v => used.add(v));
        foundMapping = true;
        break;
      }
    }
    
    // If no mapping found, keep the original tag
    if (!foundMapping) {
      result.add(tag);
      used.add(tag);
    }
  }
  
  return Array.from(result).sort();
}

// Main analysis
async function main() {
  console.log('Starting AI-powered audio analysis...\n');
  
  const results = [];
  
  // Process in batches with rate limit management
  const batchSize = 15; // Conservative batch size
  for (let i = 0; i < sounds.length; i += batchSize) {
    const batch = sounds.slice(i, Math.min(i + batchSize, sounds.length));
    
    console.log(`\nProcessing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(sounds.length/batchSize)}...`);
    
    // Process batch in parallel with retry logic built-in
    const batchResults = await Promise.all(
      batch.map((sound, idx) => analyzeSound(sound, i + idx))
    );
    
    batch.forEach((sound, idx) => {
      const result = batchResults[idx];
      results.push({
        ...sound,
        tags: result.tags,
        panns: result.panns
      });
    });
    
    // 5 second delay between batches to respect rate limits
    if (i + batchSize < sounds.length) {
      console.log('  Waiting 5s before next batch...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  // Compact tags across all results
  console.log('\nCompacting similar tags...');
  results.forEach(result => {
    result.tags = compactTags(result.tags);
  });
  
  // If testing a single sound, DON'T save (just show results)
  if (TEST_SOUND) {
    console.log(`\n✓ Single sound test complete!`);
    console.log(`   Sound: ${results[0].name}`);
    console.log(`   Tags: ${results[0].tags.join(', ')}`);
    console.log(`\n   (Not saving to avoid corrupting sounds.json during UI development)`);
  } else if (TEST_LIMIT) {
    // Update only the first N sounds, keep the rest unchanged
    const updatedSounds = [
      ...results,
      ...allSounds.slice(TEST_LIMIT)
    ];
    writeFileSync(soundsPath, JSON.stringify(updatedSounds, null, 2));
    console.log(`\n✓ Test complete! Updated first ${TEST_LIMIT} sounds in sounds.json`);
    console.log(`   Location: ${soundsPath}`);
  } else {
    writeFileSync(soundsPath, JSON.stringify(results, null, 2));
    console.log('\n✓ Analysis complete! Updated all sounds in sounds.json');
    console.log(`   Location: ${soundsPath}`);
  }
  
  // Show tag statistics
  const tagCounts = {};
  results.forEach(sound => {
    sound.tags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  
  console.log('\nTag statistics:');
  Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([tag, count]) => {
      console.log(`  ${tag}: ${count}`);
    });
}

main().catch(console.error);
