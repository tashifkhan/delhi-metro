/** Server-Sent Events parsing for the map layout stream, kept free of app imports. */

export interface SseEvent {
  event: string;
  data: string;
}

/**
 * Incremental Server-Sent Events parser.
 *
 * Feed it text as it arrives; it returns every event completed by that chunk
 * and keeps the remainder. Follows the spec's line rules: `\n`, `\r\n` or `\r`
 * line ends, `:` comment lines, multi-line `data:` joined with `\n`, one
 * optional space after the colon, and a blank line to dispatch.
 */
export class SseParser {
  private buffer = '';
  private eventName = '';
  private dataLines: string[] = [];

  push(chunk: string): SseEvent[] {
    this.buffer += chunk;
    const events: SseEvent[] = [];
    // A trailing lone `\r` might be half of `\r\n`; wait for the next chunk.
    const lines = this.buffer.split(/\r\n|\n|\r(?!$)/);
    this.buffer = lines.pop() ?? '';
    for (const line of lines) this.line(line, events);
    return events;
  }

  /** Flush a final event the server closed without a blank line. */
  end(): SseEvent[] {
    const events: SseEvent[] = [];
    if (this.buffer) this.line(this.buffer.replace(/\r$/, ''), events);
    this.buffer = '';
    this.line('', events);
    return events;
  }

  private line(line: string, out: SseEvent[]) {
    if (line === '') {
      if (this.dataLines.length > 0) {
        out.push({ event: this.eventName || 'message', data: this.dataLines.join('\n') });
      }
      this.eventName = '';
      this.dataLines = [];
      return;
    }
    if (line.startsWith(':')) return;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') this.eventName = value;
    else if (field === 'data') this.dataLines.push(value);
  }
}
