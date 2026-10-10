import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

export interface ConfirmData {
  /** Translation keys */
  title: string;
  message: string;
  confirm: string;
  params?: Record<string, unknown>;
  danger?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title | transloco: data.params }}</h2>
    <mat-dialog-content>
      <p>{{ data.message | transloco: data.params }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false">{{ 'common.cancel' | transloco }}</button>
      <button
        mat-flat-button
        [class.danger]="data.danger"
        [mat-dialog-close]="true"
        cdkFocusInitial
      >
        {{ data.confirm | transloco: data.params }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .danger {
      background: var(--mat-sys-error);
      color: var(--mat-sys-on-error);
    }
  `,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmData>(MAT_DIALOG_DATA);
}

/** Opens a confirmation dialog and resolves to true when confirmed. */
export async function confirmAction(dialog: MatDialog, data: ConfirmData): Promise<boolean> {
  const ref = dialog.open(ConfirmDialog, { data, maxWidth: '420px', autoFocus: 'dialog' });
  return (await firstValueFrom(ref.afterClosed())) === true;
}
