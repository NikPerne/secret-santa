import { Router, type Request } from 'express';
import { z } from 'zod';
import { groupCtx } from '../middleware/group.js';
import { chatLimiter } from '../middleware/rate-limit.js';
import { parse, trimmed } from '../middleware/validate.js';
import {
  AssignmentModel,
  MessageModel,
  UserModel,
  claimNotification,
  threadKeyFor,
} from '../models/index.js';
import { notifyUser } from '../services/notify.js';
import { conflict, notFound } from '../utils/http-error.js';

export const chatRouter = Router({ mergeParams: true });

/**
 * Two threads per person: "match" (I'm the Santa, talking to my giftee) and "santa" (I'm the
 * giftee, talking to my anonymous Santa). Responses never contain user ids or the thread key.
 */
const whoParam = z.object({ who: z.enum(['match', 'santa']) });

async function resolveThread(req: Request) {
  const { group, membership } = groupCtx(req);
  const { who } = parse(whoParam, req.params);
  if (group.status === 'open') throw conflict('not_drawn', 'Names have not been drawn yet');
  const me = membership.userId;
  const assignment =
    who === 'match'
      ? await AssignmentModel.findOne({ groupId: group._id, giverId: me })
      : await AssignmentModel.findOne({ groupId: group._id, receiverId: me });
  if (!assignment) throw notFound('No chat partner');
  return {
    group,
    threadKey: threadKeyFor(assignment.giverId, assignment.receiverId),
    myRole: who === 'match' ? ('santa' as const) : ('giftee' as const),
    otherUserId: who === 'match' ? assignment.receiverId : assignment.giverId,
    otherWho: who === 'match' ? 'santa' : 'match',
  };
}

chatRouter.get('/chat/:who', async (req, res) => {
  const { group, threadKey, myRole } = await resolveThread(req);
  const { after } = parse(z.object({ after: z.string().datetime().optional() }), req.query);
  const messages = await MessageModel.find({
    groupId: group._id,
    threadKey,
    ...(after ? { createdAt: { $gt: new Date(after) } } : {}),
  })
    .sort({ createdAt: 1 })
    .limit(500);
  res.json({
    messages: messages.map((m) => ({
      id: m.id as string,
      mine: m.fromRole === myRole,
      text: m.text,
      createdAt: m.createdAt.toISOString(),
    })),
  });
});

chatRouter.post('/chat/:who', chatLimiter, async (req, res) => {
  const { group, threadKey, myRole, otherUserId } = await resolveThread(req);
  const { text } = parse(z.object({ text: trimmed(1000).min(1) }), req.body);
  const message = await MessageModel.create({ groupId: group._id, threadKey, fromRole: myRole, text });

  // Push at most one "new message" notification per thread direction every 10 minutes.
  const bucket = Math.floor(Date.now() / (10 * 60 * 1000));
  if (await claimNotification(`msg:${threadKey}:${myRole}:${bucket}`, group._id)) {
    const other = await UserModel.findById(otherUserId);
    if (other) void notifyUser(other, 'newMessage', group);
  }

  res.status(201).json({
    message: {
      id: message.id as string,
      mine: true,
      text: message.text,
      createdAt: message.createdAt.toISOString(),
    },
  });
});
