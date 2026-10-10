import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { PushService } from '../../core/api/push.service';
import { InstallService } from '../../core/install.service';
import { GroupStatus } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { storage } from '../../core/storage';

const DISMISS_KEY = 'ss.engage.dismissed';

/**
 * Right after joining: offer push notifications ("tell me when names are drawn") and installing
 * the app. On iPhone, push only works from the home screen, so we show the install steps.
 */
@Component({
  selector: 'app-engage-card',
  imports: [MatButtonModule, MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <section class="engage surface-card" aria-labelledby="engage-h">
        @if (showIosSteps()) {
          <h2 id="engage-h">📲 {{ 'engage.iosTitle' | transloco }}</h2>
          <ol>
            <li>
              {{ 'engage.iosStep1' | transloco }} <mat-icon class="inline">ios_share</mat-icon>
            </li>
            <li>{{ 'engage.iosStep2' | transloco }}</li>
            <li>{{ 'engage.iosStep3' | transloco }}</li>
          </ol>
        } @else {
          <h2 id="engage-h">
            🔔 {{ (status() === 'open' ? 'engage.pushTitleOpen' : 'engage.pushTitle') | transloco }}
          </h2>
          <p class="muted">{{ 'engage.pushText' | transloco }}</p>
          <div class="row">
            @if (canPush()) {
              <button mat-flat-button [disabled]="busy()" (click)="enablePush()">
                <mat-icon>notifications_active</mat-icon>{{ 'engage.pushButton' | transloco }}
              </button>
            }
            @if (install.canPrompt()) {
              <button mat-stroked-button (click)="installApp()">
                <mat-icon>install_mobile</mat-icon>{{ 'engage.installButton' | transloco }}
              </button>
            }
          </div>
        }
        <button mat-button class="dismiss" (click)="dismiss()">
          {{ 'engage.notNow' | transloco }}
        </button>
      </section>
    }
  `,
  styles: `
    .engage {
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
      display: grid;
      gap: 8px;
    }
    h2 {
      font: var(--mat-sys-title-medium);
      margin: 0;
    }
    p,
    ol {
      margin: 0;
    }
    ol {
      padding-left: 20px;
      display: grid;
      gap: 4px;
    }
    .inline {
      vertical-align: middle;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
    .dismiss {
      justify-self: end;
    }
  `,
})
export class EngageCard implements OnInit {
  readonly status = input<GroupStatus>('open');
  protected readonly push = inject(PushService);
  protected readonly install = inject(InstallService);
  private readonly notify = inject(NotifyService);
  private readonly dismissed = signal(storage.get(DISMISS_KEY) === '1');
  protected readonly busy = signal(false);

  protected readonly canPush = computed(() => this.push.state() === 'off');
  /** iPhone/iPad in Safari: installing first is the only way to get notifications. */
  protected readonly showIosSteps = computed(() => this.install.isIos && !this.install.installed());
  protected readonly visible = computed(
    () => !this.dismissed() && (this.showIosSteps() || this.canPush() || this.install.canPrompt()),
  );

  ngOnInit(): void {
    void this.push.refresh();
  }

  protected async enablePush(): Promise<void> {
    this.busy.set(true);
    try {
      const state = await this.push.enable();
      if (state === 'on') this.notify.success('engage.pushOn');
      else if (state === 'denied') this.notify.success('settings.push.deniedHelp');
    } finally {
      this.busy.set(false);
    }
  }

  protected async installApp(): Promise<void> {
    await this.install.prompt();
  }

  protected dismiss(): void {
    storage.set(DISMISS_KEY, '1');
    this.dismissed.set(true);
  }
}
