import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { LANGUAGES, Lang, LanguageService } from '../../core/i18n';
import { ThemeMode, ThemeService } from '../../core/theme.service';

@Component({
  selector: 'app-settings',
  imports: [MatButtonToggleModule, MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  protected readonly theme = inject(ThemeService);
  protected readonly language = inject(LanguageService);
  protected readonly languages = LANGUAGES;
  protected readonly themes: { mode: ThemeMode; icon: string }[] = [
    { mode: 'system', icon: 'brightness_auto' },
    { mode: 'light', icon: 'light_mode' },
    { mode: 'dark', icon: 'dark_mode' },
  ];

  protected setLang(lang: Lang): void {
    this.language.set(lang);
  }
}
