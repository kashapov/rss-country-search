import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce } from '../src/debounce';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not call the function before the delay elapses', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced('spain');
    vi.advanceTimersByTime(299);

    expect(fn).not.toHaveBeenCalled();
  });

  it('calls the function once after the delay', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced('spain');
    vi.advanceTimersByTime(300);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('spain');
  });

  it('resets the timer when called again within the delay', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced('sp');
    vi.advanceTimersByTime(200);
    debounced('spa');
    vi.advanceTimersByTime(200);
    debounced('spain');
    vi.advanceTimersByTime(299);

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('spain');
  });

  it('forwards all arguments from the last call', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('a', 1);
    debounced('b', 2, true);
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('b', 2, true);
  });
});
