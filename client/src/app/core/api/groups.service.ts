import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AppConfig,
  Exclusion,
  GiftStatus,
  Group,
  GroupDetail,
  GroupInput,
  GroupSummary,
  InvitePreview,
  MyMembership,
} from '../models';
import { api } from './api';

@Injectable({ providedIn: 'root' })
export class GroupsService {
  private readonly http = inject(HttpClient);
  private configPromise?: Promise<AppConfig>;

  config(): Promise<AppConfig> {
    this.configPromise ??= firstValueFrom(this.http.get<AppConfig>(api('/config'))).catch(
      (err: unknown) => {
        this.configPromise = undefined;
        throw err;
      },
    );
    return this.configPromise;
  }

  async list(): Promise<GroupSummary[]> {
    return (await firstValueFrom(this.http.get<{ groups: GroupSummary[] }>(api('/groups')))).groups;
  }

  async create(body: GroupInput): Promise<Group> {
    return (await firstValueFrom(this.http.post<{ group: Group }>(api('/groups'), body))).group;
  }

  get(id: string): Promise<GroupDetail> {
    return firstValueFrom(this.http.get<GroupDetail>(api(`/groups/${id}`)));
  }

  async update(id: string, body: GroupInput): Promise<Group> {
    return (await firstValueFrom(this.http.patch<{ group: Group }>(api(`/groups/${id}`), body)))
      .group;
  }

  async remove(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(api(`/groups/${id}`)));
  }

  async setExclusions(id: string, exclusions: Exclusion[]): Promise<Group> {
    return (
      await firstValueFrom(
        this.http.put<{ group: Group }>(api(`/groups/${id}/exclusions`), { exclusions }),
      )
    ).group;
  }

  async updateMe(
    id: string,
    body: { giftStatus?: GiftStatus; shippingAddress?: string },
  ): Promise<MyMembership> {
    return (
      await firstValueFrom(this.http.patch<{ me: MyMembership }>(api(`/groups/${id}/me`), body))
    ).me;
  }

  invite(code: string): Promise<{ invite: InvitePreview; instantJoin: boolean }> {
    return firstValueFrom(
      this.http.get<{ invite: InvitePreview; instantJoin: boolean }>(api(`/invites/${code}`)),
    );
  }

  join(code: string): Promise<{ groupId: string; joined: boolean }> {
    return firstValueFrom(
      this.http.post<{ groupId: string; joined: boolean }>(api(`/invites/${code}/join`), {}),
    );
  }
}
