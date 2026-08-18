// Entry point only. Runs as a plain Node process (not through Next.js), so
// .env isn't loaded for us the way `next dev` does it — load it ourselves,
// BEFORE importing ./notifications-worker (which constructs a PrismaClient
// and a Redis connection at module-load time). Dynamic import, not a static
// one: a static `import "./notifications-worker"` up top would be hoisted
// and evaluated before this file's own top-level code runs, defeating the
// env load entirely — same fix as collab-server/index.ts.
try {
  process.loadEnvFile();
} catch {
  // no .env file present — assume the environment already has what we need
  // (e.g. production, where env vars are injected directly)
}

import("./notifications-worker");
