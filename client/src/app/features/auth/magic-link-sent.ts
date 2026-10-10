import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-magic-link-sent',
  imports: [MatButtonModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sent center stack" role="status">
      <div class="emoji" aria-hidden="true">📬</div>
      <h1 class="page-title">{{ 'signin.checkInbox' | transloco }}</h1>
      <p>{{ 'signin.sentTo' | transloco: { email: email() } }}</p>
      <p class="muted">{{ 'signin.expires' | transloco }}</p>
      @if (devLink(); as link) {
        <div class="surface-card">
          <p class="muted">{{ 'signin.devLink' | transloco }}</p>
          <a mat-flat-button [href]="link">{{ 'signin.openLink' | transloco }}</a>
        </div>
      }
      <button mat-button (click)="retry.emit()">{{ 'signin.differentEmail' | transloco }}</button>
    </div>
  `,
  styles: `
    .emoji {
      font-size: 64px;
    }
    .sent {
      align-items: center;
    }
  `,
})
export class MagicLinkSent {
  readonly email = input.required<string>();
  readonly devLink = input<string>();
  readonly retry = output<void>();
}
