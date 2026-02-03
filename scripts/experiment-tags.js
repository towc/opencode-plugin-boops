#!/usr/bin/env node
/**
 * Experiment with different tag generation algorithms
 * Reads sounds.json (with PANNs data), generates tags, outputs to sounds-tagged.json
 * 
 * Usage:
 *   node scripts/experiment-tags.js
 * 
 * This script does NOT modify the original sounds.json!
 */
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const soundsPath = path.join(projectRoot, 'sounds.json');
const outputPath = path.join(projectRoot, 'sounds-tagged.json');

const allSounds = JSON.parse(readFileSync(soundsPath, 'utf-8'));

console.log('🧪 Experimenting with tag generation...\n');

// ========== CONFIGURATION ==========
// Play with these values!
const CONFIG = {
  // Strategy: 'relative' (top + within 10%) or 'absolute' (fixed threshold)
  strategy: 'relative',
  
  relativeThreshold: 0.9, // Use predictions within 10% of top score
  absoluteThreshold: 0.15, // Or use fixed 15% threshold
  
  // Generic tags to filter unless high confidence
  genericTags: ['music', 'vehicle', 'inside', 'silence', 'sound effect', 'animal'],
  genericThreshold: 0.5, // 50% confidence required for generic tags
  
  // Speech requires higher confidence to avoid false positives
  speechThreshold: 0.3, // 30%
  
  // Fallback for sounds with no qualifying tags
  useMiscFallback: true, // Add 'misc' tag if nothing else qualifies
};

