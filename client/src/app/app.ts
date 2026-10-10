import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  effect,
  inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from './core/api/auth.service';
import { LANGUAGES, Lang, LanguageService } from './core/i18n';
import { ThemeService } from './core/theme.service';
import { Avatar } from './shared/avatar';
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
    Avatar,
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

  protected readonly auth = inject(AuthService);
  private readonly injector = inject(Injector);
  private askingName = false;

  constructor() {
    // Signed in with only an email? Ask for a name once (shown to the group and the organizer).
    effect(() => {
      const user = this.auth.user();
      if (!user?.needsName || this.askingName) return;
      this.askingName = true;
      import('./shared/name-dialog')
        .then((m) => m.openNameDialog(this.injector))
        .finally(() => (this.askingName = false));
    });
  }

  protected setLang(lang: Lang): void {
    this.language.set(lang);
  }
}
