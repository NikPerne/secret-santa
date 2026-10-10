import { HttpClient } from '@angular/common/http';
import { DOCUMENT, Injectable, inject, signal } from '@angular/core';
import { Translation, TranslocoLoader, TranslocoService } from '@jsverse/transloco';
import { storage } from './storage';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'sl', label: 'Slovenščina' },
] as const;
export type Lang = (typeof LANGUAGES)[number]['code'];
const KEY = 'ss.lang';

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
  readonly current = signal<Lang>(this.initial());

  init(): void {
    this.apply(this.current());
  }

  set(lang: Lang): void {
    this.current.set(lang);
    storage.set(KEY, lang);
    this.apply(lang);
  }

  private apply(lang: Lang): void {
    this.transloco.setActiveLang(lang);
    this.doc.documentElement.lang = lang;
  }

  private initial(): Lang {
    const saved = storage.get(KEY);
    if (saved && LANGUAGES.some((l) => l.code === saved)) return saved as Lang;
    const nav = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'en';
    return nav.startsWith('sl') ? 'sl' : 'en';
  }
}
