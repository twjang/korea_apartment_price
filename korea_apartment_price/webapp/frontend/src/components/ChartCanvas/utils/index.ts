export const makeArrayFromNumber = (x: number, coeff?: number): number[] => {
  const v = [];
  for (let i = 0; i < 4; i++) {
    if (coeff) v.push((x % 256) * coeff);
    else v.push(x % 256);
    x = Math.floor(x / 256);
  }
  return v.reverse();
};
