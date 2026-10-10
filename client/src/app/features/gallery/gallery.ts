import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { GalleryService } from '../../core/api/chat.service';
import { GroupsService } from '../../core/api/groups.service';
import { cldUrl } from '../../core/api/upload.service';
import { GalleryPhoto, ImageRef } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { confirmAction } from '../../shared/confirm-dialog';
import { ImagePicker } from '../../shared/image-picker';
import { openLightbox } from '../../shared/lightbox';

/** Gift photo wall, open after the exchange date. */
@Component({
  selector: 'app-gallery',
  imports: [
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    TranslocoPipe,
    ImagePicker,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gallery.html',
  styleUrl: './gallery.scss',
})
export class Gallery implements OnInit {
  readonly groupId = input.required<string>();
  private readonly gallery = inject(GalleryService);
  private readonly groups = inject(GroupsService);
  private readonly notify = inject(NotifyService);
  private readonly dialog = inject(MatDialog);

  protected readonly loading = signal(true);
  protected readonly open = signal(false);
  protected readonly photos = signal<GalleryPhoto[]>([]);
  protected readonly uploads = signal(false);
  protected readonly isOrganizer = signal(false);
  protected readonly newImage = signal<ImageRef | null>(null);
  protected readonly caption = signal('');
  protected readonly uploading = signal(false);
  protected readonly posting = signal(false);

  async ngOnInit(): Promise<void> {
    try {
      const [res, detail] = await Promise.all([
        this.gallery.list(this.groupId()),
        this.groups.get(this.groupId()),
      ]);
      this.open.set(res.open);
      this.photos.set(res.photos);
      this.isOrganizer.set(detail.me.role === 'organizer');
    } catch (err) {
      this.notify.error(err);
    } finally {
      this.loading.set(false);
    }
    this.groups
      .config()
      .then((c) => this.uploads.set(c.uploads))
      .catch(() => undefined);
  }

  protected thumb(url: string): string {
    return cldUrl(url, { w: 480, h: 480 });
  }

  protected zoom(p: GalleryPhoto): void {
    openLightbox(this.dialog, { url: p.image.url, alt: p.caption || p.by, caption: p.caption });
  }

  protected async post(): Promise<void> {
    const image = this.newImage();
    if (!image) return;
    this.posting.set(true);
    try {
      const photo = await this.gallery.add(this.groupId(), image, this.caption().trim());
      this.photos.update((list) => [photo, ...list]);
      this.newImage.set(null);
      this.caption.set('');
    } catch (err) {
      this.notify.error(err);
    } finally {
      this.posting.set(false);
    }
  }

  protected async remove(p: GalleryPhoto): Promise<void> {
    const ok = await confirmAction(this.dialog, {
      title: 'gallery.deleteTitle',
      message: 'gallery.deleteMessage',
      confirm: 'common.delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await this.gallery.remove(this.groupId(), p.id);
      this.photos.update((list) => list.filter((x) => x.id !== p.id));
    } catch (err) {
      this.notify.error(err);
    }
  }
}
