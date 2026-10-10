import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Loader } from '../../shared/loader';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { DrawService } from '../../core/api/draw.service';
import { Match } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { Avatar } from '../../shared/avatar';

type Phase = 'loading' | 'wrapped' | 'opening' | 'revealed' | 'error';

/** Tap-to-unwrap reveal of your match. Motion is reduced automatically for prefers-reduced-motion. */
@Component({
  selector: 'app-reveal',
  imports: [MatButtonModule, MatIconModule, Loader, RouterLink, TranslocoPipe, Avatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reveal.html',
  styleUrl: './reveal.scss',
})
export class Reveal implements OnInit {
  readonly groupId = input.required<string>();
  private readonly draw = inject(DrawService);
  private readonly notify = inject(NotifyService);

  protected readonly phase = signal<Phase>('loading');
  protected readonly match = signal<Match | null>(null);
  protected readonly errorMessage = signal('');
  private readonly nameEl = viewChild<ElementRef<HTMLElement>>('nameEl');
  protected readonly confetti = Array.from({ length: 24 }, (_, i) => ({
    left: (i * 37) % 100,
    delay: (i % 8) * 0.08,
    hue: [0, 45, 120, 200, 330][i % 5],
  }));

  async ngOnInit(): Promise<void> {
    try {
      const res = await this.draw.match(this.groupId());
      this.match.set(res.match);
      this.phase.set('wrapped');
    } catch (err) {
      this.errorMessage.set(this.notify.messageFor(err));
      this.phase.set('error');
    }
  }

  protected unwrap(): void {
    if (this.phase() !== 'wrapped') return;
    this.phase.set('opening');
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setTimeout(
      () => {
        this.phase.set('revealed');
        // Move focus to the name so screen readers announce it.
        setTimeout(() => this.nameEl()?.nativeElement.focus(), 0);
      },
      reduced ? 50 : 900,
    );
    this.draw.markViewed(this.groupId()).catch(() => undefined);
  }

  protected wrapAgain(): void {
    this.phase.set('wrapped');
  }
}
