import { env, isProd } from '../config/env.js';
import { logger } from '../utils/logger.js';

/** Render free web services sleep after 15 minutes without inbound traffic. */
const INTERVAL_MS = 10 * 60 * 1000;

/**
 * Pings the service's own public URL so it never idles long enough to sleep. The request goes out
 * through Render's load balancer, so it counts as inbound traffic. Each ping is a few hundred
 * bytes (~4,500 a month ≈ 2 MB). It can't wake a service that's already asleep, so an external
 * pinger (UptimeRobot, cron-job.org) on /api/health is a good backup.
 */
export function startKeepAlive(): () => void {
  const base = env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL;
  if (!isProd || !base || env.KEEP_ALIVE_URL === 'off') return () => undefined;
  const url = `${base.replace(/\/$/, '')}/api/health`;

  const timer = setInterval(() => {
    fetch(url, { signal: AbortSignal.timeout(30_000) })
      .then((res) => {
        if (!res.ok) logger.warn({ status: res.status }, 'Keep-alive ping failed');
      })
      .catch((err: Error) => logger.warn({ err: err.message }, 'Keep-alive ping failed'));
  }, INTERVAL_MS);
  timer.unref();
  logger.info(`Keep-alive: pinging ${url} every ${INTERVAL_MS / 60000} minutes`);
  return () => clearInterval(timer);
}
