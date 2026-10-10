import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoService } from '@jsverse/transloco';
import { errorCode } from './api/api';

/** Toasts for success and (translated) API errors. */
@Injectable({ providedIn: 'root' })
export class NotifyService {
  private readonly snack = inject(MatSnackBar);
  private readonly t = inject(TranslocoService);

  success(key: string, params?: Record<string, unknown>): void {
    this.snack.open(this.t.translate(key, params), undefined, { duration: 3000 });
  }

  error(err: unknown): void {
    const code = errorCode(err);
    const key = `errors.${code}`;
    const translated = this.t.translate(key);
    const message = translated !== key ? translated : this.t.translate('common.error');
    this.snack.open(message, this.t.translate('common.close'), { duration: 6000 });
  }

  /** Translated message for an error, for inline display. */
  messageFor(err: unknown): string {
    const key = `errors.${errorCode(err)}`;
    const translated = this.t.translate(key);
    return translated !== key ? translated : this.t.translate('common.error');
  }
}
