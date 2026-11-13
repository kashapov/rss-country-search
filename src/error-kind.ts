import { HttpError } from './http-error.js';

export type SearchErrorClassification =
  | { kind: 'aborted'; message: null }
  | { kind: 'timeout'; message: string }
  | { kind: 'http'; message: string; status: number }
  | { kind: 'network'; message: string }
  | { kind: 'unknown'; message: string };

function isDomException(error: unknown): error is DOMException {
  return typeof DOMException !== 'undefined' && error instanceof DOMException;
}

export function classifySearchError(error: unknown): SearchErrorClassification {
  if (isDomException(error) && error.name === 'AbortError') {
    return { kind: 'aborted', message: null };
  }

  if (isDomException(error) && error.name === 'TimeoutError') {
    return {
      kind: 'timeout',
      message: 'Request timed out. Please try again.',
    };
  }

  if (error instanceof HttpError) {
    return {
      kind: 'http',
      message: error.message,
      status: error.status,
    };
  }

  if (error instanceof TypeError) {
    return {
      kind: 'network',
      message: 'Network error. Please check your connection and try again.',
    };
  }

  return {
    kind: 'unknown',
    message: 'Something went wrong. Please try again.',
  };
}
