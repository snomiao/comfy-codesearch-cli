#!/usr/bin/env bun
// Public CLI for ComfyUI Code Search
// Routes all queries through the Vercel proxy at comfy-codesearch.vercel.app
//
// Usage:
//   bun ./cli.ts search "<query>"   # code search
//   bun ./cli.ts repo   "<query>"   # repository search

import yargs from "yargs";
import YAML from "yaml";

const API_BASE = process.env.CS_SERVICE || "https://comfy-codesearch.vercel.app";

async function apiFetch(endpoint: string, query: string) {
  const url = `${API_BASE}/api/search/${endpoint}?query=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}

function output(data: any, format: string) {
  if (format === "json") {
    process.stdout.write(JSON.stringify(data, null, 2));
  } else {
    process.stdout.write(YAML.stringify(data));
  }
}

const argv = process.argv.slice(2);
// If no command provided, default to 'search'
if (argv.length > 0 && !argv[0].startsWith('-') && argv[0] !== 'search' && argv[0] !== 'repo') {
  argv.unshift('search');
}

yargs(argv)
  .scriptName("comfy-codesearch")
  .usage("$0 [command] <query>")
  .command(
    ["search <query>", "$0 <query>"],
    "Search code (default command)",
    (yargs) => {
      return yargs
        .positional("query", {
          describe: "Search query (e.g., 'repo:Comfy-Org/ComfyUI last_node_id')",
          type: "string",
          demandOption: true,
        })
        .option("count", {
          alias: "c",
          type: "number",
          describe: "Max results to fetch (default: 100)",
          default: 100,
        })
        .option("format", {
          alias: "f",
          type: "string",
          describe: "Output format",
          choices: ["yaml", "json"],
          default: "yaml",
        });
    },
    async (argv) => {
      try {
        let query = argv.query as string;
        if (argv.count && !query.includes("count:")) {
          query = `count:${argv.count} ${query}`;
        }
        const res = await apiFetch("code", query);
        output(res, argv.format as string);
      } catch (err: any) {
        console.error("Error:", err?.message || err);
        process.exit(1);
      }
    }
  )
  .command(
    "repo <query>",
    "Search repositories",
    (yargs) => {
      return yargs
        .positional("query", {
          describe: "Repository search query",
          type: "string",
          demandOption: true,
        })
        .option("format", {
          alias: "f",
          type: "string",
          describe: "Output format",
          choices: ["yaml", "json"],
          default: "yaml",
        });
    },
    async (argv) => {
      try {
        const res = await apiFetch("repo", argv.query as string);
        output(res, argv.format as string);
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
  $0 search "video audio transcription"
  $0 search "python" --count 200
  $0 search "python" --format json
  $0 repo "comfy"
  `)
  .parse();
