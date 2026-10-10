import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { cldUrl } from '../core/api/upload.service';

export interface LightboxData {
  url: string;
  alt: string;
  caption?: string;
}

/** Full-screen image viewer. Esc / close button / backdrop click closes it. */
@Component({
  selector: 'app-lightbox',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="lightbox">
      <img [src]="src" [alt]="data.alt" />
      @if (data.caption) {
        <figcaption>{{ data.caption }}</figcaption>
      }
    </figure>
    <button
      mat-icon-button
      class="close"
      mat-dialog-close
      [attr.aria-label]="'common.close' | transloco"
    >
      <mat-icon>close</mat-icon>
    </button>
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      background: #000;
    }
    .lightbox {
      margin: 0;
      display: grid;
      place-items: center;
      min-height: 50vh;
    }
    img {
      max-width: 100%;
      max-height: 85vh;
      object-fit: contain;
    }
    figcaption {
      color: #fff;
      padding: 12px;
      text-align: center;
    }
    .close {
      position: absolute;
      top: 8px;
      right: 8px;
      color: #fff;
      background: rgb(0 0 0 / 50%);
    }
  `,
})
export class Lightbox {
  protected readonly data = inject<LightboxData>(MAT_DIALOG_DATA);
  protected readonly src = cldUrl(this.data.url, { w: 1600, crop: 'limit' });
}

export function openLightbox(dialog: MatDialog, data: LightboxData): void {
  dialog.open(Lightbox, {
    data,
    maxWidth: '100vw',
    maxHeight: '100vh',
    panelClass: 'lightbox-panel',
    autoFocus: 'dialog',
  });
}
