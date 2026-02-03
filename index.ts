import type { Plugin } from "@opencode-ai/plugin"

export const BoopsPlugin: Plugin = async ({ client }) => {
  // Default sounds - users can customize via config
  const inputSound = '/usr/share/sounds/gnome/default/alerts/sonar.ogg'
  const completeSound = '/usr/share/sounds/gnome/default/alerts/glass.ogg'
  
  // Fallback sounds for systems without GNOME sounds
  const fallbackInputSound = '/usr/share/sounds/alsa/Front_Left.wav'
  const fallbackCompleteSound = '/usr/share/sounds/alsa/Front_Right.wav'
  
  const log = async (message: string, extra?: any) => {
    await client.app.log({
      service: "opencode-plugin-boops",
      level: "info",
      message,
      extra
    })
  }
  
  // Try multiple sound players and files
  const playSound = async (primaryFile: string, fallbackFile: string, label: string) => {
    try {
      // Try primary sound with paplay
      await Bun.$`paplay ${primaryFile}`.quiet()
      return
    } catch {
      try {
        // Try fallback sound with paplay
        await Bun.$`paplay ${fallbackFile}`.quiet()
        return
      } catch {
        try {
          // Try primary with aplay
          await Bun.$`aplay ${primaryFile}`.quiet()
          return
        } catch {
          try {
            // Try fallback with aplay
            await Bun.$`aplay ${fallbackFile}`.quiet()
            return
          } catch {
            // Last resort: terminal bell
            await log(`All sound attempts failed for ${label}, using terminal bell`)
            await Bun.$`echo -e "\a"`.quiet()
          }
        }
      }
    }
  }
  
  await log("Boops plugin initialized - sound notifications enabled")
  
  return {
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        await playSound(completeSound, fallbackCompleteSound, "completion")
      }
      
      if (event.type === "permission.asked") {
        await playSound(inputSound, fallbackInputSound, "input-needed")
      }
    }
  }
}
