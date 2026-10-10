import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ChatMessage, ChatWho, GalleryPhoto, ImageRef, UnreadCounts } from '../models';
import { BACKGROUND } from '../interceptors';
import { api } from './api';

export interface ThankYouNote {
  text: string;
  sentAt: string | null;
}

export interface ThankYouState {
  canSend: boolean;
  sent: ThankYouNote | null;
  received: ThankYouNote | null;
}

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

  async unread(groupId: string): Promise<UnreadCounts> {
    return (
      await firstValueFrom(
        this.http.get<{ unread: UnreadCounts }>(api(`/groups/${groupId}/chat-unread`), {
          context: new HttpContext().set(BACKGROUND, true),
        }),
      )
    ).unread;
  }

  thankYou(groupId: string): Promise<ThankYouState> {
    return firstValueFrom(this.http.get<ThankYouState>(api(`/groups/${groupId}/thank-you`)));
  }

  async sendThankYou(groupId: string, text: string): Promise<ThankYouNote> {
    return (
      await firstValueFrom(
        this.http.put<{ sent: ThankYouNote }>(api(`/groups/${groupId}/thank-you`), { text }),
      )
    ).sent;
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
