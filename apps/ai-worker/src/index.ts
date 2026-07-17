import { AI_HAIR_QUEUE_NAME, type HairStudioJob } from '@barber-saas/shared-types';
import { Queue, Worker } from 'bullmq';

import { config, redisConnection } from './config';
import { database, query } from './database';
import { cleanupExpiredScans, processHairStudioJob } from './processor';

type Row = Record<string, unknown>;
const connection = redisConnection();
const queue = new Queue<HairStudioJob>(AI_HAIR_QUEUE_NAME, { connection });

const recoverJobs = async (): Promise<void> => {
  await query(
    `UPDATE hair_design_generations SET status='FAILED',progress=100,
      error_code='WORKER_RESTART_UNCERTAIN',
      error_message='Processing was interrupted. Please retry explicitly.',failed_at=CURRENT_TIMESTAMP
     WHERE status='PROCESSING' AND started_at < CURRENT_TIMESTAMP - interval '15 minutes'`,
  );
  await query(
    `UPDATE client_hair_designs d SET ai_status='failed',
      ai_error_code='WORKER_RESTART_UNCERTAIN',
      ai_error_message='Processing was interrupted. Please retry explicitly.'
     FROM hair_design_generations g
     WHERE d.current_generation_id=g.id AND g.error_code='WORKER_RESTART_UNCERTAIN'`,
  );
  await query(
    `UPDATE hair_scan_sessions SET analysis_status='QUEUED'
     WHERE analysis_status='PROCESSING' AND updated_at < CURRENT_TIMESTAMP - interval '15 minutes'`,
  );

  const scans = await query<Row>(
    "SELECT id,client_id FROM hair_scan_sessions WHERE analysis_status='QUEUED' AND status='READY'",
  );
  for (const scan of scans) {
    await queue.add(
      'ANALYZE_SCAN',
      { kind: 'ANALYZE_SCAN', scanId: String(scan.id), clientId: String(scan.client_id) },
      { jobId: `scan-${String(scan.id)}`, attempts: 1, removeOnComplete: 100, removeOnFail: 500 },
    );
  }
  const generations = await query<Row>(
    `SELECT g.id,d.client_id FROM hair_design_generations g
     JOIN client_hair_designs d ON d.id=g.design_id WHERE g.status='QUEUED'`,
  );
  for (const generation of generations) {
    await queue.add(
      'GENERATE_DESIGN',
      {
        kind: 'GENERATE_DESIGN',
        generationId: String(generation.id),
        clientId: String(generation.client_id),
      },
      {
        jobId: `generation-${String(generation.id)}`,
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );
  }
};

const start = async (): Promise<void> => {
  await cleanupExpiredScans();
  await recoverJobs();

  const worker = new Worker<HairStudioJob>(AI_HAIR_QUEUE_NAME, processHairStudioJob, {
    connection,
    concurrency: config.concurrency,
    lockDuration: 10 * 60 * 1000,
  });

  worker.on('completed', (job) => {
    console.info(JSON.stringify({ service: 'ai-worker', event: 'completed', jobId: job.id }));
  });
  worker.on('failed', (job, error) => {
    console.error(
      JSON.stringify({
        service: 'ai-worker',
        event: 'failed',
        jobId: job?.id,
        message: error.message,
      }),
    );
  });

  const cleanupTimer = setInterval(() => void cleanupExpiredScans(), 60 * 60 * 1000);
  cleanupTimer.unref();

  const shutdown = async (): Promise<void> => {
    clearInterval(cleanupTimer);
    await worker.close();
    await queue.close();
    await database.end();
  };

  process.once('SIGINT', () => void shutdown().then(() => process.exit(0)));
  process.once('SIGTERM', () => void shutdown().then(() => process.exit(0)));

  console.info(
    JSON.stringify({
      service: 'ai-worker',
      status: 'ready',
      provider: config.provider,
      concurrency: config.concurrency,
    }),
  );
};

void start().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      service: 'ai-worker',
      status: 'startup_failed',
      message: error instanceof Error ? error.message : 'Unknown startup error.',
    }),
  );
  process.exitCode = 1;
});
