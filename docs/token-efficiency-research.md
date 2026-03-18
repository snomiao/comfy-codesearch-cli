# Token Efficiency Research for comfy-codesearch CLI

## Goal

Minimize tokens consumed when the CLI output is fed to an LLM/AI agent.

---

## Format Comparison

| Format | Relative token cost | Notes |
|---|---|---|
| Plain text (line-oriented) | ~1x (baseline best) | ~40% fewer tokens than JSON |
| Markdown | ~1.1x | 34-38% fewer than JSON |
| Minified JSON | ~1.3x | Much better than pretty JSON |
| YAML | ~1.4x | ~30% fewer than pretty JSON; varies |
| Pretty JSON | ~2x | Worst for LLM consumption |
| XML | >2x | Avoid |

**Key finding**: Plain text / line-oriented output approaches information-theoretic optimality.
Practitioners report 40% token reduction by reformatting pretty-printed JSON as plain text.

---

## Current CLI Problems

1. **Pretty-printed YAML by default** — verbose with indentation, dashes, quotes
2. **Full GitHub API response passed through** — includes dozens of irrelevant fields:
   - `sha`, `node_id`, `git_url`, `url` (api URL), repository metadata (id, node_id, owner details, etc.)
   - Only truly needed: `repository.full_name`, `path`, `text_matches[].fragment`
3. **No TTY detection** — same verbose output whether human is reading or LLM is consuming
4. **No field selection** — no way to limit fields to what's needed
5. **Count default 100** — may return far more data than needed for a focused query

---

## GitHub Code Search API Response Structure

```json
{
  "total_count": 100,
  "items": [
    {
      "name": "filename.py",
      "path": "path/to/file.py",
      "sha": "...",        // low value
      "url": "...",        // api URL, low value
      "git_url": "...",    // low value
      "html_url": "...",   // useful
      "repository": {
        "id": ...,         // low value
        "node_id": "...",  // low value
        "name": "...",
        "full_name": "owner/repo",  // KEY field
        "html_url": "...",
        // + 20 more fields...
      },
      "score": 1.0,
      "text_matches": [
        { "fragment": "code snippet here..." }  // KEY field
      ]
    }
  ]
}
```

**Useful fields for code search**: `repository.full_name`, `path`, `html_url`, `text_matches[].fragment`
**Useful fields for repo search**: `full_name`, `description`, `html_url`, `stargazers_count`, `language`, `topics`

---

## Compact Text Format Design

### Code search (text format)
```
Comfy-Org/ComfyUI:nodes/custom_nodes.py
  class CustomNode: last_node_id = ...

Comfy-Org/ComfyUI:comfy/graph.py
  self.last_node_id = last_node_id
```

Token savings vs YAML: estimated **60-80%** per result.

### Repo search (text format)
```
Comfy-Org/ComfyUI - A powerful and modular UI for Stable Diffusion (★ 45000, Python)
Comfy-Org/comfy-cli - CLI for managing ComfyUI (★ 800, Python)
```

---

## Actual API Response Structure

The service uses a **Sourcegraph-style** API (not GitHub REST), so the response shape is:

```
data.search.results.results[]  →  FileMatch objects
  .repository.name             →  "github.com/owner/repo"
  .file.path                   →  "path/to/file.ts"
  .lineMatches[]
    .lineNumber                →  298
    .preview                   →  "  get last_node_id() {"
```

Note: there is no `/api/search/repo` endpoint (returns 404).

---

## Measured Token Savings (5 results, same query)

| Format | Chars | Reduction vs full JSON |
|---|---|---|
| `text` (new default when piped) | 295 | **63% smaller** |
| `yaml` (pruned) | 438 | 45% smaller |
| `json` (full, unpruned) | 792 | baseline |

---

## Improvement Plan

### 1. Auto-detect TTY
- If stdout is a TTY → human mode (YAML, colors, counts)
- If stdout is piped → compact text mode (minimal fields, line-oriented)

### 2. Add `--format` options
- `text` — compact line-oriented (best for LLMs, new default when piped)
- `yaml` — current default (human readable)
- `json` — minified JSON (for structured programmatic use)

### 3. Default field pruning
- Strip low-value fields by default (sha, node_id, git_url, api url, owner id, etc.)
- Keep: `path`, `html_url`, `repository.full_name`, `text_matches[].fragment`
- Add `--full` flag to bypass pruning

### 4. Add `--fields` option
- Comma-separated field paths: `--fields path,repo,fragment`

---

## References

- [TOON vs JSON vs YAML token efficiency](https://medium.com/@ffkalapurackal/toon-vs-json-vs-yaml-token-efficiency-breakdown-for-llm-5d3e5dc9fb9c)
- [Writing CLI Tools That AI Agents Actually Want to Use](https://dev.to/uenyioha/writing-cli-tools-that-ai-agents-actually-want-to-use-39no)
- [You Need to Rewrite Your CLI for AI Agents](https://news.bensbites.com/posts/59845-you-need-to-rewrite-your-cli-for-ai-agents/out)
- [CocoIndex Code: 70% token savings for code search](https://cocoindexio.substack.com/p/we-launched-a-code-search-cli-for)
- [RTK CLI proxy: 60-90% token reduction](https://github.com/rtk-ai/rtk)
- [Token-Efficient Data Prep for LLM Workloads](https://thenewstack.io/a-guide-to-token-efficient-data-prep-for-llm-workloads/)
