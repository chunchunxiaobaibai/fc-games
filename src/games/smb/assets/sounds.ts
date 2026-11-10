import { defineAssetGroup } from '@xiaobaibaifqy/jingchuanchu-app/application';
import type { Sound } from '../smb-session.ts';

export const SmbSounds = defineAssetGroup({
  name: 'smb-sounds',
  entries: {
    jump: { kind: 'audio', url: new URL('./jump.wav', import.meta.url).href },
    coin: { kind: 'audio', url: new URL('./coin.wav', import.meta.url).href },
    stomp: { kind: 'audio', url: new URL('./stomp.wav', import.meta.url).href },
    power: { kind: 'audio', url: new URL('./power.wav', import.meta.url).href },
    bump: { kind: 'audio', url: new URL('./bump.wav', import.meta.url).href },
    warp: { kind: 'audio', url: new URL('./warp.wav', import.meta.url).href },
    lose: { kind: 'audio', url: new URL('./lose.wav', import.meta.url).href },
    clear: { kind: 'audio', url: new URL('./finish/flagraise.mp3', import.meta.url).href },
    timer: { kind: 'audio', url: new URL('./finish/timertick.mp3', import.meta.url).href },
    firework: { kind: 'audio', url: new URL('./finish/cannonfire.mp3', import.meta.url).href },
    fire: { kind: 'audio', url: new URL('./fire.wav', import.meta.url).href },
  } satisfies Record<Sound, { kind: 'audio'; url: string }>,
});

export const SmbMusic = defineAssetGroup({
  name: 'smb-music',
  entries: {
    overworld: { kind: 'audio', url: new URL('./music/overworld.mp3', import.meta.url).href },
    underground: { kind: 'audio', url: new URL('./music/underground.mp3', import.meta.url).href },
    superstar: { kind: 'audio', url: new URL('./music/superstar.mp3', import.meta.url).href },
  },
});
