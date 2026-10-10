import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Loader } from '../../shared/loader';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/api/auth.service';
import { NotifyService } from '../../core/notify.service';

/** Landing page for magic links: exchanges the token for a session cookie. */
@Component({
  selector: 'app-verify',
  imports: [MatButtonModule, Loader, RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page center stack" style="align-items: center">
      @if (error(); as message) {
        <div style="font-size: 64px" aria-hidden="true">🥶</div>
        <h1 class="page-title">{{ 'verify.failed' | transloco }}</h1>
        <p role="alert">{{ message }}</p>
        <a mat-flat-button routerLink="/signin">{{ 'verify.newLink' | transloco }}</a>
      } @else {
        <app-loader [size]="80" />
        <p role="status">{{ 'verify.signingIn' | transloco }}</p>
      }
    </section>
  `,
})
export class Verify implements OnInit {
  readonly token = input<string>();
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotifyService);
  protected readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const token = this.token();
    if (!token) {
      this.error.set(this.notify.messageFor(null));
      return;
    }
    try {
      const res = await this.auth.verify(token);
      const target = res.redirect ?? (res.groupId ? `/g/${res.groupId}` : '/');
      await this.router.navigateByUrl(target, { replaceUrl: true });
    } catch (err) {
      this.error.set(this.notify.messageFor(err));
    }
  }
}
