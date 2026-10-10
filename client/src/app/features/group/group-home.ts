import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { DrawService } from '../../core/api/draw.service';
import { GroupsService } from '../../core/api/groups.service';
import { GroupDetail, Match } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { confirmAction } from '../../shared/confirm-dialog';
import { Countdown } from '../../shared/countdown';
import { InviteShare } from '../../shared/invite-share';
import { LocalDatePipe, MoneyPipe, initials } from '../../shared/pipes';

@Component({
  selector: 'app-group-home',
  imports: [
    RouterLink,
    MatButtonModule,
    MatExpansionModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslocoPipe,
    Countdown,
    InviteShare,
    LocalDatePipe,
    MoneyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './group-home.html',
  styleUrl: './group-home.scss',
})
export class GroupHome {
  readonly groupId = input.required<string>();
  private readonly groups = inject(GroupsService);
  private readonly drawApi = inject(DrawService);
  private readonly notify = inject(NotifyService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  protected readonly detail = signal<GroupDetail | null>(null);
  protected readonly match = signal<Match | null>(null);
  protected readonly mySanta = signal<string | null>(null);
  protected readonly error = signal(false);
  protected readonly initials = initials;

  protected readonly group = computed(() => this.detail()?.group);
  protected readonly me = computed(() => this.detail()?.me);
  protected readonly isOrganizer = computed(() => this.me()?.role === 'organizer');
  protected readonly playing = computed(
    () => !!this.me()?.participates && this.group()?.status !== 'open',
  );
  protected readonly participants = computed(
    () => this.detail()?.members.filter((m) => m.participates) ?? [],
  );
  protected readonly upcoming = computed(() => {
    const d = this.group()?.exchangeDate;
    return !!d && new Date(d).getTime() > Date.now();
  });

  constructor() {
    effect(() => void this.load(this.groupId()));
  }

  protected async load(id: string): Promise<void> {
    this.error.set(false);
    try {
      const detail = await this.groups.get(id);
      this.detail.set(detail);
      if (detail.me.participates && detail.group.status !== 'open') {
        this.drawApi
          .match(id)
          .then((m) => this.match.set(m.match))
          .catch(() => this.match.set(null));
      }
      if (detail.group.exchangePassed && detail.group.settings.bigRevealAfterExchange) {
        this.drawApi
          .mySanta(id)
          .then((name) => this.mySanta.set(name))
          .catch(() => undefined);
      }
    } catch (err) {
      this.error.set(true);
      this.notify.error(err);
    }
  }

  protected async leave(): Promise<void> {
    const g = this.group();
    if (!g) return;
    const ok = await confirmAction(this.dialog, {
      title: 'group.leaveTitle',
      message: 'group.leaveMessage',
      confirm: 'group.leaveConfirm',
      params: { name: g.name },
      danger: true,
    });
    if (!ok) return;
    try {
      await this.drawApi.leave(g.id);
      await this.router.navigate(['/']);
    } catch (err) {
      this.notify.error(err);
    }
  }
}
