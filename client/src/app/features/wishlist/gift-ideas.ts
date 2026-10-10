import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageService } from '../../core/i18n';
import { Budget, GroupTheme, Preferences } from '../../core/models';
import { MoneyPipe } from '../../shared/pipes';
import { GiftIdea, ideaLinks, suggestIdeas } from './gift-ideas.data';

/**
 * Budget- and theme-aware gift ideas with links to Slovenian shops: single gifts up to the
 * budget (+1 €) and combinations of cheaper gifts that add up to it.
 */
@Component({
  selector: 'app-gift-ideas',
  imports: [NgTemplateOutlet, TranslocoPipe, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="surface-card ideas" aria-labelledby="ideas-h">
      <h2 id="ideas-h">💡 {{ 'ideas.title' | transloco }}</h2>
      @if (prefs()?.dislikes) {
        <p class="avoid">🚫 {{ 'ideas.avoid' | transloco: { list: prefs()?.dislikes } }}</p>
      }

      @if (s().budgetApplied) {
        <h3>{{ 'ideas.singleTitle' | transloco: { budget: (budget() | money) } }}</h3>
      }
      <ul class="list">
        @for (idea of s().singles; track idea.id) {
          <li>
            <ng-container *ngTemplateOutlet="ideaRow; context: { $implicit: idea }" />
          </li>
        }
      </ul>

      @if (s().bundles.length) {
        <h3>{{ 'ideas.bundlesTitle' | transloco }}</h3>
        <p class="muted small">{{ 'ideas.bundlesHint' | transloco }}</p>
        @for (b of s().bundles; track $index) {
          <div class="bundle">
            <ul class="list">
              @for (idea of b.items; track idea.id) {
                <li>
                  <ng-container *ngTemplateOutlet="ideaRow; context: { $implicit: idea }" />
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

    <ng-template #ideaRow let-idea>
      <span class="emoji" aria-hidden="true">{{ idea.emoji }}</span>
      <span class="text">
        <span>{{ title(idea) }}</span>
        <span class="links">
          @for (link of links(idea); track link.url) {
            <a [href]="link.url" target="_blank" rel="noopener noreferrer nofollow"
              >{{ link.name }} ↗</a
            >
          }
        </span>
      </span>
      <span class="price muted">~{{ idea.price | money: 'EUR' }}</span>
    </ng-template>
  `,
  styles: `
    h2 {
      font: var(--mat-sys-title-medium);
      margin: 0 0 8px;
    }
    h3 {
      font: var(--mat-sys-title-small);
      margin: 14px 0 8px;
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
  protected readonly s = computed(() => suggestIdeas(this.theme().preset, this.budget()));

  protected title(idea: GiftIdea): string {
    return this.lang.current() === 'sl' ? idea.sl : idea.en;
  }

  protected links(idea: GiftIdea) {
    return ideaLinks(idea);
  }
}
