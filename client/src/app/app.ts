import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LANGUAGES, Lang, LanguageService } from './core/i18n';
import { ThemeService } from './core/theme.service';
import { WakeOverlay } from './shared/wake-overlay';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    TranslocoPipe,
    WakeOverlay,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly theme = inject(ThemeService);
  protected readonly language = inject(LanguageService);
  protected readonly languages = LANGUAGES;
  protected readonly themeIcon = computed(
    () =>
      ({ system: 'brightness_auto', light: 'light_mode', dark: 'dark_mode' })[this.theme.mode()],
  );

  protected setLang(lang: Lang): void {
    this.language.set(lang);
  }
}
