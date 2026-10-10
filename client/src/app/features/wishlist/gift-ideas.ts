import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageService } from '../../core/i18n';
import { Budget, GroupTheme, Preferences } from '../../core/models';
import { MoneyPipe } from '../../shared/pipes';
import { IdeaWithReason, ideaLinks, suggestIdeas } from './gift-ideas.data';

/**
 * Gift ideas for one person: the group theme decides what's allowed, the giftee's likes and
 * wishlist bring matching ideas to the top, their "please no" list removes ideas, and the budget
 * caps prices (single gifts up to budget + 1 €, or a combination of cheaper gifts).
 */
@Component({
  selector: 'app-gift-ideas',
  imports: [NgTemplateOutlet, TranslocoPipe, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="surface-card ideas" aria-labelledby="ideas-h">
      <h2 id="ideas-h">💡 {{ 'ideas.titleFor' | transloco: { name: name() } }}</h2>
      @if (s().personalized) {
        <p class="note">💚 {{ 'ideas.personalized' | transloco: { name: name() } }}</p>
      } @else {
        <p class="note muted">{{ 'ideas.notPersonal' | transloco: { name: name() } }}</p>
      }
      @if (s().avoided.length) {
        <p class="avoid">🚫 {{ 'ideas.avoided' | transloco: { list: s().avoided.join(', ') } }}</p>
      }

      @if (s().budgetApplied) {
        <h3>{{ 'ideas.singleTitle' | transloco: { budget: (budget() | money) } }}</h3>
      }
      <ul class="list">
        @for (item of s().singles; track item.idea.id) {
          <li>
            <ng-container *ngTemplateOutlet="ideaRow; context: { $implicit: item }" />
          </li>
        }
      </ul>

      @if (s().bundles.length) {
        <h3>{{ 'ideas.bundlesTitle' | transloco }}</h3>
        <p class="muted small">{{ 'ideas.bundlesHint' | transloco }}</p>
        @for (b of s().bundles; track $index) {
          <div class="bundle">
            <ul class="list">
              @for (item of b.items; track item.idea.id) {
                <li>
                  <ng-container *ngTemplateOutlet="ideaRow; context: { $implicit: item }" />
                </li>
              }
            </ul>
            <p class="total">{{ 'ideas.together' | transloco }} ~{{ b.total | money: 'EUR' }}</p>
          </div>
        }
      }

      <p class="muted small">
        {{ (s().budgetApplied ? 'ideas.hint' : 'ideas.hintNoBudget') | transloco }}
      </p>
    </section>

    <ng-template #ideaRow let-item>
      <span class="emoji" aria-hidden="true">{{ item.idea.emoji }}</span>
      <span class="text">
        <span>{{ title(item) }}</span>
        @if (item.because.length) {
          <span class="because">💚 {{ item.because.join(', ') }}</span>
        }
        <span class="links">
          @for (link of links(item); track link.url) {
            <a [href]="link.url" target="_blank" rel="noopener noreferrer nofollow"
              >{{ link.name }} ↗</a
            >
          }
        </span>
      </span>
      <span class="price muted">~{{ item.idea.price | money: 'EUR' }}</span>
    </ng-template>
  `,
  styles: `
    h2 {
      font: var(--mat-sys-title-medium);
      margin: 0 0 4px;
    }
    h3 {
      font: var(--mat-sys-title-small);
      margin: 14px 0 8px;
    }
    .note {
      margin: 0 0 6px;
      font: var(--mat-sys-body-medium);
    }
    .list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: 10px;
    }
    li {
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }
    .emoji {
      font-size: 22px;
      line-height: 1.2;
    }
    .text {
      flex: 1;
      display: grid;
      gap: 2px;
    }
    .because {
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-tertiary);
    }
    .links {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 12px;
      font: var(--mat-sys-label-medium);
    }
    .links a {
      text-decoration: none;
      padding: 4px 0;
    }
    .links a:hover,
    .links a:focus-visible {
      text-decoration: underline;
    }
    .price {
      font: var(--mat-sys-label-large);
      white-space: nowrap;
    }
    .bundle {
      border: 1px dashed var(--mat-sys-outline-variant);
      border-radius: 14px;
      padding: 10px 12px;
      margin-bottom: 10px;
    }
    .total {
      margin: 8px 0 0;
      text-align: right;
      font: var(--mat-sys-label-large);
      color: var(--mat-sys-primary);
    }
    .avoid {
      color: var(--mat-sys-error);
      margin: 0 0 6px;
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
  /** The giftee: their name, preferences and wishlist item titles. */
  readonly name = input('');
  readonly prefs = input<Preferences | null>(null);
  readonly wishes = input<string[]>([]);
  protected readonly lang = inject(LanguageService);
  protected readonly s = computed(() =>
    suggestIdeas(this.theme().preset, this.budget(), {
      likes: this.prefs()?.likes,
      dislikes: this.prefs()?.dislikes,
      wishes: this.wishes(),
    }),
  );

  protected title(item: IdeaWithReason): string {
    return this.lang.current() === 'sl' ? item.idea.sl : item.idea.en;
  }

  protected links(item: IdeaWithReason) {
    return ideaLinks(item.idea);
  }
}
