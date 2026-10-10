import { Pipe, PipeTransform, inject } from '@angular/core';
import { LanguageService } from '../core/i18n';
import { Budget } from '../core/models';

const formatters = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat>();
function cached<T extends Intl.DateTimeFormat | Intl.NumberFormat>(key: string, make: () => T): T {
  let f = formatters.get(key);
  if (!f) {
    f = make();
    formatters.set(key, f);
  }
  return f as T;
}

/** Locale-aware date formatting that follows the runtime language switch. */
@Pipe({ name: 'localDate', pure: false })
export class LocalDatePipe implements PipeTransform {
  private readonly lang = inject(LanguageService);

  transform(
    value: string | Date | null | undefined,
    style: 'long' | 'short' | 'time' = 'long',
  ): string {
    if (!value) return '';
    const locale = this.lang.locale;
    const opts: Intl.DateTimeFormatOptions =
      style === 'time'
        ? { dateStyle: 'short', timeStyle: 'short' }
        : { dateStyle: style === 'long' ? 'full' : 'medium' };
    return cached(`d:${locale}:${style}`, () => new Intl.DateTimeFormat(locale, opts)).format(
      new Date(value),
    );
  }
}

@Pipe({ name: 'money', pure: false })
export class MoneyPipe implements PipeTransform {
  private readonly lang = inject(LanguageService);

  transform(value: Budget | number | null | undefined, currency = 'EUR'): string {
    const amount = typeof value === 'number' ? value : value?.amount;
    const cur = typeof value === 'object' && value ? value.currency : currency;
    if (amount === null || amount === undefined) return '';
    const locale = this.lang.locale;
    return cached(
      `m:${locale}:${cur}`,
      () =>
        new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: cur,
          maximumFractionDigits: 2,
          minimumFractionDigits: 0,
        }),
    ).format(amount);
  }
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
