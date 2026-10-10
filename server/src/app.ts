import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { pinoHttp } from 'pino-http';
import { cloudinaryEnabled, env, instantJoinEnabled, pushEnabled } from './config/env.js';
import { loadUser, requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { loadGroupMembership } from './middleware/group.js';
import { authRouter } from './routes/auth.js';
import { chatRouter } from './routes/chat.js';
import { drawRouter } from './routes/draw.js';
import { extrasRouter } from './routes/extras.js';
import { groupRouter, groupsRouter } from './routes/groups.js';
import { invitesRouter } from './routes/invites.js';
import { uploadsRouter } from './routes/uploads.js';
import { wishlistRouter } from './routes/wishlist.js';
import { logger } from './utils/logger.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
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
  app.use(errorHandler);
  return app;
}