function generateTags(panns, technicalTags) {
  // Track tags with their confidence scores and insertion order
  // Format: { score: number|null, order: number, isDerived: boolean }
  const tagScores = new Map();
  let insertionOrder = 0;
  
  // Add technical tags first (they'll be sorted to the end since score is null)
  technicalTags.forEach(t => {
    tagScores.set(t, { score: null, order: insertionOrder++, isDerived: false });
  });
  
  if (!panns || panns.length === 0) {
    if (CONFIG.useMiscFallback && technicalTags.length === 0) {
      tagScores.set('misc', { score: null, order: insertionOrder++, isDerived: false });
    }
    return Array.from(tagScores.keys());
  }
  
  // Determine which predictions to use
  let qualifyingPredictions = [];
  
  if (CONFIG.strategy === 'relative') {
    const topScore = panns[0].score;
    const threshold = topScore * CONFIG.relativeThreshold;
    qualifyingPredictions = panns.filter(p => p.score >= threshold);
  } else {
    qualifyingPredictions = panns.filter(p => p.score >= CONFIG.absoluteThreshold);
  }
  
  const semanticTagsAdded = [];
  
  // Process each qualifying prediction
  for (const pred of qualifyingPredictions) {
    const label = pred.label.toLowerCase();
    const score = pred.score;
    
    // Clean the label (remove parentheses and comma descriptions)
    let tag = label.split(/[,(]/g)[0].trim();
    
    // Filter generic tags unless high confidence
    const isGeneric = CONFIG.genericTags.includes(tag);
    if (isGeneric && score < CONFIG.genericThreshold) {
      continue;
    }
    
    // Handle human voice detection
    // Be specific to avoid false positives (e.g., "singing bowl" is not "singing")
    const speechKeywords = ['speech', 'laughter', 'crying', 'whispering', 'shouting', 'screaming', 'snoring'];
    const isSpeechRelated = speechKeywords.some(keyword => tag === keyword || tag.includes(' ' + keyword));
    // For singing: match exact word or when preceded by space (e.g., "child singing" but not "singing bowl")
    const isSinging = tag === 'singing' || tag.endsWith(' singing');
    
    if (isSpeechRelated || isSinging) {
      if (score > CONFIG.speechThreshold) {
        // 'human' is a derived tag, use the score from the speech prediction that triggered it
        const existing = tagScores.get('human');
        if (!existing || existing.score < score) {
          tagScores.set('human', { score, order: insertionOrder++, isDerived: true });
        }
      }
      
      // Skip generic "speech" tag if confidence is too low
      if (tag === 'speech' && score < CONFIG.speechThreshold) {
        continue;
      }
    }
    
    // Add gender/age tags from anywhere in predictions (if >10% confidence)
    if (score > 0.1) {
      if (label.includes('male') && !label.includes('female')) {
        const existing = tagScores.get('male');
        if (!existing || existing.score < score) {
          tagScores.set('male', { score, order: insertionOrder++, isDerived: true });
        }
      }
      if (label.includes('female')) {
        const existing = tagScores.get('female');
        if (!existing || existing.score < score) {
          tagScores.set('female', { score, order: insertionOrder++, isDerived: true });
        }
      }
      if (label.includes('child') || label.includes('baby') || label.includes('kid')) {
        const existing = tagScores.get('child');
        if (!existing || existing.score < score) {
          tagScores.set('child', { score, order: insertionOrder++, isDerived: true });
        }
      }
    }
    
    // Add the main tag with its score (keep highest score if duplicate)
    const existing = tagScores.get(tag);
    if (!existing || existing.score < score) {
      tagScores.set(tag, { score, order: insertionOrder++, isDerived: false });
    }
    semanticTagsAdded.push(tag);
  }
  
  // Fallback: if we have no semantic tags and no technical tags, add 'misc'
  if (CONFIG.useMiscFallback && semanticTagsAdded.length === 0 && technicalTags.length === 0) {
    tagScores.set('misc', { score: null, order: insertionOrder++, isDerived: false });
  }
  
  // Sort by confidence (highest first), with null scores (technical tags) at the end
  // When scores are equal, prioritize non-derived tags, then use insertion order
  return Array.from(tagScores.entries())
    .sort((a, b) => {
      const [tagA, dataA] = a;
      const [tagB, dataB] = b;
      
      // null scores go to the end
      if (dataA.score === null && dataB.score === null) return dataA.order - dataB.order;
      if (dataA.score === null) return 1;
      if (dataB.score === null) return -1;
      
      // Higher scores first
      if (dataA.score !== dataB.score) {
        return dataB.score - dataA.score;
      }
      
      // Same score: non-derived tags come before derived tags
      if (dataA.isDerived !== dataB.isDerived) {
        return dataA.isDerived ? 1 : -1;
      }
      
      // Same score and derivation status: use insertion order
      return dataA.order - dataB.order;
    })
    .map(([tag, _data]) => tag);
}

// Process all sounds
let taggedCount = 0;
let emptyCount = 0;
let miscCount = 0;

const outputSounds = allSounds.map(sound => {
  // Extract only technical tags (duration/volume), ignore old semantic tags
  const technicalTags = (sound.tags || []).filter(t => 
    ['short', 'long', 'loud', 'quiet'].includes(t)
  );
  const newTags = generateTags(sound.panns, technicalTags);
  
  if (newTags.length > 0) {
    taggedCount++;
    if (newTags.includes('misc')) miscCount++;
  } else {
    emptyCount++;
  }
  
  return {
    ...sound,
    tags: newTags
  };
});

// Save to output file (NOT sounds.json!)
writeFileSync(outputPath, JSON.stringify(outputSounds, null, 2));

console.log(`✓ Tag generation complete!`);
console.log(`  Output: ${outputPath}`);
console.log(`  Sounds with tags: ${taggedCount}`);
console.log(`  Sounds with 'misc' tag: ${miscCount}`);
console.log(`  Sounds without tags: ${emptyCount}`);
console.log(`  Total: ${outputSounds.length}`);

// Show tag statistics
const tagCounts = {};
outputSounds.forEach(sound => {
  sound.tags.forEach(tag => {
    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  });
});

console.log(`\nTop 25 tags:`);
Object.entries(tagCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 25)
  .forEach(([tag, count]) => {
    console.log(`  ${tag}: ${count}`);
  });

console.log(`\n💡 Tip: Edit CONFIG in this script to try different approaches!`);
console.log(`   Original data in sounds.json is preserved.`);
