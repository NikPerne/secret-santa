import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize, retry, throwError, timer } from 'rxjs';
import { environment } from '../../environments/environment';
import { WakeUpService } from './wake-up.service';

const SLOW_MS = 2000;
const MAX_RETRIES = 8;

/** Marks background requests (e.g. chat polling) that must not show the wake-up overlay. */
export const BACKGROUND = new HttpContextToken<boolean>(() => false);

const isApi = (url: string) => url.startsWith(`${environment.apiUrl}/api/`);

/** Sends the auth cookie with API calls (needed when the API is on another origin). */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) =>
  next(isApi(req.url) ? req.clone({ withCredentials: true }) : req);

/** True for errors that typically mean "the API is still waking up". */
function isColdStartError(err: unknown, method: string): boolean {
  if (!(err instanceof HttpErrorResponse)) return false;
  if ([502, 503, 504].includes(err.status)) return true;
  // A network error on a non-idempotent request might have reached the server, so only retry reads.
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  return err.status === 0 && !offline && (method === 'GET' || method === 'HEAD');
}

/**
 * Shows the "Waking up the elves…" overlay when an API request takes longer than 2s and
 * retries requests that fail while the free-tier API is cold-starting.
 */
export const wakeUpInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApi(req.url) || req.context.get(BACKGROUND)) return next(req);
  const wake = inject(WakeUpService);
  let shown = false;
  const show = () => {
    if (!shown) {
      shown = true;
      wake.begin();
    }
  };
  const slowTimer = setTimeout(show, SLOW_MS);

  return next(req).pipe(
    retry({
      count: MAX_RETRIES,
      delay: (err, attempt) => {
        if (!isColdStartError(err, req.method)) return throwError(() => err);
        show();
        return timer(Math.min(1500 * attempt, 8000));
      },
    }),
    finalize(() => {
      clearTimeout(slowTimer);
      if (shown) wake.end();
    }),
  );
};
