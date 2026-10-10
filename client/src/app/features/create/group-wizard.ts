import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { GroupsService } from '../../core/api/groups.service';
import {
  Exclusion,
  Group,
  GroupSettings,
  ImageRef,
  Member,
  THEME_PRESETS,
  ThemePreset,
} from '../../core/models';
import { THEME_EMOJI } from '../wishlist/gift-ideas.data';
import { NotifyService } from '../../core/notify.service';
import { ExclusionsEditor } from '../../shared/exclusions-editor';
import { ImagePicker } from '../../shared/image-picker';
import { InviteEmails } from '../../shared/invite-emails';
import { InviteShare } from '../../shared/invite-share';

export const CURRENCIES = [
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'SEK',
  'NOK',
  'DKK',
  'PLN',
  'CZK',
  'HUF',
  'CAD',
  'AUD',
];

type Step = 1 | 2 | 3;

/** Local calendar date as YYYY-MM-DD (the API stores it as a whole day). */
export function toYmd(date: Date | null): string | null {
  if (!date) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Create-group wizard: basics → budget & rules → invite. Also used to edit an existing group. */
@Component({
  selector: 'app-group-wizard',
  imports: [
    FormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    TranslocoPipe,
    ExclusionsEditor,
    InviteShare,
    InviteEmails,
    ImagePicker,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './group-wizard.html',
  styleUrl: './group-wizard.scss',
})
export class GroupWizard implements OnInit {
  /** Set when editing an existing group (route /g/:groupId/setup). */
  readonly groupId = input<string>();
  private readonly groups = inject(GroupsService);
  private readonly router = inject(Router);
  private readonly urlLocation = inject(Location);
  private readonly notify = inject(NotifyService);

  protected readonly currencies = CURRENCIES;
  protected readonly minDate = new Date();
  protected readonly step = signal<Step>(1);
  protected readonly busy = signal(false);
  protected readonly group = signal<Group | null>(null);
  protected readonly members = signal<Member[]>([]);
  protected readonly exclusions = signal<Exclusion[]>([]);

  // Step 1
  protected readonly name = signal('');
  protected readonly exchangeDate = signal<Date | null>(null);
  protected readonly location = signal('');
  protected readonly description = signal('');
  // Step 2
  protected readonly amount = signal<number | null>(null);
  protected readonly currency = signal('EUR');
  protected readonly cover = signal<ImageRef | null>(null);
  protected readonly themePresets = THEME_PRESETS;
  protected readonly themeEmoji = THEME_EMOJI;
  protected readonly themePreset = signal<ThemePreset>('none');
  protected readonly themeText = signal('');
  protected readonly uploads = signal(false);
  protected readonly settings = signal<GroupSettings>({
    organizerParticipates: true,
    organizerSeesPairs: false,
    allowShippingAddress: false,
    bigRevealAfterExchange: true,
    avoidPreviousPairs: true,
  });

  async ngOnInit(): Promise<void> {
    this.groups
      .config()
      .then((c) => this.uploads.set(c.uploads))
      .catch(() => undefined);
    const id = this.groupId();
    if (!id) return;
    try {
      const detail = await this.groups.get(id);
      const g = detail.group;
      this.group.set(g);
      this.members.set(detail.members);
      this.exclusions.set(g.exclusions ?? []);
      this.name.set(g.name);
      this.exchangeDate.set(g.exchangeDate ? new Date(g.exchangeDate) : null);
      this.location.set(g.location);
      this.description.set(g.description);
      this.amount.set(g.budget.amount);
      this.currency.set(g.budget.currency);
      this.settings.set(g.settings);
      this.cover.set(g.coverImage);
      this.themePreset.set(g.theme?.preset ?? 'none');
      this.themeText.set(g.theme?.text ?? '');
    } catch (err) {
      this.notify.error(err);
    }
  }

  protected setSetting<K extends keyof GroupSettings>(key: K, value: GroupSettings[K]): void {
    this.settings.update((s) => ({ ...s, [key]: value }));
  }

  protected back(): void {
    this.step.update((s) => (s > 1 ? ((s - 1) as Step) : s));
  }

  protected async saveBasics(): Promise<void> {
    const body = {
      name: this.name().trim(),
      exchangeDate: toYmd(this.exchangeDate()),
      location: this.location().trim(),
      description: this.description().trim(),
    };
    await this.run(async () => {
      const existing = this.group();
      const group = existing
        ? await this.groups.update(existing.id, body)
        : await this.groups.create(body);
      this.group.set(group);
      if (!existing) {
        // Replace the URL so "back" from the invite step edits this group instead of creating another.
        this.urlLocation.replaceState(`/g/${group.id}/setup`);
        const detail = await this.groups.get(group.id);
        this.members.set(detail.members);
      }
      this.step.set(2);
    });
  }

  protected async saveRules(): Promise<void> {
    const group = this.group();
    if (!group) return;
    await this.run(async () => {
      let updated = await this.groups.update(group.id, {
        budget: { amount: this.amount(), currency: this.currency() },
        settings: this.settings(),
        theme: this.themeToSave(),
        ...(this.cover()?.publicId !== group.coverImage?.publicId
          ? { coverImage: this.cover() }
          : {}),
      });
      if (JSON.stringify(updated.exclusions ?? []) !== JSON.stringify(this.exclusions())) {
        updated = await this.groups.setExclusions(group.id, this.exclusions());
      }
      this.group.set(updated);
      this.step.set(3);
    });
  }

  /** A custom theme without a description means no theme. */
  private themeToSave(): { preset: ThemePreset; text: string } {
    const text = this.themeText().trim();
    const preset = this.themePreset();
    if (preset === 'none' || (preset === 'custom' && !text)) return { preset: 'none', text: '' };
    return { preset, text };
  }

  protected finish(): void {
    const group = this.group();
    if (group) void this.router.navigate(['/g', group.id]);
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
