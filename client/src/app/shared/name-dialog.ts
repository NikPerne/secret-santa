import { ChangeDetectionStrategy, Component, Injector, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../core/api/auth.service';
import { NotifyService } from '../core/notify.service';

/** Asked once after signing in with only an email: "What's your name?" */
@Component({
  selector: 'app-name-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>👋 {{ 'profile.nameTitle' | transloco }}</h2>
    <form (ngSubmit)="save()" #f="ngForm">
      <mat-dialog-content>
        <p class="muted">{{ 'profile.nameText' | transloco }}</p>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ 'fields.name' | transloco }}</mat-label>
          <input
            matInput
            name="name"
            autocomplete="given-name"
            required
            maxlength="60"
            cdkFocusInitial
            [ngModel]="name()"
            (ngModelChange)="name.set($event)"
          />
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-flat-button type="submit" [disabled]="f.invalid || !name().trim() || busy()">
          {{ 'common.save' | transloco }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class NameDialog {
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotifyService);
  private readonly ref = inject(MatDialogRef<NameDialog>);
  protected readonly name = signal(inject<{ suggestion: string }>(MAT_DIALOG_DATA).suggestion);
  protected readonly busy = signal(false);

  protected async save(): Promise<void> {
    this.busy.set(true);
    try {
      await this.auth.updateMe({ name: this.name().trim() });
      this.ref.close(true);
    } catch (err) {
      this.notify.error(err);
    } finally {
      this.busy.set(false);
    }
  }
}

/** Opens the dialog; loaded lazily so the dialog code isn't in the initial bundle. */
export async function openNameDialog(injector: Injector): Promise<void> {
  const ref = injector.get(MatDialog).open(NameDialog, {
    data: { suggestion: '' },
    disableClose: true,
    maxWidth: '420px',
    injector,
  });
  await firstValueFrom(ref.afterClosed());
}
