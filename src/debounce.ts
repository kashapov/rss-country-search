export function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  delay: number,
): (...args: TArgs) => void {
  let timerId: ReturnType<typeof setTimeout> | undefined;

  return (...args: TArgs) => {
    if (timerId !== undefined) {
      clearTimeout(timerId);
    }

    timerId = setTimeout(() => {
      timerId = undefined;
      fn(...args);
    }, delay);
  };
}
