import { Queue, Worker, type Processor } from "bullmq";
import IORedis from "ioredis";

/**
 * Shared Redis connection + small factory helpers for BullMQ queues/workers.
 * Introduced once here rather than per-feature — the same connection backs
 * the notification fan-out queue today, and is the intended home for the
 * collab-server multi-instance extension and the future media-transcription
 * queue (New plan/05-analisi-funzionali-ai.md, Parte C) later.
 */

const globalForRedis = globalThis as unknown as { redis?: IORedis };

export const redis =
  globalForRedis.redis ?? new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: null });

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

export function defineQueue<T>(name: string) {
  return new Queue<T>(name, { connection: redis });
}

export function defineWorker<T>(name: string, processor: Processor<T>) {
  return new Worker<T>(name, processor, { connection: redis });
}
