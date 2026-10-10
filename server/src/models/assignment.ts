import { Schema, model, type InferSchemaType } from 'mongoose';

const assignmentSchema = new Schema(
  {
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    giverId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

assignmentSchema.index({ groupId: 1, giverId: 1 }, { unique: true });
assignmentSchema.index({ groupId: 1, receiverId: 1 }, { unique: true });

export type Assignment = InferSchemaType<typeof assignmentSchema>;
export const AssignmentModel = model('Assignment', assignmentSchema);
