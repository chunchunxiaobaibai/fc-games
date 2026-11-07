// Original pixel drawings. A dot is transparent and each other character indexes the palette.
export const pixels = {
  player: [
    '...rrrrr....', '..rrrrrrrr..', '..kksks.....', '.ksksssks...',
    '.ksssksss...', '..kssssss...', '...ssss.....', '..rrbr.....s',
    '.rrrbbrr..ss', 'srrbbbyrrss.', 'ss.bbbbbrr..', '...bbbbbb...',
    '..bbb.bbb...', '..kk...kk...', '.kkk...kkk..',
  ],
  goomba: [
    '....dddd....', '...dddddd...', '..dddddddd..', '.dddddddddd.',
    'ddkddddkdddd', 'ddwkkkkwdddd', 'ddwkdkwddddd', 'ddwwdwwddddd',
    '.dddddddddd.', '...ssssss...', '..ssssssss..', '.kksssssskk.',
    'kkkk....kkkk', 'kkk......kkk',
  ],
  koopa: [
    '.......ssss.', '......sswks.', '......sssss.', '.......ssss.',
    '........ss..', '....gg..ss..', '...ggggss...', '..ggllggs...',
    '.ggllllggs..', '.ggllllggs..', 'gggllllggss.', 'gggggggggss.',
    '.wwwwwwwsss.', '...ss.sss...', '..sss..sss..', '..kk....kk..',
  ],
  shell: [
    '....gggg....', '..ggllllgg..', '.ggllllllgg.', 'gggllllllggg',
    'gggllllllggg', 'gggggggggggg', 'wwwwwwwwwwww', '.kkkkkkkkkk.',
  ],
  mushroom: [
    '....rrrr....', '..rrrrrrrr..', '.rrwwrrwwrr.', 'rrwwwwwwwwrr',
    'rrwwwwwwwwrr', 'rrrrrrrrrrrr', '.rrrrrrrrrr.', '..ssssssss..',
    '..ssksskss..', '..ssssssss..', '...ssssss...',
  ],
  flower: [
    '...rrrrrr...', '..rryyyyrr..', '.rryywwyyrr.', '.rrywwwwyrr.',
    '..rryyyyrr..', '...rrrrrr...', '.....gg.....', '.gg..gg..gg.',
    '..gg.gg.gg..', '...gggggg...',
  ],
} as const;

export const palette: Record<string, string> = {
  r: '#c1392b', k: '#432830', s: '#ffd494', b: '#29468b', y: '#ffcb59',
  d: '#a85b42', w: '#fff4db', g: '#267c52', l: '#8bc759',
};
