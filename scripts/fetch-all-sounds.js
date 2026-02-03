#!/usr/bin/env node
/**
 * Fetch ALL available sounds from notificationsounds.com
 * Tests sequential IDs to find all valid sounds
 */
import { writeFileSync } from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const sounds = [];
const batchSize = 50;
let checkedCount = 0;
let foundCount = 0;

// Test if a sound ID exists by checking HTTP HEAD
async function testSoundExists(id) {
  return new Promise((resolve) => {
    const url = `https://notificationsounds.com/storage/sounds/file-sounds-${id}.ogg`;
    
    https.get(url, { method: 'HEAD' }, (res) => {
      if (res.statusCode === 200) {
        // Extract name from URL or use placeholder
        const name = `sound-${id}`;
        resolve({ id: `${id}`, name, url, exists: true });
      } else {
        resolve({ exists: false });
      }
    }).on('error', () => {
      resolve({ exists: false });
    });
  });
}

async function fetchSoundsInRange(startId, endId) {
  console.log(`\nChecking IDs ${startId}-${endId}...`);
  
  const promises = [];
  for (let id = startId; id <= endId; id++) {
    promises.push(testSoundExists(id));
  }
  
  const results = await Promise.all(promises);
  
  results.forEach(result => {
    checkedCount++;
    if (result.exists) {
      foundCount++;
      sounds.push({
        name: result.name,
        id: result.id,
        url: result.url,
        category: 'notification',
        tags: []
      });
    }
  });
  
  console.log(`  Found: ${results.filter(r => r.exists).length}/${results.length} (Total: ${foundCount}/${checkedCount})`);
}

async function main() {
  console.log('Fetching ALL sounds from notificationsounds.com...');
  console.log('Testing ID ranges (this will take a few minutes)...\n');
  
  // Based on our cached files, sounds range from ~700 to ~1300
  // Let's test a wider range to be sure
  const ranges = [
    [1, 500],      // Early sounds
    [500, 1000],   // Mid range
    [1000, 1500],  // Main range
    [1500, 2000]   // Extended range
  ];
  
  for (const [start, end] of ranges) {
    for (let i = start; i < end; i += batchSize) {
      await fetchSoundsInRange(i, Math.min(i + batchSize - 1, end));
      // Small delay to avoid hammering the server
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`\n✓ Discovery complete!`);
  console.log(`  Found ${sounds.length} valid sounds`);
  console.log(`  Tested ${checkedCount} IDs`);
  
  // Sort by ID
  sounds.sort((a, b) => parseInt(a.id) - parseInt(b.id));
  
  const outputPath = path.join(projectRoot, 'sounds.json');
  writeFileSync(outputPath, JSON.stringify(sounds, null, 2));
  
  console.log(`\n✓ Saved to: ${outputPath}`);
}

main().catch(console.error);
