import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { WishlistService } from '../../core/api/wishlist.service';
import { ImageRef, WishlistItem, WishlistItemInput } from '../../core/models';
import { ImagePicker } from '../../shared/image-picker';

export interface ItemDialogData {
  groupId: string;
  item?: WishlistItem;
  currency: string;
  uploads: boolean;
}

const isHttpUrl = (v: string) => /^https?:\/\/\S+\.\S+/i.test(v.trim());

@Component({
  selector: 'app-item-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
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
            (paste)="onPaste()"
            (blur)="autoFill()"
          />
          @if (isHttpUrl(url())) {
            <button
              mat-icon-button
              matIconSuffix
              type="button"
              [disabled]="previewing()"
              (click)="fill(true)"
              [attr.aria-label]="'wishlist.fillFromLink' | transloco"
            >
              <mat-icon>auto_fix_high</mat-icon>
            </button>
          }
          <mat-hint>{{ 'wishlist.linkHint' | transloco }}</mat-hint>
        </mat-form-field>
        @if (previewing()) {
          <mat-progress-bar mode="indeterminate" />
          <p class="muted small" role="status">{{ 'wishlist.reading' | transloco }}</p>
        }
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
        <button mat-flat-button type="submit" [disabled]="f.invalid || uploading() || previewing()">
          {{ 'common.save' | transloco }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .small {
      font: var(--mat-sys-body-small);
      margin: 0;
    }
  `,
})
export class ItemDialog {
  protected readonly data = inject<ItemDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<ItemDialog, WishlistItemInput>>(MatDialogRef);
  private readonly wishlist = inject(WishlistService);
  protected readonly isHttpUrl = isHttpUrl;

  protected readonly title = signal(this.data.item?.title ?? '');
  protected readonly url = signal(this.data.item?.url ?? '');
  protected readonly price = signal<number | null>(this.data.item?.price ?? null);
  protected readonly notes = signal(this.data.item?.notes ?? '');
  protected readonly image = signal<ImageRef | null>(this.data.item?.image ?? null);
  protected readonly uploading = signal(false);
  protected readonly previewing = signal(false);
  private lastPreviewed = this.data.item?.url ?? '';

  /** Paste a link → fill the rest automatically (after the input has the pasted value). */
  protected onPaste(): void {
    setTimeout(() => this.autoFill());
  }

  /** Fills only empty fields, once per link. */
  protected autoFill(): void {
    if (this.title().trim() && this.image()) return;
    void this.fill(false);
  }

  protected async fill(force: boolean): Promise<void> {
    const url = this.url().trim();
    if (!isHttpUrl(url) || this.previewing() || (!force && url === this.lastPreviewed)) return;
    this.lastPreviewed = url;
    this.previewing.set(true);
    try {
      const p = await this.wishlist.linkPreview(this.data.groupId, url);
      if (p.title && (force || !this.title().trim())) this.title.set(p.title);
      if (p.image && (force || !this.image())) this.image.set(p.image);
      if (p.price !== null && (!p.currency || p.currency === this.data.currency)) {
        if (force || this.price() === null) this.price.set(p.price);
      }
    } catch {
      /* The page couldn't be read: the user just fills in the fields themselves. */
    } finally {
      this.previewing.set(false);
    }
  }

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
