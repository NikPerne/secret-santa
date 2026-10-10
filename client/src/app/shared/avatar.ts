import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cldUrl } from '../core/api/upload.service';
import { initials } from './pipes';

/** Round profile photo (face-cropped by Cloudinary), or the person's initials as a fallback. */
@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--size.px]': 'size()' },
  template: `
    @if (src(); as s) {
      <img [src]="s" alt="" [width]="size()" [height]="size()" loading="lazy" />
    } @else {
      <span class="initials" aria-hidden="true">{{ letters() }}</span>
    }
  `,
  styles: `
    :host {
      display: inline-grid;
      flex-shrink: 0;
      width: var(--size);
      height: var(--size);
      border-radius: 50%;
      overflow: hidden;
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
      vertical-align: middle;
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .initials {
      display: grid;
      place-items: center;
      font-weight: 600;
      font-size: calc(var(--size) * 0.4);
      line-height: 1;
    }
  `,
})
export class Avatar {
  readonly name = input('');
  readonly url = input<string | null | undefined>(null);
  readonly size = input(40);
  protected readonly letters = computed(() => initials(this.name()) || '?');
  /** 2× the display size for sharp images on high-DPI screens. */
  protected readonly src = computed(() => {
    const url = this.url();
    const px = Math.round(this.size() * 2);
    return url ? cldUrl(url, { w: px, h: px, crop: 'thumb', face: true }) : null;
  });
}
