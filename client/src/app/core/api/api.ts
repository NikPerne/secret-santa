import { HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiErrorBody } from '../models';

export const api = (path: string) => `${environment.apiUrl}/api${path}`;

/** Extracts the API error code (e.g. "invalid_token") from an HttpErrorResponse. */
export function errorCode(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as ApiErrorBody | null;
    if (body?.error?.code) return body.error.code;
    if (err.status === 0) return 'offline';
  }
  return 'unknown';
}

export function errorMessage(err: unknown): string | undefined {
  if (err instanceof HttpErrorResponse) return (err.error as ApiErrorBody | null)?.error?.message;
  return undefined;
}
