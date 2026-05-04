import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function locateFixture(): string {
  const candidates = [
    process.env.SAMPLE_PDF,
    resolve(process.env.RUNFILES_DIR ?? ".", "_main/pdf-to-png/testdata/sample.pdf"),
    resolve(process.cwd(), "pdf-to-png/testdata/sample.pdf"),
  ].filter((p): p is string => Boolean(p));

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    `sample.pdf not found. Tried:\n  ${candidates.join("\n  ")}\n` +
      `Set SAMPLE_PDF or run via bazel so RUNFILES_DIR is populated.`,
  );
}

test("pdf-to-png skill produces page-N.png for /tmp/sample.pdf via headless claude", { timeout: 180_000 }, () => {
  const fixture = locateFixture();
  // Bazel runfiles are read-only; if we copyFileSync, the destination inherits
  // that mode and subsequent test runs fail with EACCES on overwrite. Read +
  // explicit-mode write avoids that.
  rmSync("/tmp/sample.pdf", { force: true });
  rmSync("/tmp/sample", { recursive: true, force: true });
  writeFileSync("/tmp/sample.pdf", readFileSync(fixture), { mode: 0o644 });

  const res = spawnSync(
    "claude",
    [
      "-p",
      "Use the pdf-to-png skill to convert /tmp/sample.pdf into PNGs. Do not ask follow-up questions. When done, list the produced files.",
      "--allowedTools",
      "Bash",
    ],
    { encoding: "utf8", timeout: 150_000 },
  );

  assert.equal(
    res.status,
    0,
    `claude exited ${res.status}\nstdout:\n${res.stdout}\nstderr:\n${res.stderr}`,
  );

  assert.ok(
    statSync("/tmp/sample").isDirectory(),
    "expected /tmp/sample/ to be created by the skill",
  );

  const pngs = readdirSync("/tmp/sample").filter((f) => /^page-\d+\.png$/.test(f));
  assert.ok(
    pngs.length >= 1,
    `expected at least one page-N.png in /tmp/sample/, got: ${JSON.stringify(pngs)}`,
  );

  for (const f of pngs) {
    const buf = readFileSync(`/tmp/sample/${f}`);
    assert.ok(
      buf.subarray(0, 8).equals(PNG_MAGIC),
      `${f} (${buf.length} bytes) does not start with the PNG magic header`,
    );
  }
});
