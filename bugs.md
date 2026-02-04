# Known Bugs

## TUI Browser (`cli/browse`)

### Picker Issues
- **Left side scrolling not locked**: Sound list on left still scrolls when picker is active, should be completely frozen
- **Visual artifacts when navigating in picker**: Moving up/down in the picker causes display glitches and artifacts
- **Fallback option hidden**: The `__fallback` system event doesn't appear in the picker event list

### Sound Database
- **Duplicate friendly names**: Multiple sounds have the same friendly name (e.g. "attracted" appears twice)
  - Should implement deduplication logic or use unique IDs in display

## Priority
- High: Picker visual artifacts
- High: Left side scrolling lock
- Medium: Fallback option visibility
- Low: Duplicate sound names
