import { DOCUMENT, Injectable, effect, inject, signal } from '@angular/core';
import { storage } from './storage';

export type ThemeMode = 'system' | 'light' | 'dark';
const KEY = 'ss.theme';

/** Light/dark theme. "system" follows `prefers-color-scheme` via CSS `color-scheme: light dark`. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);
  readonly mode = signal<ThemeMode>((storage.get(KEY) as ThemeMode) || 'system');

  constructor() {
    effect(() => {
      const mode = this.mode();
      const root = this.doc.documentElement;
      root.classList.toggle('theme-light', mode === 'light');
      root.classList.toggle('theme-dark', mode === 'dark');
      storage.set(KEY, mode);
    });
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);
  }

  /** Cycles system → light → dark. */
  cycle(): void {
    const order: ThemeMode[] = ['system', 'light', 'dark'];
    this.mode.set(order[(order.indexOf(this.mode()) + 1) % order.length]);
  }
}
