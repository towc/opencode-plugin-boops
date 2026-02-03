#!/usr/bin/env node
/**
 * Scrape ALL sounds from notificationsounds.com (all 34 pages)
 * Extracts sound IDs and names from the website
 */
import { writeFileSync } from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const sounds = new Map(); // Use Map to deduplicate by ID

async function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function extractSounds(html) {
  // Match URLs like: file-sounds-1234-sound-name.ogg
  const regex = /file-sounds-(\d+)-([a-z0-9-]+)\.ogg/g;
  const matches = [...html.matchAll(regex)];
  
  return matches.map(match => ({
    id: match[1],
    name: match[2].replace(/-/g, ' '),
    url: `https://notificationsounds.com/storage/sounds/file-sounds-${match[1]}-${match[2]}.ogg`
  }));
}

async function scrapeAllPages() {
  console.log('Scraping all sounds from notificationsounds.com...');
  console.log('This will fetch 34 pages (takes ~30 seconds)\n');
  
  for (let page = 1; page <= 34; page++) {
    const url = page === 1 
      ? 'https://notificationsounds.com/notification-sounds'
      : `https://notificationsounds.com/notification-sounds/pages/${page}`;
    
    try {
      console.log(`Fetching page ${page}/34...`);
      const html = await fetchPage(url);
      const pageSounds = extractSounds(html);
      
      // Add to map (deduplicates by ID)
      pageSounds.forEach(sound => {
        sounds.set(sound.id, sound);
      });
      
      console.log(`  Found ${pageSounds.length} sounds (Total: ${sounds.size})`);
      
      // Small delay to be nice to the server
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`  Error fetching page ${page}:`, error.message);
    }
  }
  
  return Array.from(sounds.values());
}

async function main() {
  const allSounds = await scrapeAllPages();
  
  // Sort by ID
  allSounds.sort((a, b) => parseInt(a.id) - parseInt(b.id));
  
  // Convert to final format
  const soundsJson = allSounds.map(sound => ({
    name: sound.name,
    id: sound.id,
    url: sound.url,
    category: 'notification',
    tags: []
  }));
  
  console.log(`\n✓ Scraping complete!`);
  console.log(`  Total sounds: ${soundsJson.length}`);
  console.log(`  ID range: ${soundsJson[0].id} - ${soundsJson[soundsJson.length - 1].id}`);
  
  const outputPath = path.join(projectRoot, 'sounds.json');
  writeFileSync(outputPath, JSON.stringify(soundsJson, null, 2));
  
  console.log(`\n✓ Saved to: ${outputPath}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Review the file: cat sounds.json | jq '. | length'`);
  console.log(`  2. Stage it: git add sounds.json`);
}

main().catch(console.error);
