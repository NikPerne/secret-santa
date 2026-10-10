import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Dashboard, Feasibility, Group, Match, PairView } from '../models';
import { api } from './api';

@Injectable({ providedIn: 'root' })
export class DrawService {
  private readonly http = inject(HttpClient);

  check(groupId: string): Promise<Feasibility> {
    return firstValueFrom(this.http.get<Feasibility>(api(`/groups/${groupId}/draw/check`)));
  }

  run(groupId: string): Promise<{ group: Group; avoidedPreviousPairs: boolean | null }> {
    return firstValueFrom(
      this.http.post<{ group: Group; avoidedPreviousPairs: boolean | null }>(
        api(`/groups/${groupId}/draw`),
        { confirm: true },
      ),
    );
  }

  match(groupId: string): Promise<{ match: Match; viewedAt: string | null }> {
    return firstValueFrom(
      this.http.get<{ match: Match; viewedAt: string | null }>(api(`/groups/${groupId}/match`)),
    );
  }

  markViewed(groupId: string): Promise<{ viewedAt: string }> {
    return firstValueFrom(
      this.http.post<{ viewedAt: string }>(api(`/groups/${groupId}/match/viewed`), {}),
    );
  }

  async mySanta(groupId: string): Promise<string> {
    const res = await firstValueFrom(
      this.http.get<{ santa: { name: string } }>(api(`/groups/${groupId}/my-santa`)),
    );
    return res.santa.name;
  }

  dashboard(groupId: string): Promise<Dashboard> {
    return firstValueFrom(this.http.get<Dashboard>(api(`/groups/${groupId}/dashboard`)));
  }

  async pairs(groupId: string): Promise<PairView[]> {
    return (
      await firstValueFrom(this.http.get<{ pairs: PairView[] }>(api(`/groups/${groupId}/pairs`)))
    ).pairs;
  }

  removeMember(groupId: string, userId: string): Promise<{ changedCount: number }> {
    return firstValueFrom(
      this.http.delete<{ changedCount: number }>(api(`/groups/${groupId}/members/${userId}`)),
    );
  }

  nudge(groupId: string, userId: string): Promise<{ kind: string }> {
    return firstValueFrom(
      this.http.post<{ kind: string }>(api(`/groups/${groupId}/members/${userId}/nudge`), {}),
    );
  }

  async leave(groupId: string): Promise<void> {
    await firstValueFrom(this.http.post(api(`/groups/${groupId}/leave`), {}));
  }

  async duplicate(groupId: string): Promise<Group> {
    return (
      await firstValueFrom(
        this.http.post<{ group: Group }>(api(`/groups/${groupId}/duplicate`), {}),
      )
    ).group;
  }
}
