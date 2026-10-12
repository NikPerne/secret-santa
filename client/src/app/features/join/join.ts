import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Loader } from '../../shared/loader';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/api/auth.service';
import { GroupsService } from '../../core/api/groups.service';
import { InvitePreview } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { LocalDatePipe, MoneyPipe } from '../../shared/pipes';
import { Avatar } from '../../shared/avatar';
import { ThemeBadge } from '../../shared/theme-badge';

@Component({
  selector: 'app-join',
  imports: [
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    Loader,
    TranslocoPipe,
    LocalDatePipe,
    MoneyPipe,
    ThemeBadge,
    Avatar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './join.html',
  styleUrl: './join.scss',
})
export class Join implements OnInit {
  readonly code = input.required<string>();
  protected readonly auth = inject(AuthService);
  private readonly groups = inject(GroupsService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotifyService);

  protected readonly invite = signal<InvitePreview | null>(null);
  protected readonly instantJoin = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly busy = signal(false);

  async ngOnInit(): Promise<void> {
    await this.auth.ready();
    try {
      const res = await this.groups.invite(this.code());
      if (res.invite.alreadyMember && res.invite.groupId) {
        await this.router.navigate(['/g', res.invite.groupId], { replaceUrl: true });
        return;
      }
      this.invite.set(res.invite);
      this.instantJoin.set(res.instantJoin);
    } catch (err) {
      this.loadError.set(this.notify.messageFor(err));
    }
  }

  /** One tap for people who are already signed in. */
  protected async joinAsMe(): Promise<void> {
    await this.run(async () => {
      const res = await this.groups.join(this.code());
      await this.router.navigate(['/g', res.groupId]);
    });
  }

  protected async instant(): Promise<void> {
    await this.run(async () => {
      const res = await this.auth.devLogin({
        email: this.email().trim(),
        name: this.name().trim(),
        inviteCode: this.code(),
      });
      await this.router.navigate(['/g', res.groupId]);
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
