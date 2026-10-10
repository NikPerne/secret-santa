import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * Festive loading animation: a gift box hopping with twinkling sparkles (inline SVG + CSS, so it's
 * tiny, sharp at any size and follows the theme). With "reduce motion" turned on it gently pulses
 * instead of bouncing, so there's always visible activity.
 */
@Component({
  selector: 'app-loader',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Announce only when standing alone; inside the wake overlay the card is the status region.
    '[attr.role]': "block() ? 'status' : null",
    '[style.--size.px]': 'size()',
    '[class.block]': 'block()',
  },
  template: `
    <svg class="gift" viewBox="0 0 64 64" aria-hidden="true">
      <g class="sparkles">
        <path class="s1" d="M8 14l1.5 3.5L13 19l-3.5 1.5L8 24l-1.5-3.5L3 19l3.5-1.5z" />
        <path class="s2" d="M56 8l1.2 2.8L60 12l-2.8 1.2L56 16l-1.2-2.8L52 12l2.8-1.2z" />
        <path class="s3" d="M54 30l1 2.3 2.3 1-2.3 1L54 36.6l-1-2.3-2.3-1 2.3-1z" />
      </g>
      <g class="box">
        <g class="lid">
          <path
            class="bow"
            d="M32 16c-3-7-12-9-12-3 0 4 6 5 12 3zm0 0c3-7 12-9 12-3 0 4-6 5-12 3z"
          />
          <rect x="12" y="16" width="40" height="10" rx="2.5" class="lid-fill" />
          <rect x="29" y="16" width="6" height="10" class="ribbon" />
        </g>
        <rect x="15" y="26" width="34" height="26" rx="2.5" class="box-fill" />
        <rect x="29" y="26" width="6" height="26" class="ribbon" />
      </g>
      <ellipse class="shadow" cx="32" cy="59" rx="14" ry="2.5" />
    </svg>
    @if (label()) {
      <span class="label">{{ label() | transloco }}</span>
    } @else {
      <span class="visually-hidden">{{ 'common.loading' | transloco }}</span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    :host(.block) {
      display: flex;
      margin: 48px auto;
    }
    .gift {
      width: var(--size);
      height: var(--size);
      overflow: visible;
    }
    .box-fill {
      fill: #c62828;
    }
    .lid-fill {
      fill: #b71c1c;
    }
    .ribbon,
    .bow {
      fill: #ffc107;
    }
    .sparkles path {
      fill: #ffd54f;
    }
    .shadow {
      fill: currentColor;
      opacity: 0.15;
    }
    .label {
      font: var(--mat-sys-body-medium);
      color: var(--mat-sys-on-surface-variant);
    }

    /* ---- Full motion: hop, squash, lid pops, sparkles twinkle ---- */
    .box {
      transform-origin: 32px 52px;
      animation: ss-hop 1.1s cubic-bezier(0.3, 0, 0.3, 1) infinite;
    }
    .lid {
      transform-origin: 32px 26px;
      animation: ss-lid 1.1s ease-in-out infinite;
    }
    .shadow {
      transform-origin: 32px 59px;
      animation: ss-shadow 1.1s cubic-bezier(0.3, 0, 0.3, 1) infinite;
    }
    .sparkles path {
      transform-box: fill-box;
      transform-origin: center;
      animation: ss-twinkle 1.1s ease-in-out infinite;
    }
    .s2 {
      animation-delay: 0.35s !important;
    }
    .s3 {
      animation-delay: 0.7s !important;
    }

    @keyframes ss-hop {
      0%,
      100% {
        transform: translateY(0) scale(1.06, 0.94);
      }
      15% {
        transform: translateY(0) scale(1, 1);
      }
      50% {
        transform: translateY(-12px) scale(0.97, 1.03);
      }
      85% {
        transform: translateY(0) scale(1, 1);
      }
    }
    @keyframes ss-lid {
      0%,
      30%,
      70%,
      100% {
        transform: translateY(0) rotate(0);
      }
      50% {
        transform: translateY(-4px) rotate(-6deg);
      }
    }
    @keyframes ss-shadow {
      0%,
      100% {
        transform: scaleX(1);
        opacity: 0.18;
      }
      50% {
        transform: scaleX(0.6);
        opacity: 0.08;
      }
    }
    @keyframes ss-twinkle {
      0%,
      100% {
        transform: scale(0.4);
        opacity: 0.2;
      }
      50% {
        transform: scale(1.1);
        opacity: 1;
      }
    }

    /*
     * Reduce motion: no bouncing, just a slow, gentle pulse. These rules out-rank the global
     * reduced-motion reset (which would otherwise freeze the loader into a static image).
     */
    @media (prefers-reduced-motion: reduce) {
      .box,
      .lid,
      .shadow {
        animation: none !important;
      }
      .gift {
        animation: ss-pulse 1.6s ease-in-out infinite !important;
      }
      .sparkles path {
        animation: ss-pulse 1.6s ease-in-out infinite !important;
      }
      @keyframes ss-pulse {
        0%,
        100% {
          opacity: 0.45;
        }
        50% {
          opacity: 1;
        }
      }
    }
  `,
})
export class Loader {
  /** Display size of the gift in px. */
  readonly size = input(64);
  /** Optional translation key shown under the gift. */
  readonly label = input<string | null>(null);
  /** Centred block with margin (for whole-page loading states). */
  readonly block = input(false, { transform: booleanAttribute });
}
