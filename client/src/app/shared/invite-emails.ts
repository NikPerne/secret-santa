import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { GroupsService } from '../core/api/groups.service';
import { NotifyService } from '../core/notify.service';

/** Splits pasted text (commas, spaces, new lines, semicolons) into unique email addresses. */
export function parseEmails(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\s,;]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)),
    ),
  ];
}

/** "Invite by email": the organizer pastes a few addresses and the app emails the invite link. */
@Component({
  selector: 'app-invite-emails',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="stack" (ngSubmit)="send()">
      <mat-form-field appearance="outline">
        <mat-label>{{ 'inviteEmails.label' | transloco }}</mat-label>
        <textarea
          matInput
          name="emails"
          rows="3"
          inputmode="email"
          [placeholder]="'inviteEmails.placeholder' | transloco"
          [ngModel]="text()"
          (ngModelChange)="text.set($event)"
        ></textarea>
        <mat-hint>{{ 'inviteEmails.hint' | transloco: { count: emails().length } }}</mat-hint>
      </mat-form-field>
      <button mat-stroked-button type="submit" [disabled]="!emails().length || busy()">
        <mat-icon>forward_to_inbox</mat-icon>{{ 'inviteEmails.send' | transloco }}
      </button>
    </form>
  `,
})
export class InviteEmails {
  readonly groupId = input.required<string>();
  private readonly groups = inject(GroupsService);
  private readonly notify = inject(NotifyService);
  protected readonly text = signal('');
  protected readonly busy = signal(false);
  protected readonly emails = computed(() => parseEmails(this.text()).slice(0, 30));

  protected async send(): Promise<void> {
    this.busy.set(true);
    try {
      const res = await this.groups.inviteEmails(this.groupId(), this.emails());
      this.notify.success('inviteEmails.sent', res);
      this.text.set('');
    } catch (err) {
      this.notify.error(err);
    } finally {
      this.busy.set(false);
    }
  }
}
