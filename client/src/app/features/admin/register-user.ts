import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AdminService } from '../../core/api/admin.service';
import { LANGUAGES, Lang, LanguageService } from '../../core/i18n';
import { NotifyService } from '../../core/notify.service';

/** Admin-only: create an account; the person gets an email to choose their password. */
@Component({
  selector: 'app-register-user',
  imports: [
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page stack narrow">
      <a mat-button routerLink="/admin" class="back">
        <mat-icon>arrow_back</mat-icon>{{ 'admin.title' | transloco }}
      </a>
      <h1 class="page-title">{{ 'register.title' | transloco }}</h1>
      <p class="muted lead">{{ 'register.subtitle' | transloco }}</p>

      @if (created(); as c) {
        <div class="surface-card stack" role="status">
          <p>
            {{ (c.sent ? 'register.sent' : 'register.notSent') | transloco: { email: c.email } }}
          </p>
          @if (c.devLink) {
            <p class="muted">{{ 'signin.devLink' | transloco }}</p>
            <a mat-stroked-button [href]="c.devLink">{{ 'signin.openLink' | transloco }}</a>
          }
        </div>
      }

      <form class="stack" (ngSubmit)="submit(f)" #f="ngForm">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'register.username' | transloco }}</mat-label>
          <input
            matInput
            name="name"
            autocomplete="off"
            required
            maxlength="60"
            [ngModel]="name()"
            (ngModelChange)="name.set($event)"
          />
          <mat-hint>{{ 'register.usernameHint' | transloco }}</mat-hint>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'fields.email' | transloco }}</mat-label>
          <input
            matInput
            type="email"
            name="email"
            autocomplete="off"
            inputmode="email"
            required
            email
            maxlength="200"
            [ngModel]="email()"
            (ngModelChange)="email.set($event)"
          />
        </mat-form-field>
        <div class="stack lang">
          <span class="muted">{{ 'register.emailLanguage' | transloco }}</span>
          <mat-button-toggle-group
            [value]="lang()"
            (change)="lang.set($event.value)"
            [attr.aria-label]="'register.emailLanguage' | transloco"
          >
            @for (l of languages; track l.code) {
              <mat-button-toggle [value]="l.code" [attr.lang]="l.code">{{
                l.label
              }}</mat-button-toggle>
            }
          </mat-button-toggle-group>
        </div>
        <button mat-flat-button class="big-button" type="submit" [disabled]="f.invalid || busy()">
          <mat-icon>person_add</mat-icon>{{ 'register.submit' | transloco }}
        </button>
      </form>
    </section>
  `,
  styles: `
    .narrow {
      max-width: 460px;
    }
    .back {
      align-self: flex-start;
    }
    .lead {
      margin: 0 0 8px;
    }
    .lang {
      gap: 6px;
    }
  `,
})
export class RegisterUser {
  private readonly admin = inject(AdminService);
  private readonly notify = inject(NotifyService);
  protected readonly languages = LANGUAGES;

  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly lang = signal<Lang>(inject(LanguageService).current());
  protected readonly busy = signal(false);
  protected readonly created = signal<{ email: string; sent: boolean; devLink?: string } | null>(
    null,
  );

  protected async submit(form: NgForm): Promise<void> {
    this.busy.set(true);
    try {
      const res = await this.admin.register({
        name: this.name().trim(),
        email: this.email().trim(),
        language: this.lang(),
      });
      this.created.set({ email: res.user.email, sent: res.sent, devLink: res.devLink });
      form.resetForm();
      this.name.set('');
      this.email.set('');
    } catch (err) {
      this.notify.error(err);
    } finally {
      this.busy.set(false);
    }
  }
}
