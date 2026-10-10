import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * Anonymous chat message. `threadKey` identifies the giver→receiver pair and is never sent
 * to clients, so a receiver can't learn who their Santa is.
 */
const messageSchema = new Schema({
  groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
  threadKey: { type: String, required: true },
  fromRole: { type: String, enum: ['santa', 'giftee'], required: true },
  text: { type: String, required: true, trim: true, maxlength: 1000 },
  createdAt: { type: Date, default: Date.now },
});

messageSchema.index({ groupId: 1, threadKey: 1, createdAt: 1 });

export type Message = InferSchemaType<typeof messageSchema>;
export const MessageModel = model('Message', messageSchema);

export const threadKeyFor = (giverId: unknown, receiverId: unknown) => `${giverId}>${receiverId}`;
