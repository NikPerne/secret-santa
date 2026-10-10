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
import { Loader } from '../../shared/loader';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { DrawService } from '../../core/api/draw.service';
import { GroupsService } from '../../core/api/groups.service';
import {
  Dashboard,
  DashboardMember,
  Exclusion,
  Feasibility,
  Member,
  PairView,
} from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { confirmAction } from '../../shared/confirm-dialog';
import { ExclusionsEditor } from '../../shared/exclusions-editor';
import { Avatar } from '../../shared/avatar';
import { InviteEmails } from '../../shared/invite-emails';
import { InviteShare } from '../../shared/invite-share';

@Component({
  selector: 'app-dashboard',
  imports: [
    RouterLink,
    MatButtonModule,
    MatExpansionModule,
    MatIconModule,
    Loader,
    MatTooltipModule,
    TranslocoPipe,
    ExclusionsEditor,
    InviteShare,
    InviteEmails,
    Avatar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardPage {
  readonly groupId = input.required<string>();
  private readonly drawApi = inject(DrawService);
  private readonly groups = inject(GroupsService);
  private readonly notify = inject(NotifyService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly t = inject(TranslocoService);

  protected readonly data = signal<Dashboard | null>(null);
  protected readonly busy = signal(false);
  protected readonly pairs = signal<PairView[] | null>(null);
  /** People already nudged in this session (the server allows one nudge per day). */
  protected readonly nudged = signal(new Set<string>());

  protected readonly group = computed(() => this.data()?.group);
  protected readonly members = computed(() => this.data()?.members ?? []);
  protected readonly participants = computed(() => this.members().filter((m) => m.participates));
  protected readonly asMembers = computed<Member[]>(() =>
    this.members().map(({ id, name, role, participates }) => ({ id, name, role, participates })),
  );
  protected readonly progress = computed(() => {
    const p = this.participants();
    return {
      total: p.length,
      viewed: p.filter((m) => m.viewedMatch).length,
      wishlists: p.filter((m) => m.wishlistCount > 0).length,
      bought: p.filter((m) => m.giftStatus !== 'none').length,
    };
  });

  constructor() {
    effect(() => void this.load(this.groupId()));
  }

  protected async load(id: string): Promise<void> {
    try {
      this.data.set(await this.drawApi.dashboard(id));
    } catch (err) {
      this.notify.error(err);
    }
  }

  /** Feasibility problem, translated using member names. */
  protected feasibilityText(f: Feasibility | null): string | null {
    if (!f || f.ok) return null;
    const names = new Map(this.members().map((m) => [m.id, m.name]));
    const list = f.people.map((id) => names.get(id) ?? '?').join(', ');
    return this.t.translate(`feasibility.${f.code}`, { names: list });
  }

  protected async runDraw(): Promise<void> {
    const g = this.group();
    if (!g) return;
    const redo = g.status !== 'open';
    const ok = await confirmAction(this.dialog, {
      title: redo ? 'dashboard.redoTitle' : 'dashboard.drawTitle',
      message: redo ? 'dashboard.redoMessage' : 'dashboard.drawMessage',
      confirm: redo ? 'dashboard.redoConfirm' : 'dashboard.drawConfirm',
      params: { count: this.participants().length },
      danger: redo,
    });
    if (!ok) return;
    await this.run(async () => {
      const res = await this.drawApi.run(g.id);
      this.notify.success(
        res.avoidedPreviousPairs === false ? 'dashboard.drawnPreviousIgnored' : 'dashboard.drawn',
      );
      this.pairs.set(null);
      await this.load(g.id);
    });
  }

  protected async saveExclusions(exclusions: Exclusion[]): Promise<void> {
    const g = this.group();
    if (!g) return;
    await this.run(async () => {
      await this.groups.setExclusions(g.id, exclusions);
      await this.load(g.id);
    });
  }

  protected async remove(member: { id: string; name: string }): Promise<void> {
    const g = this.group();
    if (!g) return;
    const ok = await confirmAction(this.dialog, {
      title: 'dashboard.removeTitle',
      message: g.status === 'drawn' ? 'dashboard.removeMessageDrawn' : 'dashboard.removeMessage',
      confirm: 'dashboard.removeConfirm',
      params: { name: member.name },
      danger: true,
    });
    if (!ok) return;
    await this.run(async () => {
      await this.drawApi.removeMember(g.id, member.id);
      this.notify.success('dashboard.removed', { name: member.name });
      await this.load(g.id);
    });
  }

  /** Someone who hasn't unwrapped their match yet, or still has an empty wishlist. */
  protected canNudge(m: DashboardMember): boolean {
    const drawn = this.group()?.status === 'drawn';
    return m.participates && ((drawn && !m.viewedMatch) || m.wishlistCount === 0);
  }

  protected async nudge(m: DashboardMember): Promise<void> {
    const g = this.group();
    if (!g) return;
    try {
      await this.drawApi.nudge(g.id, m.id);
      this.notify.success('dashboard.nudged', { name: m.name });
    } catch (err) {
      this.notify.error(err);
    }
    this.nudged.update((s) => new Set(s).add(m.id));
  }

  protected async showPairs(): Promise<void> {
    const g = this.group();
    if (!g) return;
    await this.run(async () => this.pairs.set(await this.drawApi.pairs(g.id)));
  }

  protected async duplicate(): Promise<void> {
    const g = this.group();
    if (!g) return;
    const ok = await confirmAction(this.dialog, {
      title: 'dashboard.duplicateTitle',
      message: 'dashboard.duplicateMessage',
      confirm: 'dashboard.duplicateConfirm',
    });
    if (!ok) return;
    await this.run(async () => {
      const copy = await this.drawApi.duplicate(g.id);
      await this.router.navigate(['/g', copy.id, 'setup']);
    });
  }

  protected async deleteGroup(): Promise<void> {
    const g = this.group();
    if (!g) return;
    const ok = await confirmAction(this.dialog, {
      title: 'dashboard.deleteTitle',
      message: 'dashboard.deleteMessage',
      confirm: 'dashboard.deleteConfirm',
      params: { name: g.name },
      danger: true,
    });
    if (!ok) return;
    await this.run(async () => {
      await this.groups.remove(g.id);
      await this.router.navigate(['/']);
    });
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await fn();
    } catch (err) {
      this.notify.error(err);
    } finally {
      this.busy.set(false);
    }
  }
}
