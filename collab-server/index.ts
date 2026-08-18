// Entry point only. Runs as a plain Node process (not through Next.js), so
// .env isn't loaded for us the way `next dev` does it — load it ourselves,
// BEFORE importing ./server (which constructs a PrismaClient and reads
// COLLAB_JWT_SECRET at module-load time). This has to be a dynamic import:
// a static `import "./server"` up top would be hoisted and evaluated before
// this file's own top-level code runs, defeating the env load entirely.
try {
  process.loadEnvFile();
} catch {
  // no .env file present — assume the environment already has what we need
  // (e.g. production, where env vars are injected directly)
}

import("./server");
