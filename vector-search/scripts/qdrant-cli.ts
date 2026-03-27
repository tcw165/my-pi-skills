#!/usr/bin/env tsx
/**
 * qdrant-cli.ts
 *
 * Search a Qdrant collection via semantic similarity and print matching
 * document payloads as plain text to stdout (pipeable to score-transactions.ts).
 *
 * Usage:
 *   npx tsx qdrant-cli.ts --search "FSA DCFSA eligibility rules"
 *   npx tsx qdrant-cli.ts --search "FSA eligible items" --collection forma_help_center --limit 5
 *
 * Env vars (override defaults):
 *   OLLAMA_URL   default: http://localhost:11434
 *   QDRANT_URL   default: http://localhost:6333
 *
 * Output format (stdout, pipeable):
 *   One block per result, separated by a blank line.
 *   Each block contains all string/number payload fields.
 *   Progress/errors go to stderr.
 */

import { Command } from "commander";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const QDRANT_URL = process.env.QDRANT_URL ?? "http://localhost:6333";
const EMBED_MODEL = "nomic-embed-text";

// ---------------------------------------------------------------------------
// Logging (stderr only — stdout is reserved for pipeable text output)
// ---------------------------------------------------------------------------

function info(msg: string) {
  process.stderr.write(`[info] ${msg}\n`);
}
function fatal(msg: string): never {
  process.stderr.write(`[error] ${msg}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Ollama embedding
// ---------------------------------------------------------------------------

async function generateEmbedding(query: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: query }),
  });

  if (!res.ok) {
    fatal(`Ollama request failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { embedding?: number[] };
  if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
    fatal("Ollama returned an empty embedding.");
  }

  return data.embedding;
}

// ---------------------------------------------------------------------------
// Qdrant search
// ---------------------------------------------------------------------------

interface QdrantResult {
  id: number | string;
  score: number;
  payload?: Record<string, unknown>;
}

async function searchQdrant(
  collection: string,
  vector: number[],
  limit: number,
): Promise<QdrantResult[]> {
  const res = await fetch(
    `${QDRANT_URL}/collections/${collection}/points/search`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vector, limit, with_payload: true }),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    fatal(`Qdrant request failed: ${res.status} ${res.statusText}\n${body}`);
  }

  const data = (await res.json()) as { result?: QdrantResult[] };
  return data.result ?? [];
}

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

function formatResult(result: QdrantResult, index: number): string {
  const lines: string[] = [];
  lines.push(`=== Result ${index + 1} (score: ${result.score.toFixed(4)}) ===`);

  const payload = result.payload ?? {};
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "string" || typeof value === "number") {
      const label = key.replace(/_/g, " ");
      lines.push(`${label}: ${value}`);
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

if (require.main === module) {
  const program = new Command()
    .name("qdrant-cli")
    .description("Semantic search over a Qdrant collection via Ollama embeddings.")
    .requiredOption("--search <query>", "Search query text")
    .option(
      "--collection <name>",
      "Qdrant collection name",
      "forma_help_center",
    )
    .option("--limit <n>", "Max results to return", (v) => parseInt(v, 10), 10);

  program.parse(process.argv);
  const opts = program.opts<{
    search: string;
    collection: string;
    limit: number;
  }>();

  async function main() {
    info(`Generating embedding for: "${opts.search}"`);
    const vector = await generateEmbedding(opts.search);
    info(`Embedding ready (${vector.length} dims). Querying Qdrant…`);

    const results = await searchQdrant(opts.collection, vector, opts.limit);

    if (results.length === 0) {
      process.stderr.write(
        `[warn] No results found in collection "${opts.collection}".\n`,
      );
      process.exit(0);
    }

    info(`${results.length} result(s) from "${opts.collection}"`);

    const blocks = results.map((r, i) => formatResult(r, i));
    process.stdout.write(blocks.join("\n\n") + "\n");
  }

  main().catch((e) => {
    fatal(e instanceof Error ? e.message : String(e));
  });
}
