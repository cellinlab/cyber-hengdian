export const pad = (v: number) => String(v).padStart(2, '0');
export const clock = (t: number, fps: string) =>
  `${pad(Math.floor(t / 60))}:${pad(Math.floor(t) % 60)}:${pad(Math.floor((t % 1) * Number(fps)))}`;
