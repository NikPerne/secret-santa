import {
  ChangeDetectionStrategy,
  Component,
  computed,
  OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Loader } from '../../shared/loader';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { DrawService } from '../../core/api/draw.service';
import { GroupsService } from '../../core/api/groups.service';
import { cldUrl } from '../../core/api/upload.service';
import { WishlistService } from '../../core/api/wishlist.service';
import { Budget, GroupTheme, Match, Preferences, WishlistItem } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { openLightbox } from '../../shared/lightbox';
import { MoneyPipe } from '../../shared/pipes';
import { Avatar } from '../../shared/avatar';
import { ThemeBadge } from '../../shared/theme-badge';
import { GiftIdeas } from './gift-ideas';

/** Read-only view of my match's wishlist, preferences and (optional) shipping address. */
@Component({
  selector: 'app-match-wishlist',
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    Loader,
    TranslocoPipe,
    MoneyPipe,
    ThemeBadge,
    GiftIdeas,
    Avatar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './match-wishlist.html',
  styleUrl: './match-wishlist.scss',
})
export class MatchWishlist implements OnInit {
  readonly groupId = input.required<string>();
  private readonly draw = inject(DrawService);
  private readonly wishlist = inject(WishlistService);
  private readonly groups = inject(GroupsService);
  private readonly notify = inject(NotifyService);
  private readonly dialog = inject(MatDialog);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly match = signal<Match | null>(null);
  protected readonly items = signal<WishlistItem[]>([]);
  /** Their wish titles also hint at what they like (used to personalize ideas). */
  protected readonly wishTitles = computed(() => this.items().map((i) => i.title));
  protected readonly prefs = signal<Preferences | null>(null);
  protected readonly currency = signal('EUR');
  protected readonly theme = signal<GroupTheme>({ preset: 'none', text: '' });
  protected readonly budget = signal<Budget>({ amount: null, currency: 'EUR' });
  protected readonly showIdeas = signal(false);

  async ngOnInit(): Promise<void> {
    const id = this.groupId();
    try {
      const [match, list, detail] = await Promise.all([
        this.draw.match(id),
        this.wishlist.matchWishlist(id),
        this.groups.get(id),
      ]);
      this.match.set(match.match);
      this.items.set(list.items);
      this.prefs.set(list.preferences);
      this.currency.set(detail.group.budget.currency);
      this.budget.set(detail.group.budget);
      this.theme.set(detail.group.theme ?? { preset: 'none', text: '' });
    } catch (err) {
      this.error.set(this.notify.messageFor(err));
    } finally {
      this.loading.set(false);
    }
  }

  protected image(url: string): string {
    return cldUrl(url, { w: 640, h: 480 });
  }

  protected zoom(item: WishlistItem): void {
    if (item.image) {
      openLightbox(this.dialog, { url: item.image.url, alt: item.title, caption: item.title });
    }
  }

  protected hasPrefs(p: Preferences | null): boolean {
    return !!p && !!(p.sizes || p.likes || p.dislikes);
  }
}
