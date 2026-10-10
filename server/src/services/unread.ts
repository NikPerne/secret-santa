import {
  AssignmentModel,
  MessageModel,
  threadKeyFor,
  type GroupDoc,
  type MembershipDoc,
} from '../models/index.js';

export interface UnreadCounts {
  /** Messages from my giftee in the chat where I'm the Santa. */
  match: number;
  /** Messages from my Santa in the chat where I'm the giftee. */
  santa: number;
}

/** Counts messages from the other side that arrived after I last opened each chat. */
export async function unreadCounts(group: GroupDoc, membership: MembershipDoc): Promise<UnreadCounts> {
  if (group.status === 'open' || !membership.participates) return { match: 0, santa: 0 };
  const me = membership.userId;
  const [asGiver, asReceiver] = await Promise.all([
    AssignmentModel.findOne({ groupId: group._id, giverId: me }, { receiverId: 1 }),
    AssignmentModel.findOne({ groupId: group._id, receiverId: me }, { giverId: 1 }),
  ]);
  const since = (d: Date | null | undefined) => (d ? { createdAt: { $gt: d } } : {});
  const [match, santa] = await Promise.all([
    asGiver
      ? MessageModel.countDocuments({
          groupId: group._id,
          threadKey: threadKeyFor(me, asGiver.receiverId),
          fromRole: 'giftee',
          ...since(membership.chatReadAt?.match),
        })
      : 0,
    asReceiver
      ? MessageModel.countDocuments({
          groupId: group._id,
          threadKey: threadKeyFor(asReceiver.giverId, me),
          fromRole: 'santa',
          ...since(membership.chatReadAt?.santa),
        })
      : 0,
  ]);
  return { match, santa };
}
