import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ChatMessage, ChatWho, GalleryPhoto, ImageRef } from '../models';
import { BACKGROUND } from '../interceptors';
import { api } from './api';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);

  async messages(groupId: string, who: ChatWho, after?: string): Promise<ChatMessage[]> {
    const params: Record<string, string> = after ? { after } : {};
    return (
      await firstValueFrom(
        this.http.get<{ messages: ChatMessage[] }>(api(`/groups/${groupId}/chat/${who}`), {
          params,
          // Polls (with 'after') run quietly in the background.
          context: new HttpContext().set(BACKGROUND, !!after),
        }),
      )
    ).messages;
  }

  async send(groupId: string, who: ChatWho, text: string): Promise<ChatMessage> {
    return (
      await firstValueFrom(
        this.http.post<{ message: ChatMessage }>(api(`/groups/${groupId}/chat/${who}`), { text }),
      )
    ).message;
  }
}

@Injectable({ providedIn: 'root' })
export class GalleryService {
  private readonly http = inject(HttpClient);

  list(groupId: string): Promise<{ open: boolean; photos: GalleryPhoto[] }> {
    return firstValueFrom(
      this.http.get<{ open: boolean; photos: GalleryPhoto[] }>(api(`/groups/${groupId}/gallery`)),
    );
  }

  async add(groupId: string, image: ImageRef, caption: string): Promise<GalleryPhoto> {
    return (
      await firstValueFrom(
        this.http.post<{ photo: GalleryPhoto }>(api(`/groups/${groupId}/gallery`), {
          image,
          caption,
        }),
      )
    ).photo;
  }

  async remove(groupId: string, photoId: string): Promise<void> {
    await firstValueFrom(this.http.delete(api(`/groups/${groupId}/gallery/${photoId}`)));
  }
}

export const calendarUrl = (groupId: string) => api(`/groups/${groupId}/calendar.ics`);
