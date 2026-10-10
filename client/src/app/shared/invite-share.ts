import { Clipboard } from '@angular/cdk/clipboard';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { toDataURL } from 'qrcode';
import { NotifyService } from '../core/notify.service';

/** Invite link with copy, native share sheet and QR code. */
@Component({
  selector: 'app-invite-share',
  imports: [MatButtonModule, MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="invite stack">
      <label class="link-label" for="invite-link">{{ 'invite.linkLabel' | transloco }}</label>
      <input id="invite-link" class="link" readonly [value]="link()" (focus)="select($event)" />
      <div class="row">
        <button mat-flat-button class="grow" (click)="copy()">
          <mat-icon>content_copy</mat-icon>{{ 'invite.copy' | transloco }}
        </button>
        @if (canShare) {
          <button mat-stroked-button class="grow" (click)="share()">
            <mat-icon>share</mat-icon>{{ 'invite.share' | transloco }}
          </button>
        }
      </div>
      <p class="muted code">
        {{ 'invite.code' | transloco }}: <strong>{{ code() }}</strong>
      </p>
      @if (qr()) {
        <img class="qr" [src]="qr()" [alt]="'invite.qrAlt' | transloco" width="220" height="220" />
      }
    </div>
  `,
  styles: `
    .invite {
      align-items: stretch;
    }
    .link-label {
      font: var(--mat-sys-label-large);
    }
    .link {
      font: var(--mat-sys-body-large);
      padding: 12px;
      border-radius: 12px;
      border: 1px solid var(--mat-sys-outline);
      background: var(--mat-sys-surface);
      color: var(--mat-sys-on-surface);
      width: 100%;
      box-sizing: border-box;
    }
    .grow {
      flex: 1 1 140px;
    }
    .code {
      margin: 0;
      text-align: center;
    }
    .qr {
      align-self: center;
      background: #fff;
      padding: 8px;
      border-radius: 12px;
    }
  `,
})
export class InviteShare {
  readonly code = input.required<string>();
  readonly groupName = input('');
  private readonly clipboard = inject(Clipboard);
  private readonly notify = inject(NotifyService);
  private readonly t = inject(TranslocoService);

  protected readonly canShare = typeof navigator !== 'undefined' && 'share' in navigator;
  protected readonly link = computed(() => `${location.origin}/join/${this.code()}`);
  protected readonly qr = signal<string | null>(null);

  constructor() {
    effect(() => {
      const link = this.link();
      toDataURL(link, { width: 440, margin: 1, errorCorrectionLevel: 'M' })
        .then((url) => this.qr.set(url))
        .catch(() => this.qr.set(null));
    });
  }

  protected select(event: FocusEvent): void {
    (event.target as HTMLInputElement).select();
  }

  protected copy(): void {
    if (this.clipboard.copy(this.link())) this.notify.success('invite.copied');
  }

  protected async share(): Promise<void> {
    try {
      await navigator.share({
        title: this.groupName(),
        text: this.t.translate('invite.shareText', { name: this.groupName() }),
        url: this.link(),
      });
    } catch {
      /* user cancelled */
    }
  }
}
