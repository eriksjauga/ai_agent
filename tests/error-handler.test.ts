import { describe, it, expect, vi } from 'vitest';
import { withRetry, withTimeout, ReviewError, ErrorCodes, formatError, isReviewError } from '../src/utils/error-handler';

describe('withRetry', () => {
  it('returns the result on first success without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, 3, 1);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds within the retry budget', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail once'))
      .mockResolvedValueOnce('recovered');

    const result = await withRetry(fn, 3, 1);
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws ReviewError with RETRY_EXHAUSTED after exceeding max retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));

    await expect(withRetry(fn, 2, 1)).rejects.toMatchObject({
      code: ErrorCodes.RETRY_EXHAUSTED
    });
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('withTimeout', () => {
  it('resolves when the function completes before the timeout', async () => {
    const result = await withTimeout(() => Promise.resolve('done'), 1000);
    expect(result).toBe('done');
  });

  it('rejects with ReviewError AGENT_TIMEOUT when the function is too slow', async () => {
    const slowFn = () => new Promise((resolve) => setTimeout(() => resolve('late'), 50));

    await expect(withTimeout(slowFn, 5, 'too slow')).rejects.toMatchObject({
      code: ErrorCodes.AGENT_TIMEOUT
    });
  });
});

describe('error helpers', () => {
  it('identifies ReviewError instances', () => {
    const err = new ReviewError('bad', ErrorCodes.VALIDATION_FAILED);
    expect(isReviewError(err)).toBe(true);
    expect(isReviewError(new Error('plain'))).toBe(false);
  });

  it('formats ReviewError and plain errors for logging', () => {
    const reviewErr = new ReviewError('bad thing', ErrorCodes.UNKNOWN_ERROR);
    expect(formatError(reviewErr)).toBe(`[${ErrorCodes.UNKNOWN_ERROR}] bad thing`);
    expect(formatError(new Error('plain error'))).toBe('plain error');
    expect(formatError('raw string')).toBe('raw string');
  });
});
