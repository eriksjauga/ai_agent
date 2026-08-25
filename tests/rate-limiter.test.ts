import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from '../src/utils/rate-limiter';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests within limits to proceed immediately', async () => {
    const limiter = new RateLimiter({ maxRequestsPerMinute: 5, maxTokensPerMinute: 10000, maxConcurrent: 2 });
    expect(limiter.canProceed(1000)).toBe(true);
    await limiter.acquire(1000);
    expect(limiter.getStatus().activeRequests).toBe(1);
  });

  it('blocks concurrent requests beyond maxConcurrent until release', async () => {
    const limiter = new RateLimiter({ maxRequestsPerMinute: 50, maxTokensPerMinute: 100000, maxConcurrent: 1 });
    await limiter.acquire(500);

    let secondAcquired = false;
    const secondAcquire = limiter.acquire(500).then(() => {
      secondAcquired = true;
    });

    await Promise.resolve();
    expect(secondAcquired).toBe(false);

    limiter.release();
    await secondAcquire;
    expect(secondAcquired).toBe(true);
  });

  it('rejects proceeding once token budget for the window is exhausted', () => {
    const limiter = new RateLimiter({ maxRequestsPerMinute: 50, maxTokensPerMinute: 1000, maxConcurrent: 5 });
    expect(limiter.canProceed(1000)).toBe(true);
    expect(limiter.canProceed(1001)).toBe(false);
  });

  it('prunes stale records outside the 60s sliding window', async () => {
    const limiter = new RateLimiter({ maxRequestsPerMinute: 1, maxTokensPerMinute: 100000, maxConcurrent: 5 });
    await limiter.acquire(100);
    limiter.release();

    expect(limiter.canProceed(100)).toBe(false);

    vi.advanceTimersByTime(61_000);
    expect(limiter.canProceed(100)).toBe(true);
  });
});
