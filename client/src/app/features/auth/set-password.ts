import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService, PasswordTokenInfo } from '../../core/api/auth.service';
import { NotifyService } from '../../core/notify.service';
import { Loader } from '../../shared/loader';
import { PasswordFields } from './password-fields';

/** Landing page for the emailed setup / reset links: choose a password, then you're signed in. */
@Component({
  selector: 'app-set-password',
  imports: [
    FormsModule,
    MatButtonModule,
    MatIconModule,
    RouterLink,
    TranslocoPipe,
    Loader,
    PasswordFields,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page stack narrow">
      @if (error(); as message) {
        <div class="center stack" style="align-items: center">
          <div style="font-size: 64px" aria-hidden="true">🥶</div>
          <h1 class="page-title">{{ 'setPassword.failed' | transloco }}</h1>
          <p role="alert">{{ message }}</p>
          <p class="muted">{{ 'setPassword.askAdmin' | transloco }}</p>
          <a mat-flat-button routerLink="/signin">{{ 'signin.title' | transloco }}</a>
        </div>
      } @else if (info(); as i) {
        <h1 class="page-title">
          {{
            (i.purpose === 'setup' ? 'setPassword.titleSetup' : 'setPassword.titleReset')
              | transloco
          }}
        </h1>
        <p>{{ 'setPassword.hello' | transloco: { name: i.name, email: i.email } }}</p>
        <form class="stack" (ngSubmit)="submit()">
          <!-- Lets password managers save the login under the right email. -->
          <input type="email" name="username" autocomplete="username" [value]="i.email" hidden />
          <app-password-fields (valueChange)="password.set($event)" />
          <button
            mat-flat-button
            class="big-button"
            type="submit"
            [disabled]="!password() || busy()"
          >
            <mat-icon>key</mat-icon>{{ 'setPassword.submit' | transloco }}
          </button>
        </form>
      } @else {
        <app-loader block />
      }
    </section>
  `,
  styles: `
    .narrow {
      max-width: 460px;
    }
  `,
})
export class SetPassword implements OnInit {
  readonly token = input<string>();
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotifyService);
  private readonly t = inject(TranslocoService);

  protected readonly info = signal<PasswordTokenInfo | null>(null);
  protected readonly error = signal<string | null>(null);
  /** A valid, confirmed password, or '' while the fields aren't valid yet. */
  protected readonly password = signal('');
  protected readonly busy = signal(false);

  async ngOnInit(): Promise<void> {
    const token = this.token();
    if (!token) {
      this.error.set(this.t.translate('errors.invalid_token'));
      return;
    }
    try {
      this.info.set(await this.auth.checkPasswordToken(token));
    } catch (err) {
      this.error.set(this.notify.messageFor(err));
    }
  }

  protected async submit(): Promise<void> {
    const token = this.token();
    if (!token || !this.password()) return;
    this.busy.set(true);
    try {
      await this.auth.setPassword(token, this.password());
      this.notify.success('setPassword.done');
      await this.router.navigateByUrl('/', { replaceUrl: true });
    } catch (err) {
      this.notify.error(err);
    } finally {
      this.busy.set(false);
    }
  }
}
