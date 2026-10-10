import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/** Days / hours / minutes until a date. Updates every 30s. */
@Component({
  selector: 'app-countdown',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (parts(); as p) {
      <div class="countdown" role="timer" [attr.aria-label]="'countdown.aria' | transloco: p">
        <div class="cell">
          <span class="num">{{ p.days }}</span
          ><span class="lbl">{{ 'countdown.days' | transloco }}</span>
        </div>
        <div class="cell">
          <span class="num">{{ p.hours }}</span
          ><span class="lbl">{{ 'countdown.hours' | transloco }}</span>
        </div>
        <div class="cell">
          <span class="num">{{ p.minutes }}</span
          ><span class="lbl">{{ 'countdown.minutes' | transloco }}</span>
        </div>
      </div>
    } @else {
      <p class="done">{{ 'countdown.done' | transloco }}</p>
    }
  `,
  styles: `
    .countdown {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .cell {
      display: grid;
      justify-items: center;
      padding: 10px 4px;
      border-radius: 16px;
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }
    .num {
      font: var(--mat-sys-headline-medium);
      font-variant-numeric: tabular-nums;
    }
    .lbl {
      font: var(--mat-sys-label-medium);
    }
    .done {
      font: var(--mat-sys-title-medium);
      margin: 0;
    }
  `,
})
export class Countdown {
  readonly to = input.required<string>();
  private readonly now = signal(Date.now());

  protected readonly parts = computed(() => {
    const ms = new Date(this.to()).getTime() - this.now();
    if (ms <= 0) return null;
    const minutes = Math.floor(ms / 60000);
    return {
      days: Math.floor(minutes / 1440),
      hours: Math.floor((minutes % 1440) / 60),
      minutes: minutes % 60,
    };
  });

  constructor() {
    const id = setInterval(() => this.now.set(Date.now()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }
}
