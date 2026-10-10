import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { WakeUpService } from '../core/wake-up.service';

@Component({
  selector: 'app-wake-overlay',
  imports: [MatProgressSpinnerModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (wake.waking()) {
      <div class="overlay" role="status" aria-live="polite">
        <div class="card">
          <div class="tree" aria-hidden="true">🎄</div>
          <p class="title">{{ 'wake.title' | transloco }}</p>
          <p class="hint">{{ 'wake.hint' | transloco }}</p>
          <mat-spinner diameter="36" />
        </div>
      </div>
    }
  `,
  styles: `
    .overlay {
      position: fixed;
      inset: 0;
      z-index: 2000;
      display: grid;
      place-items: center;
      background: color-mix(in srgb, var(--mat-sys-scrim) 45%, transparent);
      padding: 16px;
    }
    .card {
      background: var(--mat-sys-surface-container-high);
      color: var(--mat-sys-on-surface);
      border-radius: 24px;
      padding: 28px 24px;
      max-width: 340px;
      text-align: center;
      display: grid;
      justify-items: center;
      gap: 8px;
      box-shadow: var(--mat-sys-level3);
    }
    .tree {
      font-size: 56px;
      animation: bounce 1.2s ease-in-out infinite;
    }
    .title {
      font: var(--mat-sys-title-large);
      margin: 0;
    }
    .hint {
      margin: 0 0 8px;
      color: var(--mat-sys-on-surface-variant);
    }
    @keyframes bounce {
      50% {
        transform: translateY(-8px) rotate(-4deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .tree {
        animation: none;
      }
    }
  `,
})
export class WakeOverlay {
  protected readonly wake = inject(WakeUpService);
}
