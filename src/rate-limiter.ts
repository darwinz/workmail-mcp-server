export class RateLimiter {
  private timestamps: number[] = [];
  private readonly maxPerMinute: number;

  constructor(maxPerMinute: number) {
    this.maxPerMinute = maxPerMinute;
  }

  tryAcquire(): boolean {
    const now = Date.now();
    const windowStart = now - 60_000;

    // Remove entries older than 1 minute
    this.timestamps = this.timestamps.filter((t) => t > windowStart);

    if (this.timestamps.length >= this.maxPerMinute) {
      return false;
    }

    this.timestamps.push(now);
    return true;
  }

  get remaining(): number {
    const windowStart = Date.now() - 60_000;
    this.timestamps = this.timestamps.filter((t) => t > windowStart);
    return Math.max(0, this.maxPerMinute - this.timestamps.length);
  }
}
