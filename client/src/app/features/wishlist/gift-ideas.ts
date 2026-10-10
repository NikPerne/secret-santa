import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageService } from '../../core/i18n';
import { Budget, GroupTheme, Preferences } from '../../core/models';
import { MoneyPipe } from '../../shared/pipes';
import { suggestIdeas } from './gift-ideas.data';

/** Budget- and theme-aware gift ideas for a Santa whose giftee hasn't written much. */
@Component({
  selector: 'app-gift-ideas',
  imports: [TranslocoPipe, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="surface-card ideas" aria-labelledby="ideas-h">
      <h2 id="ideas-h">💡 {{ 'ideas.title' | transloco }}</h2>
      @if (prefs()?.dislikes) {
        <p class="avoid">🚫 {{ 'ideas.avoid' | transloco: { list: prefs()?.dislikes } }}</p>
      }
      <ul>
        @for (idea of ideas(); track idea.en) {
          <li>
            <span class="emoji" aria-hidden="true">{{ idea.emoji }}</span>
            <span class="text">{{ lang.current() === 'sl' ? idea.sl : idea.en }}</span>
            <span class="price muted">~{{ idea.price | money: 'EUR' }}</span>
          </li>
        }
      </ul>
      <p class="muted small">{{ 'ideas.hint' | transloco }}</p>
    </section>
  `,
  styles: `
    h2 {
      font: var(--mat-sys-title-medium);
      margin: 0 0 8px;
    }
    ul {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: 8px;
    }
    li {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .emoji {
      font-size: 22px;
    }
    .text {
      flex: 1;
    }
    .price {
      font: var(--mat-sys-label-medium);
      white-space: nowrap;
    }
    .avoid {
      color: var(--mat-sys-error);
      margin: 0 0 8px;
    }
    .small {
      font: var(--mat-sys-body-small);
      margin: 10px 0 0;
    }
  `,
})
export class GiftIdeas {
  readonly theme = input.required<GroupTheme>();
  readonly budget = input.required<Budget>();
  readonly prefs = input<Preferences | null>(null);
  protected readonly lang = inject(LanguageService);
  protected readonly ideas = computed(() => suggestIdeas(this.theme().preset, this.budget()));
}
