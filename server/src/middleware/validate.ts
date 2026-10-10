import { isValidObjectId } from 'mongoose';
import { z } from 'zod';

/** Parses input with a Zod schema; a failure becomes a 400 via the error handler. */
export const parse = <T extends z.ZodType>(schema: T, input: unknown): z.infer<T> => schema.parse(input);

export const objectId = z.string().refine((v) => isValidObjectId(v), 'Invalid id');
export const trimmed = (max: number) => z.string().trim().max(max);
export const optionalUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => v === '' || /^https?:\/\//i.test(v), 'Must start with http:// or https://')
  .optional();

/** A Cloudinary image reference submitted by the client (ownership is checked separately). */
export const imageInput = z.object({
  url: z.string().url().max(500),
  publicId: z.string().min(1).max(300),
  width: z.number().int().positive().max(20000).optional(),
  height: z.number().int().positive().max(20000).optional(),
});
