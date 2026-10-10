import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Loader } from '../../shared/loader';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { GroupsService } from '../../core/api/groups.service';
import { cldUrl } from '../../core/api/upload.service';
import { WishlistService } from '../../core/api/wishlist.service';
import { GroupDetail, Preferences, WishlistItem, WishlistItemInput } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { confirmAction } from '../../shared/confirm-dialog';
import { openLightbox } from '../../shared/lightbox';
import { MoneyPipe } from '../../shared/pipes';
import { ItemDialog, ItemDialogData } from './item-dialog';

@Component({
  selector: 'app-wishlist-editor',
  imports: [
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    Loader,
    TranslocoPipe,
    MoneyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wishlist-editor.html',
  styleUrl: './wishlist-editor.scss',
})
export class WishlistEditor implements OnInit {
  readonly groupId = input.required<string>();
  private readonly wishlist = inject(WishlistService);
  private readonly groups = inject(GroupsService);
  private readonly notify = inject(NotifyService);
  private readonly dialog = inject(MatDialog);

  protected readonly loading = signal(true);
  protected readonly items = signal<WishlistItem[]>([]);
  protected readonly detail = signal<GroupDetail | null>(null);
  protected readonly prefs = signal<Preferences>({ sizes: '', likes: '', dislikes: '' });
  protected readonly address = signal('');
  protected readonly uploads = signal(false);
  protected readonly savingPrefs = signal(false);

  async ngOnInit(): Promise<void> {
    const id = this.groupId();
    try {
      const [items, prefs, detail] = await Promise.all([
        this.wishlist.list(id),
        this.wishlist.preferences(id),
        this.groups.get(id),
      ]);
      this.items.set(items);
      this.prefs.set(prefs);
      this.detail.set(detail);
      this.address.set(detail.me.shippingAddress);
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
    return cldUrl(url, { w: 160, h: 160 });
  }

  protected zoom(item: WishlistItem): void {
    if (item.image) openLightbox(this.dialog, { url: item.image.url, alt: item.title });
  }

  protected async openItem(item?: WishlistItem): Promise<void> {
    const data: ItemDialogData = {
      groupId: this.groupId(),
      item,
      currency: this.detail()?.group.budget.currency ?? 'EUR',
      uploads: this.uploads(),
    };
    const ref = this.dialog.open<ItemDialog, ItemDialogData, WishlistItemInput>(ItemDialog, {
      data,
      width: '560px',
      maxWidth: '96vw',
      autoFocus: 'first-tabbable',
    });
    const result = await firstValueFrom(ref.afterClosed());
    if (!result) return;
    try {
      if (item) {
        const updated = await this.wishlist.update(this.groupId(), item.id, result);
        this.items.update((list) => list.map((i) => (i.id === item.id ? updated : i)));
      } else {
        const created = await this.wishlist.create(this.groupId(), result);
        this.items.update((list) => [...list, created]);
      }
      this.notify.success('common.saved');
    } catch (err) {
      this.notify.error(err);
    }
  }

  protected async remove(item: WishlistItem): Promise<void> {
    const ok = await confirmAction(this.dialog, {
      title: 'wishlist.deleteTitle',
      message: 'wishlist.deleteMessage',
      confirm: 'common.delete',
      params: { title: item.title },
      danger: true,
    });
    if (!ok) return;
    try {
      await this.wishlist.remove(this.groupId(), item.id);
      this.items.update((list) => list.filter((i) => i.id !== item.id));
    } catch (err) {
      this.notify.error(err);
    }
  }

  protected drop(event: CdkDragDrop<WishlistItem[]>): void {
    this.move(event.previousIndex, event.currentIndex);
  }

  /** Keyboard-accessible alternative to drag and drop. */
  protected move(from: number, to: number): void {
    if (from === to || to < 0 || to >= this.items().length) return;
    const list = [...this.items()];
    moveItemInArray(list, from, to);
    this.items.set(list);
    this.wishlist
      .reorder(
        this.groupId(),
        list.map((i) => i.id),
      )
      .catch((err: unknown) => this.notify.error(err));
  }

  protected setPref(key: keyof Preferences, value: string): void {
    this.prefs.update((p) => ({ ...p, [key]: value }));
  }

  protected async saveAboutMe(): Promise<void> {
    this.savingPrefs.set(true);
    try {
      await this.wishlist.savePreferences(this.groupId(), this.prefs());
      if (this.detail()?.group.settings.allowShippingAddress) {
        await this.groups.updateMe(this.groupId(), { shippingAddress: this.address().trim() });
      }
      this.notify.success('common.saved');
    } catch (err) {
      this.notify.error(err);
    } finally {
      this.savingPrefs.set(false);
    }
  }
}
