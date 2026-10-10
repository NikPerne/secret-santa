import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import { Exclusion, Member } from '../core/models';

/** "Don't pair these two" rules: pick two people, tap add. Rules are symmetric. */
@Component({
  selector: 'app-exclusions-editor',
  imports: [
    FormsModule,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (people().length < 2) {
      <p class="muted">{{ 'exclusions.needPeople' | transloco }}</p>
    } @else {
      <div class="picker">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'exclusions.personA' | transloco }}</mat-label>
          <mat-select [ngModel]="a()" (ngModelChange)="a.set($event)" name="a">
            @for (m of people(); track m.id) {
              <mat-option [value]="m.id" [disabled]="m.id === b()">{{ m.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-icon class="link-icon" aria-hidden="true">block</mat-icon>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'exclusions.personB' | transloco }}</mat-label>
          <mat-select [ngModel]="b()" (ngModelChange)="b.set($event)" name="b">
            @for (m of people(); track m.id) {
              <mat-option [value]="m.id" [disabled]="m.id === a()">{{ m.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>
      <button
        mat-stroked-button
        class="full-width"
        [disabled]="!canAdd() || disabled()"
        (click)="add()"
      >
        <mat-icon>add</mat-icon>{{ 'exclusions.add' | transloco }}
      </button>
    }

    @if (rules().length) {
      <mat-chip-set class="rules" [attr.aria-label]="'exclusions.listLabel' | transloco">
        @for (r of rules(); track r.key) {
          <mat-chip [removable]="!disabled()" (removed)="remove(r.key)">
            {{ r.label }}
            <button
              matChipRemove
              [attr.aria-label]="'exclusions.remove' | transloco: { pair: r.label }"
            >
              <mat-icon>cancel</mat-icon>
            </button>
          </mat-chip>
        }
      </mat-chip-set>
    } @else if (people().length >= 2) {
      <p class="muted">{{ 'exclusions.none' | transloco }}</p>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: 8px;
    }
    .picker {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: baseline;
      gap: 8px;
    }
    .link-icon {
      color: var(--mat-sys-error);
    }
    .rules {
      margin-top: 4px;
    }
    @media (max-width: 420px) {
      .picker {
        grid-template-columns: 1fr;
      }
      .link-icon {
        display: none;
      }
    }
  `,
})
export class ExclusionsEditor {
  readonly members = input.required<Member[]>();
  readonly exclusions = input.required<Exclusion[]>();
  readonly disabled = input(false);
  readonly exclusionsChange = output<Exclusion[]>();

  protected readonly a = signal<string | null>(null);
  protected readonly b = signal<string | null>(null);
  protected readonly people = computed(() => this.members().filter((m) => m.participates));

  private readonly names = computed(() => new Map(this.members().map((m) => [m.id, m.name])));
  private readonly keyOf = (x: string, y: string) => [x, y].sort().join(':');

  protected readonly rules = computed(() =>
    this.exclusions().map((e) => ({
      key: this.keyOf(e.a, e.b),
      label: `${this.names().get(e.a) ?? '?'} ↔ ${this.names().get(e.b) ?? '?'}`,
    })),
  );

  protected readonly canAdd = computed(() => {
    const a = this.a();
    const b = this.b();
    return !!a && !!b && a !== b && !this.rules().some((r) => r.key === this.keyOf(a, b));
  });

  protected add(): void {
    const a = this.a();
    const b = this.b();
    if (!a || !b || !this.canAdd()) return;
    this.exclusionsChange.emit([...this.exclusions(), { a, b }]);
    this.a.set(null);
    this.b.set(null);
  }

  protected remove(key: string): void {
    this.exclusionsChange.emit(this.exclusions().filter((e) => this.keyOf(e.a, e.b) !== key));
  }
}
