import { HttpClient, HttpEventType } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, filter, firstValueFrom, from, map, switchMap } from 'rxjs';
import { ImageRef, UploadPurpose, UploadSignature } from '../models';
import { api } from './api';

export const MAX_DIMENSION = 1600;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
/** Refuse absurdly large originals before even trying to decode them. */
const MAX_INPUT_BYTES = 40 * 1024 * 1024;
const QUALITY = 0.8;

export class ImageError extends Error {
  constructor(public readonly code: 'not_image' | 'too_large' | 'unreadable') {
    super(code);
  }
}

export type UploadEvent = { type: 'progress'; percent: number } | { type: 'done'; image: ImageRef };

/** Fits (w, h) into a MAX_DIMENSION box, never upscaling. */
export function fitWithin(width: number, height: number, max = MAX_DIMENSION) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

/**
 * Resizes and re-encodes an image in the browser (max 1600px, WebP or JPEG at 0.8).
 * Re-encoding through a canvas also strips EXIF metadata such as GPS location.
 */
export async function compressImage(
  file: File,
): Promise<{ blob: Blob; width: number; height: number }> {
  if (!file.type.startsWith('image/')) throw new ImageError('not_image');
  if (file.size > MAX_INPUT_BYTES) throw new ImageError('too_large');

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageError('unreadable');
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageError('unreadable');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Browsers without WebP encoding silently return PNG, so check the type and fall back to JPEG.
  let blob = await canvasToBlob(canvas, 'image/webp');
  if (!blob || blob.type !== 'image/webp') blob = await canvasToBlob(canvas, 'image/jpeg');
  if (!blob) throw new ImageError('unreadable');
  if (blob.size > MAX_UPLOAD_BYTES) throw new ImageError('too_large');
  return { blob, width, height };
}

/** Thumbnail / resized delivery URL using a Cloudinary transformation. */
export function cldUrl(url: string, opts: { w: number; h?: number; crop?: 'fill' | 'limit' }) {
  const parts = [
    `c_${opts.crop ?? 'fill'}`,
    `w_${opts.w}`,
    opts.h ? `h_${opts.h}` : '',
    'q_auto',
    'f_auto',
  ];
  return url.replace('/image/upload/', `/image/upload/${parts.filter(Boolean).join(',')}/`);
}

@Injectable({ providedIn: 'root' })
export class UploadService {
  private readonly http = inject(HttpClient);

  /** Compresses then uploads straight to Cloudinary with a server-issued signature. */
  upload(file: File, groupId: string, purpose: UploadPurpose): Observable<UploadEvent> {
    return from(
      Promise.all([
        compressImage(file),
        firstValueFrom(
          this.http.post<UploadSignature>(api('/uploads/signature'), { groupId, purpose }),
        ),
      ]),
    ).pipe(
      switchMap(([image, sig]) => {
        const form = new FormData();
        form.append('file', image.blob);
        form.append('api_key', sig.apiKey);
        form.append('timestamp', String(sig.timestamp));
        form.append('folder', sig.folder);
        form.append('allowed_formats', sig.allowed_formats);
        form.append('signature', sig.signature);
        return this.http
          .post<{ secure_url: string; public_id: string; width: number; height: number }>(
            sig.uploadUrl,
            form,
            { reportProgress: true, observe: 'events' },
          )
          .pipe(
            filter(
              (e) => e.type === HttpEventType.UploadProgress || e.type === HttpEventType.Response,
            ),
            map((e): UploadEvent => {
              if (e.type === HttpEventType.UploadProgress) {
                return {
                  type: 'progress',
                  percent: e.total ? Math.round((100 * e.loaded) / e.total) : 0,
                };
              }
              const body = (e as { body: { secure_url: string; public_id: string } }).body;
              return {
                type: 'done',
                image: {
                  url: body.secure_url,
                  publicId: body.public_id,
                  width: image.width,
                  height: image.height,
                },
              };
            }),
          );
      }),
    );
  }
}
