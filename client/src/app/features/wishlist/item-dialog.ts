import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { ImageRef, WishlistItem, WishlistItemInput } from '../../core/models';
import { ImagePicker } from '../../shared/image-picker';

export interface ItemDialogData {
  groupId: string;
  item?: WishlistItem;
  currency: string;
  uploads: boolean;
}

@Component({
  selector: 'app-item-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    TranslocoPipe,
    ImagePicker,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>
      {{ (data.item ? 'wishlist.editItem' : 'wishlist.addItem') | transloco }}
    </h2>
    <form (ngSubmit)="save()" #f="ngForm">
      <mat-dialog-content class="stack">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'wishlist.itemTitle' | transloco }}</mat-label>
          <input
            matInput
            name="title"
            required
            maxlength="120"
            [placeholder]="'wishlist.titlePlaceholder' | transloco"
            [ngModel]="title()"
            (ngModelChange)="title.set($event)"
          />
        </mat-form-field>
        @if (data.uploads) {
          <app-image-picker
            [groupId]="data.groupId"
            [(image)]="image"
            (uploadingChange)="uploading.set($event)"
          />
        }
        <mat-form-field appearance="outline">
          <mat-label>{{ 'wishlist.link' | transloco }}</mat-label>
          <input
            matInput
            name="url"
            type="url"
            inputmode="url"
            maxlength="1000"
            pattern="https?://.+"
            placeholder="https://"
            [ngModel]="url()"
            (ngModelChange)="url.set($event)"
          />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'wishlist.price' | transloco }} ({{ data.currency }})</mat-label>
          <input
            matInput
            name="price"
            type="number"
            inputmode="decimal"
            min="0"
            [ngModel]="price()"
            (ngModelChange)="price.set($event === '' ? null : $event)"
          />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'wishlist.notes' | transloco }}</mat-label>
          <textarea
            matInput
            name="notes"
            rows="3"
            maxlength="1000"
            [placeholder]="'wishlist.notesPlaceholder' | transloco"
            [ngModel]="notes()"
            (ngModelChange)="notes.set($event)"
          ></textarea>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
        <button mat-flat-button type="submit" [disabled]="f.invalid || uploading()">
          {{ 'common.save' | transloco }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class ItemDialog {
  protected readonly data = inject<ItemDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<ItemDialog, WishlistItemInput>>(MatDialogRef);

  protected readonly title = signal(this.data.item?.title ?? '');
  protected readonly url = signal(this.data.item?.url ?? '');
  protected readonly price = signal<number | null>(this.data.item?.price ?? null);
  protected readonly notes = signal(this.data.item?.notes ?? '');
  protected readonly image = signal<ImageRef | null>(this.data.item?.image ?? null);
  protected readonly uploading = signal(false);

  protected save(): void {
    this.ref.close({
      title: this.title().trim(),
      url: this.url().trim(),
      price: this.price() === null ? null : Number(this.price()),
      notes: this.notes().trim(),
      image: this.image(),
    });
  }
}
