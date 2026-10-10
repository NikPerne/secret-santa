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
import { MagicLinkSent } from './magic-link-sent';

@Component({
  selector: 'app-signin',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslocoPipe,
    MagicLinkSent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page stack narrow">
      @if (sentTo(); as email) {
        <app-magic-link-sent [email]="email" [devLink]="devLink()" (retry)="sentTo.set(null)" />
      } @else {
        <h1 class="page-title">{{ 'signin.title' | transloco }}</h1>
        <p class="muted">{{ 'signin.subtitle' | transloco }}</p>
        <form class="stack" (ngSubmit)="submit()" #f="ngForm">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'fields.email' | transloco }}</mat-label>
            <input
              matInput
              type="email"
              name="email"
              autocomplete="email"
              inputmode="email"
              required
              email
              [ngModel]="email()"
              (ngModelChange)="email.set($event)"
            />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'fields.nameOptional' | transloco }}</mat-label>
            <input
              matInput
              name="name"
              autocomplete="given-name"
              maxlength="60"
              [ngModel]="name()"
              (ngModelChange)="name.set($event)"
            />
            <mat-hint>{{ 'signin.nameHint' | transloco }}</mat-hint>
          </mat-form-field>
          <button mat-flat-button class="big-button" type="submit" [disabled]="f.invalid || busy()">
            <mat-icon>mail</mat-icon>{{ 'signin.send' | transloco }}
          </button>
          @if (instantJoin()) {
            <button
              mat-stroked-button
              type="button"
              class="big-button"
              [disabled]="f.invalid || busy()"
              (click)="instant()"
            >
              <mat-icon>bolt</mat-icon>{{ 'signin.instant' | transloco }}
            </button>
          }
        </form>
      }
    </section>
  `,
  styles: `
    .narrow {
      max-width: 460px;
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
  protected readonly name = signal('');
  protected readonly busy = signal(false);
  protected readonly sentTo = signal<string | null>(null);
  protected readonly devLink = signal<string | undefined>(undefined);
  protected readonly instantJoin = signal(false);

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
    this.busy.set(true);
    try {
      const res = await this.auth.requestLink({
        email: this.email().trim(),
        name: this.name().trim() || undefined,
        redirect: this.redirect() ? this.safeRedirect() : undefined,
      });
      this.devLink.set(res.devLink);
      this.sentTo.set(this.email().trim());
    } catch (err) {
      this.notify.error(err);
    } finally {
      this.busy.set(false);
    }
  }

  protected async instant(): Promise<void> {
    this.busy.set(true);
    try {
      await this.auth.devLogin({
        email: this.email().trim(),
        name: this.name().trim() || undefined,
      });
      await this.router.navigateByUrl(this.safeRedirect());
    } catch (err) {
      this.notify.error(err);
    } finally {
      this.busy.set(false);
    }
  }
}
