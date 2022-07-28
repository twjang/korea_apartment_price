const timers: Record<string, any> = {};

const debounce = (
  eventName: string,
  callback: () => unknown,
  delay: number
) => {
  return () => {
    if (timers[eventName]) clearTimeout(timers[eventName]);
    timers[eventName] = setTimeout(() => callback(), delay);
  };
};

export default debounce;
