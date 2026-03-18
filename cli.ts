#!/usr/bin/env npx tsx
// or #!/usr/bin/env bun

// Public CLI for ComfyUI Code Search
// Routes all queries through the Vercel proxy at comfy-codesearch.vercel.app
//
// Usage:
//   comfy-codesearch "<query>"                # code search (text format when piped)
//   comfy-codesearch search "<query>" -f yaml  # force yaml
//   comfy-codesearch search "<query>" --full   # all fields, no pruning

import yargs from "yargs";
import YAML from "yaml";

const API_BASE = process.env.CS_SERVICE || "https://comfy-codesearch.vercel.app";

async function apiFetch(endpoint: string, query: string) {
  const url = `${API_BASE}/api/search/${endpoint}?query=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}

// Response shape: data.search.results.results[] (Sourcegraph-style)
function getResults(data: any): any[] {
  return data?.data?.search?.results?.results ?? [];
}

function getMeta(data: any) {
  return data?.data?.search?.results;
}

// Prune a FileMatch to only LLM-relevant fields
function pruneItem(item: any) {
  return {
    repo: item.repository?.name,
    path: item.file?.path,
    matches: item.lineMatches?.map((m: any) => ({ line: m.lineNumber, preview: m.preview })),
  };
}

// Compact line-oriented text — lowest token cost for LLM consumption
// Format:
//   repo:path
//     line: preview
function formatText(results: any[]): string {
  return results
    .map((item) => {
      const header = `${item.repo ?? "?"}:${item.path ?? "?"}`;
      const lines = (item.matches ?? [])
        .map((m: any) => `  ${m.line}: ${m.preview}`)
        .join("\n");
      return lines ? `${header}\n${lines}` : header;
    })
    .join("\n\n");
}

function output(data: any, format: string, full: boolean) {
  const meta = getMeta(data);
  const raw = getResults(data);
  const results = full ? raw : raw.map(pruneItem);

  if (format === "text") {
    const count = meta?.matchCount ?? results.length;
    const approx = meta?.approximateResultCount;
    const label = approx && approx !== String(count) ? `~${approx}` : String(count);
    process.stdout.write(`# ${label} result${count !== 1 ? "s" : ""}\n`);
    process.stdout.write(formatText(results) + "\n");
    return;
  }

  if (format === "json") {
    process.stdout.write(JSON.stringify(results));
    return;
  }

  // yaml
  process.stdout.write(YAML.stringify(results));
}

const argv = process.argv.slice(2);
// If no command provided, default to 'search'
if (argv.length > 0 && !argv[0].startsWith("-") && argv[0] !== "search") {
  argv.unshift("search");
}

const defaultFormat = "text";

yargs(argv)
  .scriptName("comfy-codesearch")
  .usage("$0 [search] <query>")
  .command(
    ["search <query>", "$0 <query>"],
    "Search code",
    (yargs) =>
      yargs
        .positional("query", {
          describe: "Search query (e.g., 'repo:Comfy-Org/ComfyUI last_node_id')",
          type: "string",
          demandOption: true,
        })
        .option("count", {
          alias: "c",
          type: "number",
          describe: "Max results",
          default: 30,
        })
        .option("format", {
          alias: "f",
          type: "string",
          describe: "Output format [text|yaml|json]",
          choices: ["text", "yaml", "json"],
          default: defaultFormat,
        })
        .option("full", {
          type: "boolean",
          describe: "Return all fields (skip pruning)",
          default: false,
        }),
    async (argv) => {
      try {
        let query = argv.query as string;
        if (!query.includes("count:")) query = `count:${argv.count} ${query}`;
        const res = await apiFetch("code", query);
        output(res, argv.format as string, argv.full as boolean);
      } catch (err: any) {
        console.error("Error:", err?.message || err);
        process.exit(1);
      }
    }
  )
  .help()
  .alias("h", "help")
  .epilogue(`
Examples:
  $0 "repo:Comfy-Org/ComfyUI last_node_id"
  $0 "video audio transcription" --count 10
  $0 "python" --format json
  $0 "python" --full --format yaml
  `)
  .parse();
