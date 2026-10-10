import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { pinoHttp } from 'pino-http';
import { cloudinaryEnabled, env, instantJoinEnabled, isProd, pushEnabled } from './config/env.js';
import { loadUser, requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { loadGroupMembership } from './middleware/group.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { chatRouter } from './routes/chat.js';
import { drawRouter } from './routes/draw.js';
import { extrasRouter } from './routes/extras.js';
import { groupRouter, groupsRouter } from './routes/groups.js';
import { invitesRouter } from './routes/invites.js';
import { pushRouter } from './routes/push.js';
import { uploadsRouter } from './routes/uploads.js';
import { wishlistRouter } from './routes/wishlist.js';
import { serveClient } from './static.js';
import { logger } from './utils/logger.js';

export function createApp(options: { staticDir?: string } = {}) {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
          // The service worker fetches fonts and Cloudinary images for offline caching.
          connectSrc: [
            "'self'",
            'https://api.cloudinary.com',
            'https://res.cloudinary.com',
            'https://fonts.googleapis.com',
            'https://fonts.gstatic.com',
          ],
          workerSrc: ["'self'"],
          manifestSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          ...(isProd ? { upgradeInsecureRequests: [] } : {}),
        },
      },
    }),
  );
  // gzip everything (JS bundles shrink ~4x): the biggest saver on Render's monthly bandwidth.
  app.use(compression());
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  if (env.NODE_ENV !== 'test') {
    app.use(
      pinoHttp({
        logger,
        autoLogging: { ignore: (req) => req.url === '/api/health' },
        // Keep logs short and free of cookies/headers.
        serializers: {
          req: (req: { method: string; url: string }) => ({ method: req.method, url: req.url.split('?')[0] }),
          res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
        },
      }),
    );
  }

  app.get('/api/health', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({
      ok: true,
      db: mongoose.connection.readyState === 1 ? 'up' : 'down',
      time: new Date().toISOString(),
    });
  });

  app.use('/api', loadUser);
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  /** Public, non-secret feature flags for the client. */
  app.get('/api/config', (_req, res) => {
    res.json({
      instantJoin: instantJoinEnabled,
      uploads: cloudinaryEnabled,
      pushPublicKey: pushEnabled ? env.VAPID_PUBLIC_KEY : null,
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/invites', invitesRouter);
  app.use('/api/groups', requireAuth, groupsRouter);
  app.use('/api/uploads', requireAuth, uploadsRouter);
  app.use('/api/push', requireAuth, pushRouter);
  app.use('/api/admin', requireAuth, adminRouter);
  app.use(
    '/api/groups/:groupId',
    requireAuth,
    loadGroupMembership,
    groupRouter,
    drawRouter,
    wishlistRouter,
    chatRouter,
    extrasRouter,
  );

  app.use('/api', notFoundHandler);
  // The Angular app itself (single service, same origin). Skipped when there's no build.
  if (env.NODE_ENV !== 'test' || options.staticDir) serveClient(app, options.staticDir);
  app.use(errorHandler);
  return app;
}
