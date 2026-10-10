import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { GroupTheme } from '../core/models';
import { THEME_EMOJI } from '../features/wishlist/gift-ideas.data';

/** Shows the group's gift theme, e.g. "🇸🇮 Made in Slovenia", plus any extra rule text. */
@Component({
  selector: 'app-theme-badge',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (theme(); as t) {
      @if (t.preset !== 'none' || t.text) {
        <div class="theme" role="note">
          <span class="emoji" aria-hidden="true">{{ emoji[t.preset] }}</span>
          <div>
            <strong>{{ 'theme.label' | transloco }}: </strong>
            @if (t.preset !== 'none' && t.preset !== 'custom') {
              <span>{{ 'theme.presets.' + t.preset + '.label' | transloco }}</span>
            }
            @if (t.text) {
              <span class="text">{{ t.text }}</span>
            } @else if (t.preset !== 'none' && t.preset !== 'custom') {
              <span class="muted text">{{
                'theme.presets.' + t.preset + '.hint' | transloco
              }}</span>
            }
          </div>
        </div>
      }
    }
  `,
  styles: `
    .theme {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 10px 14px;
      border-radius: 16px;
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
    }
    .emoji {
      font-size: 28px;
    }
    .text {
      display: block;
    }
  `,
})
export class ThemeBadge {
  readonly theme = input<GroupTheme | null | undefined>(null);
  protected readonly emoji = THEME_EMOJI;
}
