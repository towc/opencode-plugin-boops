# opencode-plugin-boops 🔊

Sound notifications for OpenCode - plays pleasant "boop" sounds when tasks complete or input is needed.

## Features

- 🎵 Soft, friendly notification sounds when AI completes tasks
- 📡 Gentle alert when AI needs your permission or input
- 🌐 Works out of the box with online sounds (auto-downloaded and cached)
- 🔄 Fully configurable - use URLs or local files
- 🐧 Works on Linux (with `paplay` or `aplay`)
- 🍎 Works on macOS (with `afplay`)

## Installation

Add to your OpenCode config file:

**Global installation** (recommended):
```bash
# Edit ~/.config/opencode/opencode.json
```

**Per-project installation**:
```bash
# Edit opencode.json in your project root
```

Add the plugin to the config:
```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-plugin-boops"]
}
```

Then restart OpenCode. The plugin will be automatically downloaded and installed from npm.

### Quick setup

If you don't have an OpenCode config yet:

```bash
# Create global config
mkdir -p ~/.config/opencode
echo '{"$schema":"https://opencode.ai/config.json","plugin":["opencode-plugin-boops"]}' > ~/.config/opencode/opencode.json
```

Or for a specific project:

```bash
# In your project directory
echo '{"$schema":"https://opencode.ai/config.json","plugin":["opencode-plugin-boops"]}' > opencode.json
```

## How it works

The plugin listens to OpenCode events and plays sounds based on your configuration. By default, it uses online sounds that are automatically downloaded and cached:

- **`session.idle`** - AI finishes responding → soft "pristine" notification
- **`permission.asked`** - AI needs permission → gentle "relax" chime
- **`session.error`** - An error occurs → friendly "magic" alert

Sounds are downloaded once on first use and cached in `~/.cache/opencode/boops/` for instant playback.

## Configuration

The plugin uses a TOML configuration file located at `~/.config/opencode/boops.toml`.

### Create your config

Copy the default configuration:

```bash
# Get the default config template
curl -o ~/.config/opencode/boops.toml https://raw.githubusercontent.com/towc/opencode-plugin-boops/main/boops.default.toml
```

Or create it manually:

```toml
# ~/.config/opencode/boops.toml

[sounds]
# Simple: Use notificationsounds.com IDs (recommended)
"session.idle" = "1150-pristine"
"permission.asked" = "1217-relax"
"session.error" = "1219-magic"

# Or search by name (finds first match):
# "session.idle" = "pristine"

# Or use full URLs:
# "session.idle" = "https://example.com/sound.ogg"

# Or use local file paths:
# "session.idle" = "/usr/share/sounds/gnome/default/alerts/drip.ogg"
```

### Sound sources

The plugin supports multiple ways to specify sounds:

**1. notificationsounds.com IDs (easiest):**
```toml
"session.idle" = "1150-pristine"  # Direct ID (fast)
"session.idle" = "pristine"       # Search by name (slower, first match)
```

