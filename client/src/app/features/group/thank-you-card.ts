import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { ChatService, ThankYouState } from '../../core/api/chat.service';
import { NotifyService } from '../../core/notify.service';

/** After the exchange: send an anonymous thank-you to my Santa, and read the one I received. */
@Component({
  selector: 'app-thank-you-card',
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
    @if (state(); as s) {
      @if (s.received) {
        <section class="surface-card received" aria-labelledby="ty-in">
          <h2 id="ty-in">💌 {{ 'thanks.receivedTitle' | transloco }}</h2>
          <blockquote>{{ s.received.text }}</blockquote>
        </section>
      }
      @if (s.canSend) {
        <section class="surface-card stack" aria-labelledby="ty-out">
          <h2 id="ty-out">🙏 {{ 'thanks.sendTitle' | transloco }}</h2>
          @if (s.sent && !editing()) {
            <blockquote>{{ s.sent.text }}</blockquote>
            <p class="muted small">{{ 'thanks.sentHint' | transloco }}</p>
            <button mat-button (click)="edit()">
              <mat-icon>edit</mat-icon>{{ 'common.edit' | transloco }}
            </button>
          } @else {
            <p class="muted">{{ 'thanks.sendHint' | transloco }}</p>
            <form class="stack" (ngSubmit)="send()">
              <mat-form-field appearance="outline">
                <mat-label>{{ 'thanks.label' | transloco }}</mat-label>
                <textarea
                  matInput
                  name="text"
                  rows="3"
                  maxlength="1000"
                  [placeholder]="'thanks.placeholder' | transloco"
                  [ngModel]="text()"
                  (ngModelChange)="text.set($event)"
                ></textarea>
              </mat-form-field>
              <button mat-flat-button type="submit" [disabled]="!text().trim() || busy()">
                <mat-icon>favorite</mat-icon>{{ 'thanks.send' | transloco }}
              </button>
            </form>
          }
        </section>
      }
    }
  `,
  styles: `
    h2 {
      font: var(--mat-sys-title-medium);
      margin: 0 0 8px;
    }
    blockquote {
      margin: 0;
      padding: 8px 14px;
      border-left: 4px solid var(--mat-sys-primary);
      white-space: pre-wrap;
      font-style: italic;
    }
    .received {
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }
    .small {
      font: var(--mat-sys-body-small);
      margin: 0;
    }
  `,
})
export class ThankYouCard implements OnInit {
  readonly groupId = input.required<string>();
  private readonly chat = inject(ChatService);
  private readonly notify = inject(NotifyService);
  protected readonly state = signal<ThankYouState | null>(null);
  protected readonly text = signal('');
  protected readonly editing = signal(false);
  protected readonly busy = signal(false);

  async ngOnInit(): Promise<void> {
    try {
      this.state.set(await this.chat.thankYou(this.groupId()));
    } catch {
      /* not available (e.g. not part of the draw) */
    }
  }

  protected edit(): void {
    this.text.set(this.state()?.sent?.text ?? '');
    this.editing.set(true);
  }

  protected async send(): Promise<void> {
    this.busy.set(true);
    try {
      const sent = await this.chat.sendThankYou(this.groupId(), this.text().trim());
      this.state.update((s) => (s ? { ...s, sent } : s));
      this.editing.set(false);
      this.notify.success('thanks.sent');
    } catch (err) {
      this.notify.error(err);
    } finally {
      this.busy.set(false);
    }
  }
}
