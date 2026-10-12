import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';

/** Same limits as the API (server/src/services/password.ts). */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;

/**
 * "New password" + "repeat it" fields. Emits the password once it's long enough and both match,
 * otherwise ''.
 */
@Component({
  selector: 'app-password-fields',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-form-field appearance="outline">
      <mat-label>{{ 'password.new' | transloco }}</mat-label>
      <input
        matInput
        [type]="show() ? 'text' : 'password'"
        name="newPassword"
        autocomplete="new-password"
        required
        [attr.minlength]="min"
        [attr.maxlength]="max"
        [ngModel]="password()"
        (ngModelChange)="password.set($event)"
        [ngModelOptions]="{ standalone: true }"
      />
      <button
        mat-icon-button
        matSuffix
        type="button"
        (click)="show.set(!show())"
        [attr.aria-label]="'password.show' | transloco"
        [attr.aria-pressed]="show()"
      >
        <mat-icon>{{ show() ? 'visibility_off' : 'visibility' }}</mat-icon>
      </button>
      <mat-hint [class.error-text]="tooShort()">{{
        'password.minLength' | transloco: { min }
      }}</mat-hint>
    </mat-form-field>
    <mat-form-field appearance="outline">
      <mat-label>{{ 'password.repeat' | transloco }}</mat-label>
      <input
        matInput
        [type]="show() ? 'text' : 'password'"
        name="repeatPassword"
        autocomplete="new-password"
        required
        [attr.maxlength]="max"
        [ngModel]="repeat()"
        (ngModelChange)="repeat.set($event)"
        [ngModelOptions]="{ standalone: true }"
      />
      @if (mismatch()) {
        <mat-hint class="error-text" role="alert">{{ 'password.mismatch' | transloco }}</mat-hint>
      }
    </mat-form-field>
  `,
  styles: `
    :host {
      display: grid;
      gap: 12px;
    }
  `,
})
export class PasswordFields {
  readonly valueChange = output<string>();
  protected readonly min = PASSWORD_MIN;
  protected readonly max = PASSWORD_MAX;
  protected readonly password = signal('');
  protected readonly repeat = signal('');
  protected readonly show = signal(false);

  protected readonly tooShort = computed(
    () => this.password().length > 0 && this.password().length < PASSWORD_MIN,
  );
  protected readonly mismatch = computed(
    () => this.repeat().length > 0 && this.repeat() !== this.password(),
  );
  private readonly valid = computed(
    () =>
      this.password().length >= PASSWORD_MIN &&
      this.password().length <= PASSWORD_MAX &&
      this.password() === this.repeat(),
  );

  constructor() {
    effect(() => this.valueChange.emit(this.valid() ? this.password() : ''));
  }

  /** Empties both fields (e.g. after the password was saved). */
  clear(): void {
    this.password.set('');
    this.repeat.set('');
  }
}
