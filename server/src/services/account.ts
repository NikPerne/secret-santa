import { GroupModel, MembershipModel, UserModel, type UserDoc } from '../models/index.js';
import { HttpError } from '../utils/http-error.js';
import { logger } from '../utils/logger.js';
import { removeMember } from './draw-runner.js';
import { deleteGroupData } from './group-data.js';

/**
 * "Delete my data": groups the user organizes are deleted entirely; in other groups the user is
 * removed (their Santa gets a new match where possible). Finally the user record is deleted.
 */
export async function deleteAccount(user: UserDoc): Promise<void> {
  const memberships = await MembershipModel.find({ userId: user._id });
  for (const m of memberships) {
    const group = await GroupModel.findById(m.groupId);
    if (!group) continue;
    if (m.role === 'organizer') {
      await deleteGroupData(group._id);
      continue;
    }
    try {
      await removeMember(group, user.id);
    } catch (err) {
      // The rules may make a reassignment impossible; removal must still happen.
      if (!(err instanceof HttpError)) throw err;
      logger.warn({ groupId: group.id }, 'Reassignment impossible during account deletion; forcing removal');
      await removeMember(group, user.id, { force: true });
    }
  }
  await UserModel.deleteOne({ _id: user._id });
}
