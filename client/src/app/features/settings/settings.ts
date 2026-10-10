import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { api } from '../../core/api/api';
import { AuthService, clearApiCaches } from '../../core/api/auth.service';
import { PushService } from '../../core/api/push.service';
import { LANGUAGES, Lang, LanguageService } from '../../core/i18n';
import { NotifyService } from '../../core/notify.service';
import { ThemeMode, ThemeService } from '../../core/theme.service';
import { confirmAction } from '../../shared/confirm-dialog';

@Component({
  selector: 'app-settings',
  imports: [
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSlideToggleModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings implements OnInit {
  protected readonly theme = inject(ThemeService);
  protected readonly language = inject(LanguageService);
  protected readonly auth = inject(AuthService);
  protected readonly push = inject(PushService);
  private readonly http = inject(HttpClient);
  private readonly notify = inject(NotifyService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  protected readonly languages = LANGUAGES;
  protected readonly themes: { mode: ThemeMode; icon: string }[] = [
    { mode: 'system', icon: 'brightness_auto' },
    { mode: 'light', icon: 'light_mode' },
    { mode: 'dark', icon: 'dark_mode' },
  ];
  protected readonly name = signal('');
  protected readonly busy = signal(false);

  constructor() {
    effect(() => this.name.set(this.auth.user()?.name ?? ''));
  }

  ngOnInit(): void {
    void this.push.refresh();
  }

  protected setLang(lang: Lang): void {
    this.language.set(lang);
  }

  protected async saveName(): Promise<void> {
    const name = this.name().trim();
    if (!name || name === this.auth.user()?.name) return;
    await this.run(async () => {
      await this.auth.updateMe({ name });
      this.notify.success('common.saved');
    });
  }

  protected async setEmail(enabled: boolean): Promise<void> {
    await this.run(() => this.auth.updateMe({ emailNotifications: enabled }).then(() => undefined));
  }

  protected async setPush(enabled: boolean): Promise<void> {
    await this.run(async () => {
      const state = enabled ? await this.push.enable() : await this.push.disable();
      if (enabled && state === 'denied') this.notify.success('settings.push.deniedHelp');
    });
  }

  protected async signOut(): Promise<void> {
    await this.run(async () => {
      await this.push.disable().catch(() => undefined);
      await this.auth.logout();
      await this.router.navigate(['/']);
    });
  }

  protected async deleteData(): Promise<void> {
    const ok = await confirmAction(this.dialog, {
      title: 'settings.deleteTitle',
      message: 'settings.deleteMessage',
      confirm: 'settings.deleteConfirm',
      danger: true,
    });
    if (!ok) return;
    await this.run(async () => {
      await this.push.disable().catch(() => undefined);
      await firstValueFrom(this.http.delete(api('/auth/me')));
      this.auth.user.set(null);
      await clearApiCaches();
      this.notify.success('settings.deleted');
      await this.router.navigate(['/']);
    });
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await fn();
    } catch (err) {
      this.notify.error(err);
    } finally {
      this.busy.set(false);
    }
  }
}
