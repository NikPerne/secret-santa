import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { DrawService } from '../../core/api/draw.service';
import { PairView } from '../../core/models';
import { NotifyService } from '../../core/notify.service';

/**
 * Printable fold-over reveal cards for in-person events. The receiver's name sits on the inner
 * half and is blurred on screen, so the organizer can print without reading the pairs.
 */
@Component({
  selector: 'app-print-cards',
  imports: [MatButtonModule, MatIconModule, RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <div class="no-print stack">
        <h1 class="page-title">{{ 'print.title' | transloco }}</h1>
        <p class="muted">{{ 'print.hint' | transloco }}</p>
        <div class="row">
          <button mat-flat-button (click)="print()" [disabled]="!pairs().length">
            <mat-icon>print</mat-icon>{{ 'print.print' | transloco }}
          </button>
          <a mat-button [routerLink]="['/g', groupId(), 'manage']">{{
            'common.back' | transloco
          }}</a>
        </div>
      </div>
      <div class="cards">
        @for (p of pairs(); track p.giver.id) {
          <article class="card">
            <div class="outside">
              <span class="emoji" aria-hidden="true">🎅</span>
              <p>
                <strong>{{ p.giver.name }}</strong>
              </p>
              <p class="small">{{ 'print.foldHere' | transloco }}</p>
            </div>
            <div class="inside">
              <p class="small">{{ 'print.youAreSantaFor' | transloco }}</p>
              <p class="receiver">{{ p.receiver.name }}</p>
            </div>
          </article>
        }
      </div>
    </section>
  `,
  styles: `
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 16px;
      margin-top: 16px;
    }
    .card {
      border: 2px dashed var(--mat-sys-outline);
      border-radius: 12px;
      overflow: hidden;
      break-inside: avoid;
      text-align: center;
    }
    .outside,
    .inside {
      padding: 16px;
      min-height: 110px;
      display: grid;
      align-content: center;
    }
    .outside {
      border-bottom: 2px dashed var(--mat-sys-outline);
    }
    .inside {
      /* Upside down so it reads correctly once folded. */
      transform: rotate(180deg);
    }
    .receiver {
      font-size: 1.6rem;
      font-weight: 700;
      filter: blur(9px);
      user-select: none;
    }
    .emoji {
      font-size: 32px;
    }
    .small {
      font-size: 0.8rem;
      margin: 0;
    }
    p {
      margin: 4px 0;
    }
    @media print {
      .page {
        max-width: none;
        padding: 0;
      }
      .cards {
        grid-template-columns: repeat(2, 1fr);
      }
      .card {
        border-color: #999;
      }
      .receiver {
        filter: none;
      }
    }
  `,
})
export class PrintCards implements OnInit {
  readonly groupId = input.required<string>();
  private readonly draw = inject(DrawService);
  private readonly notify = inject(NotifyService);
  protected readonly pairs = signal<PairView[]>([]);

  async ngOnInit(): Promise<void> {
    try {
      this.pairs.set(await this.draw.pairs(this.groupId()));
    } catch (err) {
      this.notify.error(err);
    }
  }

  protected print(): void {
    window.print();
  }
}
