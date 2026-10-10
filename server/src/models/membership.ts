import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const GIFT_STATUSES = ['none', 'bought', 'delivered'] as const;
export type GiftStatus = (typeof GIFT_STATUSES)[number];

const membershipSchema = new Schema({
  groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: { type: String, enum: ['organizer', 'participant'], required: true },
  /** False only for an organizer who runs the group without taking part in the draw. */
  participates: { type: Boolean, default: true },
  joinedAt: { type: Date, default: Date.now },
  viewedMatchAt: { type: Date, default: null },
  giftStatus: { type: String, enum: GIFT_STATUSES, default: 'none' },
  shippingAddress: { type: String, trim: true, maxlength: 500, default: '' },
  /** When I last read each of my two chats (for unread badges). */
  chatReadAt: {
    match: { type: Date, default: null },
    santa: { type: Date, default: null },
  },
});

membershipSchema.index({ groupId: 1, userId: 1 }, { unique: true });

export type Membership = InferSchemaType<typeof membershipSchema>;
export type MembershipDoc = HydratedDocument<Membership>;
export const MembershipModel = model('Membership', membershipSchema);
