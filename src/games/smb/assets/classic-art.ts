const urls = {
  player: new URL('./classic/player.svg', import.meta.url).href,
  enemy: new URL('./classic/enemy.svg', import.meta.url).href,
  blocks: new URL('./classic/blocks.svg', import.meta.url).href,
  background: new URL('./classic/world-1-1-background.svg', import.meta.url).href,
} as const;

export const classicLogo = new URL('./classic/logo.svg', import.meta.url).href;
export const hudCoin = new URL('./classic/hud-coin.svg', import.meta.url).href;

export type ClassicArt = Record<keyof typeof urls, HTMLImageElement>;

let cached: Promise<ClassicArt> | undefined;

export function loadClassicArt() {
  cached ??= Promise.all(Object.entries(urls).map(async ([key, url]) => {
    const image = new Image();
    image.src = url;
    await image.decode();
    return [key, image] as const;
  })).then((entries) => Object.fromEntries(entries) as ClassicArt).catch((error: unknown) => {
    cached = undefined;
    throw error;
  });
  return cached;
}
