#!/usr/bin/env node
/**
 * Generate tags from stored PANNs predictions
 * This allows experimenting with different filtering/mapping algorithms
 * without re-running PANNs analysis
 */
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const soundsPath = path.join(projectRoot, 'sounds.json');
const allSounds = JSON.parse(readFileSync(soundsPath, 'utf-8'));

console.log('Generating tags from PANNs predictions...\n');

// Configuration for tag generation
const CONFIG = {
  // Use top prediction + any within 10% relative of it
  useRelativeThreshold: true,
  relativeThreshold: 0.9, // 10% relative
  
  // OR use absolute minimum confidence
  useAbsoluteThreshold: false,
  absoluteThreshold: 0.15,
  
  // Minimum tags to generate if nothing qualifies
  minTags: 1,
  
  // Generic tags to filter unless high confidence
  genericTags: ['music', 'vehicle', 'inside', 'silence', 'sound effect', 'animal'],
  genericThreshold: 0.5,
  
  // Speech tags require higher confidence
  speechThreshold: 0.3,
};

function generateTags(panns, technicalTags) {
  const tags = new Set(technicalTags);
  
  if (!panns || panns.length === 0) return Array.from(tags);
  
  // Determine which predictions to use
  let qualifyingPredictions = [];
  
  if (CONFIG.useRelativeThreshold) {
    const topScore = panns[0].score;
    const threshold = topScore * CONFIG.relativeThreshold;
    qualifyingPredictions = panns.filter(p => p.score >= threshold);
  } else if (CONFIG.useAbsoluteThreshold) {
    qualifyingPredictions = panns.filter(p => p.score >= CONFIG.absoluteThreshold);
  }
  
  // Ensure we have at least minTags
  if (qualifyingPredictions.length < CONFIG.minTags) {
    qualifyingPredictions = panns.slice(0, CONFIG.minTags);
  }
  
  // Process each qualifying prediction
  const semanticTags = [];
  
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
    if (tag.includes('speech') || tag.includes('laughter') || tag.includes('crying') || 
        tag.includes('singing') || tag.includes('whispering') || tag.includes('shouting')) {
      
      if (score > CONFIG.speechThreshold) {
        tags.add('human');
      }
      
      // Skip generic "speech" tag if confidence is too low
      if (tag === 'speech' && score < CONFIG.speechThreshold) {
        continue;
      }
    }
    
    // Add gender/age tags from anywhere in predictions (if >10% confidence)
    if (score > 0.1) {
      if (label.includes('male') && !label.includes('female')) {
        tags.add('male');
      }
      if (label.includes('female')) {
        tags.add('female');
      }
      if (label.includes('child') || label.includes('baby') || label.includes('kid')) {
        tags.add('child');
      }
    }
    
    semanticTags.push(tag);
    tags.add(tag);
  }
  
  // If we ended up with no semantic tags (only technical), add top prediction regardless
  if (semanticTags.length === 0 && panns.length > 0) {
    const topTag = panns[0].label.split(/[,(]/g)[0].trim().toLowerCase();
    tags.add(topTag);
  }
  
  return Array.from(tags).sort();
}

// Process all sounds
let taggedCount = 0;
let emptyCount = 0;

allSounds.forEach(sound => {
  const newTags = generateTags(sound.panns, sound.tags);
  sound.tags = newTags;
  
  if (newTags.length > 0) {
    taggedCount++;
  } else {
    emptyCount++;
  }
});

// Save updated sounds
writeFileSync(soundsPath, JSON.stringify(allSounds, null, 2));

console.log(`✓ Tag generation complete!`);
console.log(`  Sounds with tags: ${taggedCount}`);
console.log(`  Sounds without tags: ${emptyCount}`);
console.log(`  Total: ${allSounds.length}`);

// Show tag statistics
const tagCounts = {};
allSounds.forEach(sound => {
  sound.tags.forEach(tag => {
    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  });
});

console.log(`\nTop 20 tags:`);
Object.entries(tagCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20)
  .forEach(([tag, count]) => {
    console.log(`  ${tag}: ${count}`);
  });
