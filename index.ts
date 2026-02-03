import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { parse } from "smol-toml"
import { existsSync } from "fs"
import { readFile, writeFile, mkdir, unlink, readdir } from "fs/promises"
import { homedir } from "os"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

// Load sounds database
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const soundsDbPath = join(__dirname, "sounds.json")

interface SoundEntry {
  name: string
  id: string
  url: string
}

let soundsDb: SoundEntry[] = []

// Load sounds database
try {
  const soundsData = await readFile(soundsDbPath, "utf-8")
  soundsDb = JSON.parse(soundsData)
} catch (error) {
  console.error("Failed to load sounds.json:", error)
}

interface EventFilter {
  sound: string
  only_if?: Record<string, any>  // Only play if these properties match
  not_if?: Record<string, any>   // Don't play if these properties match
}

interface BoopsConfig {
  player?: string
  sounds: Record<string, string | EventFilter>
  fallbacks?: {
    default?: string
  }
}

export const BoopsPlugin: Plugin = async ({ client }) => {
  const log = async (message: string, extra?: any) => {
    await client.app.log({
      service: "opencode-plugin-boops",
      level: "info",
      message,
      extra
    })
  }

  // Cache directory for downloaded sounds
  const cacheDir = join(homedir(), ".cache", "opencode", "boops")
  
  // Ensure cache directory exists
  try {
    await mkdir(cacheDir, { recursive: true })
  } catch (error) {
    // Directory might already exist
  }

  const configPath = join(homedir(), ".config", "opencode", "plugins", "boops", "boops.toml")

  // Load configuration (can be called multiple times to reload)
  const loadConfig = async (): Promise<BoopsConfig> => {
    let config: BoopsConfig = {
      sounds: {
        "session.idle": "1150-pristine",
        "permission.asked": "1217-relax",
        "session.error": "1219-magic",
      },
      fallbacks: {
        default: "/usr/share/sounds/alsa/Front_Center.wav"
      }
    }

    // Try to load user config
    if (existsSync(configPath)) {
      try {
        const configContent = await readFile(configPath, "utf-8")
        const userConfig = parse(configContent) as BoopsConfig
        config = { ...config, ...userConfig }
        await log("Loaded custom configuration", { path: configPath })
      } catch (error) {
        await log("Failed to load config, using defaults", { error: String(error) })
      }
    } else {
      await log("No custom config found, using defaults", { 
        hint: `Create ${configPath} to customize sounds` 
      })
    }

    return config
  }

  let config = await loadConfig()

  // Detect available sound player
  const detectPlayer = async (): Promise<string> => {
    if (config.player) return config.player

    const players = ["paplay", "aplay", "afplay"]
    for (const player of players) {
      try {
        await Bun.$`which ${player}`.quiet()
        return player
      } catch {
        continue
      }
    }
    return "echo" // Fallback to no sound
  }

  let player = await detectPlayer()
  if (player === "echo") {
    await log("No sound player found, sounds disabled")
  } else {
    await log(`Using sound player: ${player}`)
  }

  // Check if string is a URL
  const isUrl = (str: string): boolean => {
    try {
      const url = new URL(str)
      return url.protocol === "http:" || url.protocol === "https:"
    } catch {
      return false
    }
  }

  // Check if string is a local file path
  const isLocalPath = (str: string): boolean => {
    return str.startsWith("/") || str.startsWith("./") || str.startsWith("../") || str.startsWith("~")
  }

  // Resolve sound name/ID to URL using sounds database
  const resolveSoundId = async (id: string): Promise<string | null> => {
    try {
      // Search in sounds database by name (fuzzy match)
      const searchTerm = id.toLowerCase().replace(/-/g, ' ')
      
      // Try exact match first (by id like "1150-pristine")
      let sound = soundsDb.find(s => s.id === id)
      
      // Try exact name match
      if (!sound) {
        sound = soundsDb.find(s => s.name.toLowerCase() === searchTerm)
      }
      
      // Try partial name match
      if (!sound) {
        sound = soundsDb.find(s => s.name.toLowerCase().includes(searchTerm))
      }
      
      if (sound) {
        await log(`Resolved '${id}' to: ${sound.name} (${sound.id})`)
        return sound.url
      }

      await log(`No sound found for: ${id}`)
      return null
    } catch (error) {
      await log(`Failed to resolve sound ID: ${id}`, { error: String(error) })
      return null
    }
  }

  // Get cache path for an event (no extension, stores by event name)
  const getCachePath = (eventName: string): string => {
    // Sanitize event name for filesystem (replace dots with dashes)
    const safeName = eventName.replace(/\./g, "-")
    return join(cacheDir, safeName)
  }

  // Download and cache a sound file from URL for a specific event
  const downloadSound = async (url: string, eventName: string): Promise<string> => {
    const cachedPath = getCachePath(eventName)

    // Return cached file if it exists
    if (existsSync(cachedPath)) {
      return cachedPath
    }

    // Delete any old cached file for this event (in case URL changed)
    try {
      const files = await readdir(cacheDir)
      const safeName = eventName.replace(/\./g, "-")
      for (const file of files) {
        if (file.startsWith(safeName)) {
          await unlink(join(cacheDir, file))
        }
      }
    } catch {
      // Ignore errors
    }

    // Download the file
    await log(`Downloading sound for ${eventName}: ${url}`)
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      await writeFile(cachedPath, buffer)
      await log(`Cached sound for ${eventName}: ${cachedPath}`)
      
      return cachedPath
    } catch (error) {
      await log(`Failed to download sound from ${url}`, { error: String(error) })
      throw error
    }
  }

  // Resolve sound file path (handles URLs, local paths, and notificationsounds.com IDs)
  const resolveSoundPath = async (soundFile: string, eventName: string): Promise<string | null> => {
    // Handle URLs
    if (isUrl(soundFile)) {
      try {
        return await downloadSound(soundFile, eventName)
      } catch {
        return null
      }
    }

    // Handle local paths
    if (isLocalPath(soundFile) && existsSync(soundFile)) {
      return soundFile
    }

    // Try as sound ID/name (e.g., "pristine" or "1150-pristine")
    const resolvedUrl = await resolveSoundId(soundFile)
    if (resolvedUrl) {
      try {
        return await downloadSound(resolvedUrl, eventName)
      } catch {
        return null
      }
    }

    return null
  }

  // Play sound with fallback mechanism
  const playSound = async (soundFile: string, eventName: string) => {
    if (player === "echo") return // Skip if no player

    try {
      // Resolve the sound file (download if URL, check if local path exists)
      const resolvedPath = await resolveSoundPath(soundFile, eventName)
      
      if (resolvedPath) {
        await Bun.$`${player} ${resolvedPath}`.quiet()
        return
      }

      // Try fallback
      const fallback = config.fallbacks?.default
      if (fallback) {
        const fallbackPath = await resolveSoundPath(fallback, "fallback")
        if (fallbackPath) {
          await Bun.$`${player} ${fallbackPath}`.quiet()
          return
        }
      }

      // Last resort: terminal bell
      await Bun.$`echo -e "\a"`.quiet()
    } catch (error) {
      // Silently fail - don't spam logs for sound errors
    }
  }

  await log("Boops plugin initialized", { 
    configuredEvents: Object.keys(config.sounds).length,
    player 
  })

  // Check if event matches filter conditions
  const matchesFilter = (event: any, filter: EventFilter): boolean => {
    // Check only_if conditions
    if (filter.only_if) {
      for (const [key, value] of Object.entries(filter.only_if)) {
        if (event[key] !== value) {
          return false
        }
      }
    }

    // Check not_if conditions
    if (filter.not_if) {
      for (const [key, value] of Object.entries(filter.not_if)) {
        if (event[key] === value) {
          return false
        }
      }
    }

    return true
  }

  return {
    event: async ({ event }) => {
      // Log session.idle events for debugging (helpful for users configuring filters)
      if (event.type === "session.idle") {
        await log(`session.idle event received`, { 
          properties: event 
        })
      }

      const soundConfig = config.sounds[event.type]
      if (!soundConfig) return

      // Handle simple string (just a sound file path/URL)
      if (typeof soundConfig === "string") {
        await playSound(soundConfig, event.type)
        return
      }

      // Handle filter object
      if (matchesFilter(event, soundConfig)) {
        await playSound(soundConfig.sound, event.type)
      }
    },
    
    tool: {
      "test-sound": tool({
        description: "Test a boops sound. Usage: test-sound pristine OR test-sound session.idle",
        args: {
          sound: tool.schema.string().describe("Sound to test: event name, ID, URL, or path"),
        },
        async execute(args, context) {
          // Reload config and player
          config = await loadConfig()
          player = await detectPlayer()

          // Check if it's an event name first
          const soundConfig = config.sounds[args.sound]
          if (soundConfig) {
            await log(`Testing configured sound for event: ${args.sound}`)
            
            // Handle filter object
            const soundFile = typeof soundConfig === "string" ? soundConfig : soundConfig.sound
            await playSound(soundFile, args.sound)
            
            return `✅ Played sound for event: ${args.sound}\nSound: ${soundFile}`
          }

          // Otherwise treat it as a direct sound specification (ID, URL, or path)
          await log(`Testing sound directly: ${args.sound}`)
          const resolvedPath = await resolveSoundPath(args.sound, "test")
          
          if (!resolvedPath) {
            return `❌ Failed to resolve sound: ${args.sound}\n\nTried:\n  - Event name lookup (not found)\n  - notificationsounds.com ID (not found)\n  - URL/path resolution (failed)\n\nCheck logs for details.`
          }

          if (player === "echo") {
            return `❌ No sound player found (paplay/aplay/afplay)\nResolved to: ${resolvedPath}`
          }

          await Bun.$`${player} ${resolvedPath}`.quiet()
          
          return `✅ Played sound: ${args.sound}\nResolved to: ${resolvedPath}`
        },
      }),

      "browse-boops": tool({
        description: "Browse and search through 449 notification sounds",
        args: {
          query: tool.schema.string().optional().describe("Search sounds by name"),
        },
        async execute(args) {
          if (!soundsDb.length) {
            return `❌ Sounds database not loaded`
          }

          // No query - show suggestions
          if (!args.query) {
            const suggestions = ['pristine', 'relax', 'magic', 'done', 'error', 'attention', 'elegant', 'cheerful']
            return `🔊 **449 notification sounds available**\n\n` +
                   `**Try:** ${suggestions.map(s => `browse-boops ${s}`).join(' • ')}\n\n` +
                   `💡 Test any sound: **test-sound pristine**`
          }

          // Search
          const searchTerm = args.query.toLowerCase()
          const results = soundsDb.filter(s => s.name.toLowerCase().includes(searchTerm))

          if (results.length === 0) {
            return `❌ No sounds matching "${args.query}"\n\nTry: browse-boops notification`
          }

          // Format results
          const MAX = 30
          const display = results.slice(0, MAX)
          
          let output = `🔊 **${results.length}** sound${results.length !== 1 ? 's' : ''} matching "${args.query}"\n\n`
          
          if (results.length <= 10) {
            output += display.map((s, i) => `${i + 1}. **${s.name}**`).join('\n')
            output += `\n\n💡 Test: **test-sound ${display[0].name}**`
          } else {
            output += `**Sounds:** ${display.map(s => s.name).join(', ')}`
            if (results.length > MAX) output += `, +${results.length - MAX} more`
            output += `\n\n💡 Test: **test-sound ${display[0].name}**`
          }

          return output
        },
      }),
    }
  }
}
