import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/api/auth.service';
import { GroupsService } from '../../core/api/groups.service';
import { NotifyService } from '../../core/notify.service';

@Component({
  selector: 'app-signin',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page stack narrow">
      <h1 class="page-title">{{ 'signin.title' | transloco }}</h1>
      <p class="muted">{{ 'signin.subtitle' | transloco }}</p>
      <form class="stack" (ngSubmit)="submit()" #f="ngForm">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'fields.email' | transloco }}</mat-label>
          <input
            matInput
            type="email"
            name="email"
            autocomplete="username"
            inputmode="email"
            required
            email
            [ngModel]="email()"
            (ngModelChange)="email.set($event)"
          />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'fields.password' | transloco }}</mat-label>
          <input
            matInput
            [type]="showPassword() ? 'text' : 'password'"
            name="password"
            autocomplete="current-password"
            required
            [ngModel]="password()"
            (ngModelChange)="password.set($event)"
          />
          <button
            mat-icon-button
            matSuffix
            type="button"
            (click)="showPassword.set(!showPassword())"
            [attr.aria-label]="'password.show' | transloco"
            [attr.aria-pressed]="showPassword()"
          >
            <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
          </button>
        </mat-form-field>
        <button
          mat-flat-button
          class="big-button"
          type="submit"
          [disabled]="!email().trim() || !password() || busy()"
        >
          <mat-icon>login</mat-icon>{{ 'signin.submit' | transloco }}
        </button>
        @if (instantJoin()) {
          <button
            mat-stroked-button
            type="button"
            class="big-button"
            [disabled]="!email().trim() || busy()"
            (click)="instant()"
          >
            <mat-icon>bolt</mat-icon>{{ 'signin.instant' | transloco }}
          </button>
        }
      </form>
      <p class="muted small">{{ 'signin.noAccount' | transloco }}</p>

      @if (setupSent()) {
        <div class="surface-card stack" role="status">
          <p>{{ 'signin.adminSetupSent' | transloco: { email: email().trim() } }}</p>
          @if (devLink(); as link) {
            <p class="muted">{{ 'signin.devLink' | transloco }}</p>
            <a mat-flat-button [href]="link">{{ 'signin.openLink' | transloco }}</a>
          }
        </div>
      } @else {
        <button
          mat-button
          type="button"
          class="admin-setup"
          [disabled]="!email().trim() || busy()"
          (click)="adminSetup()"
        >
          {{ 'signin.adminSetup' | transloco }}
        </button>
      }
    </section>
  `,
  styles: `
    .narrow {
      max-width: 460px;
    }
    .small {
      font: var(--mat-sys-body-small);
      margin: 0;
    }
    .admin-setup {
      align-self: flex-start;
    }
  `,
})
export class SignIn {
  readonly redirect = input<string>();
  private readonly auth = inject(AuthService);
  private readonly groups = inject(GroupsService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotifyService);

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly showPassword = signal(false);
  protected readonly busy = signal(false);
  protected readonly instantJoin = signal(false);
  protected readonly setupSent = signal(false);
  protected readonly devLink = signal<string | undefined>(undefined);

  constructor() {
    this.groups
      .config()
      .then((c) => this.instantJoin.set(c.instantJoin))
      .catch(() => undefined);
    void this.auth.ready().then((u) => {
      if (u) void this.router.navigateByUrl(this.safeRedirect());
    });
  }

  private safeRedirect(): string {
    const r = this.redirect();
    return r && r.startsWith('/') && !r.startsWith('//') ? r : '/';
  }

  protected async submit(): Promise<void> {
    await this.run(async () => {
      await this.auth.login(this.email().trim(), this.password());
      await this.router.navigateByUrl(this.safeRedirect());
    });
  }

  protected async instant(): Promise<void> {
    await this.run(async () => {
      await this.auth.devLogin({ email: this.email().trim() });
      await this.router.navigateByUrl(this.safeRedirect());
    });
  }

  /** An admin from ADMIN_EMAILS signing in for the very first time. */
  protected async adminSetup(): Promise<void> {
    await this.run(async () => {
      const res = await this.auth.adminSetup(this.email().trim());
      this.devLink.set(res.devLink);
      this.setupSent.set(true);
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
