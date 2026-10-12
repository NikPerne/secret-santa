import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
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
import { GroupsService } from '../../core/api/groups.service';
import { ImageError, UploadService } from '../../core/api/upload.service';
import { Avatar } from '../../shared/avatar';
import { confirmAction } from '../../shared/confirm-dialog';
import { PasswordFields } from '../auth/password-fields';

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
    MatProgressBarModule,
    Avatar,
    MatSlideToggleModule,
    PasswordFields,
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
  protected readonly uploads = signal(false);
  protected readonly avatarProgress = signal<number | null>(null);
  private readonly uploadService = inject(UploadService);
  private readonly groupsApi = inject(GroupsService);
  protected readonly currentPassword = signal('');
  /** Valid and confirmed, or '' (see PasswordFields). */
  protected readonly newPassword = signal('');
  private readonly newPasswordFields = viewChild<PasswordFields>('newPw');

  constructor() {
    effect(() => this.name.set(this.auth.user()?.name ?? ''));
  }

  ngOnInit(): void {
    void this.push.refresh();
    this.groupsApi
      .config()
      .then((c) => this.uploads.set(c.uploads))
      .catch(() => undefined);
  }

  /** Pick → resize to 512px in the browser → signed upload → save on the profile. */
  protected onAvatar(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.busy.set(true);
    this.avatarProgress.set(0);
    this.uploadService.upload(file, null, 'avatar').subscribe({
      next: (e) => {
        if (e.type === 'progress') this.avatarProgress.set(e.percent);
        else
          void this.auth
            .updateMe({ avatar: e.image })
            .then(() => this.notify.success('common.saved'))
            .catch((err: unknown) => this.notify.error(err));
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.avatarProgress.set(null);
        if (err instanceof ImageError) this.notify.success(`image.errors.${err.code}`);
        else this.notify.error(err);
      },
      complete: () => {
        this.busy.set(false);
        this.avatarProgress.set(null);
      },
    });
  }

  protected async removeAvatar(): Promise<void> {
    await this.run(() => this.auth.updateMe({ avatar: null }).then(() => undefined));
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

  protected async changePassword(): Promise<void> {
    if (!this.currentPassword() || !this.newPassword()) return;
    await this.run(async () => {
      await this.auth.changePassword(this.currentPassword(), this.newPassword());
      this.currentPassword.set('');
      this.newPasswordFields()?.clear();
      this.notify.success('password.changed');
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
      this.auth.clear();
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
