/** Minimal RFC 5545 calendar file for the gift exchange (all-day event). */

const escapeText = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Folds lines longer than 75 octets as required by the spec. */
function fold(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  for (const ch of line) {
    if (Buffer.byteLength(current + ch, 'utf8') > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = '';
    }
    current += ch;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
const stamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

export interface IcsEvent {
  uid: string;
  title: string;
  date: Date;
  description?: string;
  location?: string;
  url?: string;
}

export function buildIcs(event: IcsEvent, now = new Date()): string {
  const end = new Date(event.date.getTime() + 24 * 60 * 60 * 1000);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Secret Santa//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART;VALUE=DATE:${ymd(event.date)}`,
    `DTEND;VALUE=DATE:${ymd(end)}`,
    `SUMMARY:${escapeText(event.title)}`,
    event.description ? `DESCRIPTION:${escapeText(event.description)}` : '',
    event.location ? `LOCATION:${escapeText(event.location)}` : '',
    event.url ? `URL:${event.url}` : '',
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(event.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lines.map(fold).join('\r\n') + '\r\n';
}
