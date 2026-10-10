export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
    public readonly details?: unknown,
  ) {
    super(message ?? code);
  }
}

export const badRequest = (code: string, message?: string, details?: unknown) =>
  new HttpError(400, code, message, details);
export const unauthorized = (message = 'Please sign in') => new HttpError(401, 'unauthorized', message);
export const forbidden = (message = 'You do not have access to this') =>
  new HttpError(403, 'forbidden', message);
export const notFound = (message = 'Not found') => new HttpError(404, 'not_found', message);
export const conflict = (code: string, message?: string, details?: unknown) =>
  new HttpError(409, code, message, details);
