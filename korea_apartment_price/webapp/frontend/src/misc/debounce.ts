const timers: Record<string, number> = {};

const debounce = (
  eventName: string,
  callback: () => unknown,
  delay: number
) => {
  return () => {
    if (timers[eventName]) clearTimeout(timers[eventName]);
    timers[eventName] = setTimeout(
      () => callback(),
      delay
    ) as unknown as number;
  };
};

export default debounce;
