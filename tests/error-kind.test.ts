import { describe, expect, it } from 'vitest';
import { HttpError } from '../src/http-error';
import { classifySearchError } from '../src/error-kind';

describe('classifySearchError', () => {
  it('treats AbortError as a silent cancellation', () => {
    const error = new DOMException('Aborted', 'AbortError');

    expect(classifySearchError(error)).toEqual({
      kind: 'aborted',
      message: null,
    });
  });

  it('treats TimeoutError as a user-visible timeout error', () => {
    const error = new DOMException('Timeout', 'TimeoutError');

    expect(classifySearchError(error)).toEqual({
      kind: 'timeout',
      message: 'Request timed out. Please try again.',
    });
  });

  it('treats HttpError as a user-visible http error', () => {
    const error = new HttpError('Request failed with status 500', 500);

    expect(classifySearchError(error)).toEqual({
      kind: 'http',
      message: 'Request failed with status 500',
      status: 500,
    });
  });

  it('treats network failures as a user-visible network error', () => {
    const error = new TypeError('Failed to fetch');

    expect(classifySearchError(error)).toEqual({
      kind: 'network',
      message: 'Network error. Please check your connection and try again.',
    });
  });

  it('falls back to a generic user-visible error for unknown failures', () => {
    expect(classifySearchError(new Error('boom'))).toEqual({
      kind: 'unknown',
      message: 'Something went wrong. Please try again.',
    });
  });
});
