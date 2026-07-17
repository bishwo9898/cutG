import { AI_HAIR_QUEUE_NAME, type HairStudioJob } from '@barber-saas/shared-types';
import { Queue } from 'bullmq';

import { env } from '../../config/env';

const redisConnection = (): { host: string; port: number; password?: string; db?: number } => {
  const url = new URL(env.REDIS_URL);
  const database = Number(url.pathname.replace('/', '') || 0);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.password === '' ? {} : { password: decodeURIComponent(url.password) }),
    ...(database === 0 ? {} : { db: database }),
  };
};

let queue: Queue<HairStudioJob> | null = null;

const getQueue = (): Queue<HairStudioJob> => {
  queue ??= new Queue<HairStudioJob>(AI_HAIR_QUEUE_NAME, { connection: redisConnection() });
  return queue;
};

export const enqueueHairStudioJob = async (job: HairStudioJob): Promise<void> => {
  if (env.NODE_ENV === 'test') return;

  const jobId =
    job.kind === 'ANALYZE_SCAN' ? `scan-${job.scanId}` : `generation-${job.generationId}`;
  await getQueue().add(job.kind, job, {
    jobId,
    attempts: 1,
    removeOnComplete: 100,
    removeOnFail: 500,
  });
};

export const closeHairStudioQueue = async (): Promise<void> => {
  if (queue !== null) await queue.close();
};
