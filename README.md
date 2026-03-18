# comfy-codesearch-cli

CLI for [ComfyUI Code Search](https://cs.comfy.org) — search code across ComfyUI repositories from your terminal.

## Install

```bash
bun install comfy-codesearch-cli
```

## Usage

```bash
# Search code (default command)
comfy-codesearch "repo:Comfy-Org/ComfyUI last_node_id"

# Explicit search command
comfy-codesearch search "video audio transcription"

# Limit results
comfy-codesearch search "python" --count 200

# Output as JSON
comfy-codesearch search "python" --format json

# Search repositories
comfy-codesearch repo "comfy"
```

## Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--count <n>` | `-c` | Max results (default: 100) |
| `--format <fmt>` | `-f` | Output format: `yaml` (default) or `json` |
| `--help` | `-h` | Show help |

## Environment

Set `CS_SERVICE` to override the API endpoint (defaults to `https://comfy-codesearch.vercel.app`).

## License

MIT
