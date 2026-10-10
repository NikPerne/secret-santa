import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ChatService } from '../../core/api/chat.service';
import { DrawService } from '../../core/api/draw.service';
import { ChatMessage, ChatWho } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { LocalDatePipe } from '../../shared/pipes';

/** Poll fast while a conversation is active, then back off to save bandwidth. */
const POLL_MIN_MS = 12_000;
const POLL_MAX_MS = 60_000;

/** Anonymous chat. Polls every 12–60s (adaptive) while the page is visible. */
@Component({
  selector: 'app-chat',
  imports: [
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslocoPipe,
    LocalDatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class Chat implements OnInit {
  readonly groupId = input.required<string>();
  readonly who = input.required<ChatWho>();
  private readonly chat = inject(ChatService);
  private readonly draw = inject(DrawService);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly text = signal('');
  protected readonly sending = signal(false);
  protected readonly matchName = signal<string | null>(null);
  protected readonly canSend = computed(() => this.text().trim().length > 0 && !this.sending());
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private timer?: ReturnType<typeof setTimeout>;
  private delay = POLL_MIN_MS;

  async ngOnInit(): Promise<void> {
    if (this.who() === 'match') {
      this.draw
        .match(this.groupId())
        .then((m) => this.matchName.set(m.match.name))
        .catch(() => undefined);
    }
    try {
      this.messages.set(await this.chat.messages(this.groupId(), this.who()));
      this.scrollToEnd();
    } catch (err) {
      this.error.set(this.notify.messageFor(err));
    } finally {
      this.loading.set(false);
    }
    this.schedule();
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      this.delay = POLL_MIN_MS;
      void this.poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    this.destroyRef.onDestroy(() => {
      clearTimeout(this.timer);
      document.removeEventListener('visibilitychange', onVisible);
    });
  }

  private schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(async () => {
      await this.poll();
      this.schedule();
    }, this.delay);
  }

  private async poll(): Promise<void> {
    if (document.visibilityState !== 'visible' || this.error()) return;
    const last = this.messages().at(-1)?.createdAt;
    try {
      const fresh = await this.chat.messages(this.groupId(), this.who(), last);
      // Nothing new: wait a bit longer next time (12s → 18s → … → 60s).
      this.delay = fresh.length ? POLL_MIN_MS : Math.min(POLL_MAX_MS, Math.round(this.delay * 1.5));
      this.append(fresh);
    } catch {
      /* transient: try again next tick */
    }
  }

  private append(fresh: ChatMessage[]): void {
    const known = new Set(this.messages().map((m) => m.id));
    const added = fresh.filter((m) => !known.has(m.id));
    if (!added.length) return;
    this.messages.update((list) => [...list, ...added]);
    this.scrollToEnd();
  }

  protected async send(): Promise<void> {
    const text = this.text().trim();
    if (!text) return;
    this.sending.set(true);
    try {
      const message = await this.chat.send(this.groupId(), this.who(), text);
      this.text.set('');
      this.append([message]);
      // A reply is likely soon.
      this.delay = POLL_MIN_MS;
      this.schedule();
    } catch (err) {
      this.notify.error(err);
    } finally {
      this.sending.set(false);
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    // Enter sends, Shift+Enter adds a new line.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.send();
    }
  }

  private scrollToEnd(): void {
    setTimeout(() => {
      const el = this.scroller()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}
