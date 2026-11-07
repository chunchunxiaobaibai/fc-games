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
    clear: { kind: 'audio', url: new URL('./clear.wav', import.meta.url).href },
    fire: { kind: 'audio', url: new URL('./fire.wav', import.meta.url).href },
  } satisfies Record<Sound, { kind: 'audio'; url: string }>,
});
