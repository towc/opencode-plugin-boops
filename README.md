# opencode-plugin-boops 🔊

Sound notifications for OpenCode - plays pleasant "boop" sounds when tasks complete or input is needed.

## Features

- 🎵 Pleasant glass chime when AI completes a response
- 📡 Sonar ping when AI needs your permission or input
- 🔄 Automatic fallback to alternative sounds if preferred sounds aren't available
- 🐧 Works on Linux (with `paplay` or `aplay`)
- 🍎 Works on macOS (requires custom sound configuration)

## Installation

### Using OpenCode config

Add to your `opencode.json` or `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-plugin-boops"]
}
```

### Manual installation

Place the plugin file in your OpenCode plugins directory:

```bash
# Global
mkdir -p ~/.config/opencode/plugins
cp index.ts ~/.config/opencode/plugins/boops.ts

# Per-project
mkdir -p .opencode/plugins
cp index.ts .opencode/plugins/boops.ts
```

## How it works

The plugin listens to OpenCode events:

- **`session.idle`** - Fires when the AI finishes responding → plays completion sound (glass.ogg)
- **`permission.asked`** - Fires when the AI needs permission → plays attention sound (sonar.ogg)

## Customization

### Custom sounds

To use your own sounds, modify the sound file paths in `index.ts`:

```typescript
const inputSound = '/path/to/your/input-sound.ogg'
const completeSound = '/path/to/your/complete-sound.ogg'
```

### macOS

On macOS, you can use system sounds:

```typescript
const inputSound = '/System/Library/Sounds/Ping.aiff'
const completeSound = '/System/Library/Sounds/Glass.aiff'
```

And update the `playSound` function to use `afplay`:

```typescript
await Bun.$`afplay ${primaryFile}`.quiet()
```

## Requirements

- OpenCode 1.0+
- Linux: `paplay` (PulseAudio) or `aplay` (ALSA)
- macOS: `afplay` (built-in)
- Sound files at specified paths (or system sounds)

## Troubleshooting

### No sound playing

1. Check if sound files exist:
```bash
ls /usr/share/sounds/gnome/default/alerts/glass.ogg
ls /usr/share/sounds/gnome/default/alerts/sonar.ogg
```

2. Test sound manually:
```bash
paplay /usr/share/sounds/gnome/default/alerts/glass.ogg
```

3. Check OpenCode logs:
```bash
tail -f ~/.local/share/opencode/log/*.log | grep boops
```

### Sounds too loud/quiet

Adjust your system volume or use different sound files.

## Contributing

Contributions welcome! Feel free to:
- Add support for Windows
- Add configurable sound options
- Improve cross-platform compatibility
- Add more event triggers

## License

MIT

## Author

Created by [towc](https://github.com/towc)
