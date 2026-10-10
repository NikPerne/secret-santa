import { HttpClient } from '@angular/common/http';
import { DOCUMENT, Injectable, inject, signal } from '@angular/core';
import { DateAdapter } from '@angular/material/core';
import { Translation, TranslocoLoader, TranslocoService } from '@jsverse/transloco';
import { storage } from './storage';

export const LANGUAGES = [
  { code: 'en', label: 'English', locale: 'en-GB' },
  { code: 'sl', label: 'Slovenščina', locale: 'sl-SI' },
] as const;
export type Lang = (typeof LANGUAGES)[number]['code'];
const KEY = 'ss.lang';

export const localeFor = (lang: string) =>
  LANGUAGES.find((l) => l.code === lang)?.locale ?? 'en-GB';

@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);
  getTranslation(lang: string) {
    return this.http.get<Translation>(`/i18n/${lang}.json`);
  }
}

/** Runtime language switching (no rebuild), persisted locally and on the user's profile. */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);
  private readonly doc = inject(DOCUMENT);
  private readonly dateAdapter = inject(DateAdapter, { optional: true });
  readonly current = signal<Lang>(this.initial());
  /** True once the user picked a language on this device. */
  explicit = storage.get(KEY) !== null;
  /** Called after a user-initiated change (e.g. to save it on the profile). */
  onUserChange?: (lang: Lang) => void;

  init(): void {
    this.apply(this.current());
  }

  set(lang: Lang, userInitiated = true): void {
    this.current.set(lang);
    if (userInitiated) {
      this.explicit = true;
      storage.set(KEY, lang);
      this.onUserChange?.(lang);
    }
    this.apply(lang);
  }

  get locale(): string {
    return localeFor(this.current());
  }

  private apply(lang: Lang): void {
    this.transloco.setActiveLang(lang);
    this.doc.documentElement.lang = lang;
    this.dateAdapter?.setLocale(localeFor(lang));
  }

  private initial(): Lang {
    const saved = storage.get(KEY);
    if (saved && LANGUAGES.some((l) => l.code === saved)) return saved as Lang;
    // Slovenian by default; people can switch to English in the toolbar or settings.
    return 'sl';
  }
}