Browse sounds at [notificationsounds.com](https://notificationsounds.com/notification-sounds) to find IDs.

**2. Full URLs:**
```toml
"session.idle" = "https://example.com/sound.ogg"
```

**3. Local file paths:**
```toml
"session.idle" = "/usr/share/sounds/gnome/default/alerts/drip.ogg"
```

**Caching:** Remote sounds (IDs and URLs) are cached in `~/.cache/opencode/boops/` by event name (e.g. `session-idle`, `permission-asked`). Once downloaded, they're reused instantly. If you change a sound, the cache is automatically updated on next play.

### Available events

You can configure sounds for any of the 28 OpenCode events:

**Session events (8):**
- `session.idle` - AI completes response
- `session.error` - Error occurs
- `session.created` - New session starts
- `session.deleted` - Session deleted
- `session.compacted` - Session compacted
- `session.diff` - Session diff generated
- `session.status` - Session status changed
- `session.updated` - Session updated

**Permission events (2):**
- `permission.asked` - AI needs permission
- `permission.replied` - Permission response given

**File events (2):**
- `file.edited` - File is edited
- `file.watcher.updated` - File watcher detects change

**Tool events (2):**
- `tool.execute.before` - Before tool execution
- `tool.execute.after` - After tool execution

**Message events (4):**
- `message.part.removed` - Message part removed
- `message.part.updated` - Message part updated
- `message.removed` - Message removed
- `message.updated` - Message updated

**LSP events (2):**
- `lsp.client.diagnostics` - LSP diagnostics received
- `lsp.updated` - LSP server updated

**TUI events (3):**
- `tui.prompt.append` - Text appended to prompt
- `tui.command.execute` - TUI command executed
- `tui.toast.show` - Toast notification shown

**Other events (5):**
- `command.executed` - Command executed
- `todo.updated` - Todo list updated
- `installation.updated` - Installation/package updated
- `server.connected` - Connected to server

See the [default config](boops.default.toml) for the complete list with descriptions.

### Event filters

For advanced use cases, you can add filters to play sounds only when certain conditions match. This is useful for events that fire frequently or in different contexts.

**Example: Only play sound for main session, not subagents:**

```toml
[sounds.session.idle]
sound = "https://notificationsounds.com/storage/sounds/file-sounds-1150-pristine.ogg"
not_if = { agent = "explore" }  # Skip subagent completions
```

**How to find available properties:**

1. Check OpenCode logs when the event fires:
```bash
tail -f ~/.local/share/opencode/log/*.log | grep "session.idle event"
```

2. The logs will show all event properties you can filter on

**Filter syntax:**

```toml
[sounds.event-name]
sound = "/path/to/sound"
only_if = { property = "value" }  # Only play if property equals value
not_if = { property = "value" }   # Don't play if property equals value
```

### Testing sounds

You can test sounds without restarting OpenCode using the custom tool:

```bash
# Test a configured event (reloads config automatically)
test-sound session.idle

# Test a sound ID directly
test-sound pristine
test-sound 1150-pristine

# Test a URL directly  
test-sound https://example.com/sound.ogg

# Test a local file directly
test-sound /usr/share/sounds/alert.ogg
```

This is helpful when:
- Configuring new sounds
- Trying different sound files before committing to config
- Testing event filters
- Verifying URLs/IDs work

The test command automatically reloads your config file, so you can edit `boops.toml` and test immediately!

### Browse sounds interactively

The plugin includes a beautiful TUI for browsing and assigning sounds:

```bash
# If plugin is installed
~/.config/opencode/plugins/boops/browse

# Or try it with npx (browse-only, saving disabled)
npx opencode-plugin-boops browse
```

Features:
- 🎨 Browse 448 sounds with tags and descriptions
- 🏷️ Filter by tags (music, bell, quiet, etc.)
- 🔍 Search by name
- 🎵 Preview sounds before assigning
- ⚡ Assign sounds to OpenCode events (if plugin installed)
- 🖱️ Full mouse support with hover effects
- ⌨️ Keyboard navigation

**Note**: When running via `npx`, you can browse and preview sounds, but saving assignments requires the plugin to be installed.

### Custom sound player

By default, the plugin auto-detects `paplay` (PulseAudio), `aplay` (ALSA), or `afplay` (macOS). You can override this:

```toml
player = "afplay"  # Force specific player
```

### macOS example

```toml
player = "afplay"

[sounds]
"session.idle" = "/System/Library/Sounds/Glass.aiff"
"permission.asked" = "/System/Library/Sounds/Ping.aiff"
"session.error" = "/System/Library/Sounds/Basso.aiff"
```

## Requirements

- OpenCode 1.0+
- Linux: `paplay` (PulseAudio) or `aplay` (ALSA)
- macOS: `afplay` (built-in)
- Internet connection (only for initial sound download)

## Troubleshooting

### No sound playing

1. **Use the test command first:**
```bash
test-sound event="session.idle"
```

2. **Check if sound player is installed:**
```bash
which paplay  # Linux (PulseAudio)
which aplay   # Linux (ALSA)
which afplay  # macOS
```

3. **Check OpenCode logs:**
```bash
tail -f ~/.local/share/opencode/log/*.log | grep boops
```

4. **Check cached sounds:**
```bash
ls -la ~/.cache/opencode/boops/
```

5. **Clear cache and re-download:**
```bash
rm -rf ~/.cache/opencode/boops/
# Then use test-sound to re-download
```

### Sounds too loud/quiet

Adjust your system volume or use different sound files.

## Contributing

Contributions welcome! Feel free to:
- Add support for Windows
- Add configurable sound options
- Improve cross-platform compatibility
- Add more event triggers

## Credits

Sounds from [Notification Sounds](https://notificationsounds.com) - a wonderful collection of free notification sounds provided under Creative Commons Attribution license.

## License

MIT

## Author

Created by [towc](https://github.com/towc)
