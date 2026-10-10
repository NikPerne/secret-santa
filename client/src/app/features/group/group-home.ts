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
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { GroupsService } from '../../core/api/groups.service';
import { GroupDetail } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
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
  private readonly notify = inject(NotifyService);

  protected readonly detail = signal<GroupDetail | null>(null);
  protected readonly error = signal(false);
  protected readonly initials = initials;

  protected readonly group = computed(() => this.detail()?.group);
  protected readonly me = computed(() => this.detail()?.me);
  protected readonly isOrganizer = computed(() => this.me()?.role === 'organizer');
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
      this.detail.set(await this.groups.get(id));
    } catch (err) {
      this.error.set(true);
      this.notify.error(err);
    }
  }
}
