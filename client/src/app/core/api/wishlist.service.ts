import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LinkPreview, Preferences, WishlistItem, WishlistItemInput } from '../models';
import { api } from './api';

@Injectable({ providedIn: 'root' })
export class WishlistService {
  private readonly http = inject(HttpClient);

  async list(groupId: string): Promise<WishlistItem[]> {
    return (
      await firstValueFrom(
        this.http.get<{ items: WishlistItem[] }>(api(`/groups/${groupId}/wishlist`)),
      )
    ).items;
  }

  async create(groupId: string, body: WishlistItemInput): Promise<WishlistItem> {
    return (
      await firstValueFrom(
        this.http.post<{ item: WishlistItem }>(api(`/groups/${groupId}/wishlist`), body),
      )
    ).item;
  }

  async update(
    groupId: string,
    itemId: string,
    body: Partial<WishlistItemInput>,
  ): Promise<WishlistItem> {
    return (
      await firstValueFrom(
        this.http.patch<{ item: WishlistItem }>(api(`/groups/${groupId}/wishlist/${itemId}`), body),
      )
    ).item;
  }

  async remove(groupId: string, itemId: string): Promise<void> {
    await firstValueFrom(this.http.delete(api(`/groups/${groupId}/wishlist/${itemId}`)));
  }

  async reorder(groupId: string, ids: string[]): Promise<WishlistItem[]> {
    return (
      await firstValueFrom(
        this.http.put<{ items: WishlistItem[] }>(api(`/groups/${groupId}/wishlist/order`), {
          ids,
        }),
      )
    ).items;
  }

  async preferences(groupId: string): Promise<Preferences> {
    return (
      await firstValueFrom(
        this.http.get<{ preferences: Preferences }>(api(`/groups/${groupId}/preferences`)),
      )
    ).preferences;
  }

  async savePreferences(groupId: string, body: Preferences): Promise<Preferences> {
    return (
      await firstValueFrom(
        this.http.put<{ preferences: Preferences }>(api(`/groups/${groupId}/preferences`), body),
      )
    ).preferences;
  }

  async linkPreview(groupId: string, url: string): Promise<LinkPreview> {
    return (
      await firstValueFrom(
        this.http.post<{ preview: LinkPreview }>(api(`/groups/${groupId}/link-preview`), { url }),
      )
    ).preview;
  }

  matchWishlist(groupId: string): Promise<{ items: WishlistItem[]; preferences: Preferences }> {
    return firstValueFrom(
      this.http.get<{ items: WishlistItem[]; preferences: Preferences }>(
        api(`/groups/${groupId}/match/wishlist`),
      ),
    );
  }
}
