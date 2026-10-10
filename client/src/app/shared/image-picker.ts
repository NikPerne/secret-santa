import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { Subscription } from 'rxjs';
import { ImageError, UploadService, cldUrl } from '../core/api/upload.service';
import { ImageRef, UploadPurpose } from '../core/models';
import { NotifyService } from '../core/notify.service';

/** Pick a photo → instant local preview → compressed signed upload with a progress bar. */
@Component({
  selector: 'app-image-picker',
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="picker">
      @if (preview() || image(); as _) {
        <div class="preview">
          <img [src]="preview() ?? thumb(image()!.url)" [alt]="'image.preview' | transloco" />
          @if (!uploading()) {
            <button
              mat-mini-fab
              type="button"
              class="remove"
              (click)="clear()"
              [attr.aria-label]="'image.remove' | transloco"
            >
              <mat-icon>close</mat-icon>
            </button>
          }
        </div>
      }
      @if (uploading()) {
        <mat-progress-bar mode="determinate" [value]="progress()" />
        <p class="muted small" role="status">
          {{ 'image.uploading' | transloco: { percent: progress() } }}
        </p>
      } @else {
        <label class="pick" mat-stroked-button>
          <input
            type="file"
            accept="image/*"
            class="visually-hidden"
            (change)="onFile($event)"
            [disabled]="disabled()"
          />
          <mat-icon>add_a_photo</mat-icon>
          <span>{{ (image() ? 'image.change' : 'image.add') | transloco }}</span>
        </label>
      }
    </div>
  `,
  styles: `
    .picker {
      display: grid;
      gap: 8px;
    }
    .preview {
      position: relative;
      justify-self: start;
    }
    .preview img {
      display: block;
      max-width: 100%;
      max-height: 220px;
      border-radius: 12px;
      object-fit: contain;
      background: var(--mat-sys-surface-container);
    }
    .remove {
      position: absolute;
      top: 6px;
      right: 6px;
    }
    .pick {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 48px;
      padding: 0 16px;
      border: 1px solid var(--mat-sys-outline);
      border-radius: 24px;
      cursor: pointer;
      color: var(--mat-sys-primary);
      font: var(--mat-sys-label-large);
    }
    .pick:focus-within {
      outline: 3px solid var(--mat-sys-tertiary);
      outline-offset: 2px;
    }
    .small {
      margin: 0;
      font: var(--mat-sys-body-small);
    }
  `,
})
export class ImagePicker {
  readonly groupId = input.required<string>();
  readonly purpose = input<UploadPurpose>('wishlist');
  readonly disabled = input(false);
  readonly image = model<ImageRef | null>(null);
  readonly uploadingChange = output<boolean>();

  private readonly uploads = inject(UploadService);
  private readonly notify = inject(NotifyService);
  protected readonly preview = signal<string | null>(null);
  protected readonly progress = signal(0);
  protected readonly uploading = signal(false);
  private sub?: Subscription;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.sub?.unsubscribe();
      this.revokePreview();
    });
  }

  protected thumb(url: string): string {
    return cldUrl(url, { w: 600, crop: 'limit' });
  }

  protected onFile(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file) return;

    this.revokePreview();
    this.preview.set(URL.createObjectURL(file));
    this.setUploading(true);
    this.progress.set(0);
    this.sub = this.uploads.upload(file, this.groupId(), this.purpose()).subscribe({
      next: (e) => {
        if (e.type === 'progress') this.progress.set(e.percent);
        else this.image.set(e.image);
      },
      error: (err: unknown) => {
        this.setUploading(false);
        this.revokePreview();
        if (err instanceof ImageError) this.notify.success(`image.errors.${err.code}`);
        else this.notify.error(err);
      },
      complete: () => {
        this.setUploading(false);
        this.revokePreview();
      },
    });
  }

  protected clear(): void {
    this.revokePreview();
    this.image.set(null);
  }

  private setUploading(value: boolean): void {
    this.uploading.set(value);
    this.uploadingChange.emit(value);
  }

  private revokePreview(): void {
    const url = this.preview();
    if (url) URL.revokeObjectURL(url);
    this.preview.set(null);
  }
}
