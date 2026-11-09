// Each character is one logical pixel. Dots are transparent.
export const palette: Readonly<Record<string, string>> = {
  k: '#302a32', r: '#b93227', R: '#eb5940', s: '#ffd295', S: '#e9955e',
  b: '#275177', B: '#4785a0', y: '#ffd061', w: '#fff8db', W: '#eddfad',
  d: '#8c4b39', D: '#cd8054', g: '#28724e', l: '#7bbb60', L: '#b5db7b',
};

export const firePalette: Readonly<Record<string, string>> = {
  ...palette, r: '#e1c99b', R: '#fff8db', b: '#a42f26', B: '#ed5740',
};

const smallHead = [
  '...kkkkkk.....',
  '..kRRRRRrk....',
  '.kRRwRRrrkk...',
  '.krrrrrrrrrk..',
  '..kksksk......',
  '..kssksSsk....',
  '..kSsskkkk....',
  '...ksssssk....',
];

const bigHead = [
  '...kkkkkk.....',
  '..kRRRRRrk....',
  '.kRRwRRRrrk...',
  '.kRRwRRrrrkk..',
  '.krrrrrrrrrrk.',
  '..kksskssk....',
  '..ksssksssk...',
  '..ksSsssssSk..',
  '..kssSkkkkk...',
  '...ksssssk....',
  '....kkkkk.....',
];

const fireHead = [
  '...kkkkkk.....',
  '..kRRRRRrk....',
  '.kRRBRRRrrk...',
  '.kRBBBRrrrkk..',
  '.krrrrrrrrrrk.',
  ...bigHead.slice(5),
];

const tallStand = [
  '...kRBBRrk....',
  '..kRRBBRrrk...',
  '..krrBByrrk...',
  '..krrBBbrrk...',
  '..kwwBBbwwk...',
  '..kWwBBbwWk...',
  '...kkBBbbk....',
  '....kBbbk.....',
  '...kBBbBbk....',
  '...kBbkBbk....',
  '...kBbkbbk....',
  '...kBbkbbk....',
  '...kdk.kdk....',
  '..kdkk.kdkk...',
  '..kkkk.kkkk...',
];

const tallStride = [
  '...kRBBRrk....',
  '..kRRBBRrrk...',
  '..krrBByRrwk..',
  '.krrrBBbrrwwk.',
  '.kwwkBBbbbkk..',
  '..kk.BBbbk....',
  '....kBBbbk....',
  '....kBBbbk....',
  '...kBBbBBbk...',
  '..kBBbk.Bbbk..',
  '..kBbk...kbbk.',
  '.kddk....kbbk.',
  'kddk......kdk.',
  'kkk.......kddk',
  '..........kkkk',
];

const tallPass = [
  '...kRBBRrk....',
  '...kRBBRrrk...',
  '...krBByrrk...',
  '...krBBbwWk...',
  '...krBBbkk....',
  '...kwwBbbk....',
  '....kkBbbk....',
  '....kBBbbk....',
  '....kBBbbk....',
  '....kBBbbk....',
  '...kBBkbk.....',
  '...kBbk.kdk...',
  '....kdk.kddk..',
  '....kdkk.kkk..',
  '....kkkk......',
];

const tallPush = [
  '...kRBBRrk....',
  '..kRRBBRRrk...',
  '.kRrrBBBRRrk..',
  '.kwkkBBykwwk..',
  '..kk.BBbwWk...',
  '....kBBbkk....',
  '....kBBbbk....',
  '....kBBbbk....',
  '....kBBbBbk...',
  '....kBBkBbbk..',
  '...kBbk.kBbk..',
  '..kBbk..kdk...',
  '..kdk...kddk..',
  '.kdkk...kkkk..',
  '.kkkk.........',
];

const tallJump = [
  '..wkRBBRrkwWk.',
  '.kwwRBBRRRwwk.',
  '..kkRBBBRRrk..',
  '...krBByrrk...',
  '...krBBbkk....',
  '....kBBbbk....',
  '....kBBbbk....',
  '....kBBbbk....',
  '...kBBbBBbk...',
  '..kBbbkBBbbk..',
  '.kBbk..kBBdk..',
  '.kdk....kkkk..',
  'kddk..........',
  'kdk...........',
  'kkk...........',
];

export const mario = {
  small: {
    stand: [...smallHead,
      '..kRBBRrk.....',
      '.kwwBBywwk....',
      '..kkBBbkk.....',
      '...kBBbbk.....',
      '...kBkBbk.....',
      '..kdkkkdk.....',
      '..kkkkkkkk....',
    ],
    run: [
      [...smallHead,
        '..kRBBRrwk....',
        '.kwwBByrrwk...',
        '..kkBBbbkk....',
        '...kBBbbk.....',
        '..kBBkkBbk....',
        '.kddk..kddk...',
        'kkkk....kkkk..',
      ],
      [...smallHead,
        '...kRBBRrk....',
        '..krBBywwk....',
        '..krBBbkk.....',
        '...kBBbbk.....',
        '....kBkBbk....',
        '....kdk.kdk...',
        '....kkkk.kk...',
      ],
      [...smallHead,
        '..kRBBRRrk....',
        '..kwBBywwk....',
        '...kBBbkk.....',
        '...kBBbbk.....',
        '...kBkkBbk....',
        '..kddk.kddk...',
        '..kkkk.kkkk...',
      ],
    ],
    jump: [...smallHead,
      '.kwkBBRrkwWk..',
      '.kwwBByRrwwk..',
      '..kkBBbbkk....',
      '...kBBbBBk....',
      '..kBbkkBbdk...',
      '.kddk..kkkk...',
      '.kkk..........',
    ],
  },
  big: {
    stand: [...bigHead, ...tallStand],
    run: [[...bigHead, ...tallStride], [...bigHead, ...tallPass], [...bigHead, ...tallPush]],
    jump: [...bigHead, ...tallJump],
  },
  fire: {
    stand: [...fireHead, ...tallStand],
    run: [[...fireHead, ...tallStride], [...fireHead, ...tallPass], [...fireHead, ...tallPush]],
    jump: [...fireHead, ...tallJump],
  },
} as const;

// Hands tuck in during a change. The renderer keeps the feet pinned to the interpolated baseline.
export const marioChange = [
  ...bigHead,
  '...kRBBRrk....',
  '..kwwBBywwk...',
  '..kWwBBbwWk...',
  '...kkBBbkk....',
  '....kBBbk.....',
  '...kBBbBbk....',
  '...kBbkbbk....',
  '..kddk.kddk...',
  '..kkkk.kkkk...',
] as const;

const goombaHead = [
  '....kkkkkk....',
  '...kDDDDddk...',
  '..kDDDDDDddk..',
  '.kDDDDDDDDddk.',
  'kDDkDDDDkDDddk',
  'kDwwkkkwwDDddk',
  'kDwkDDDkwDDddk',
  'kDwwDDDwwDdddk',
  '.kkkkkkkkkkkk.',
  '...kssssSsk...',
  '..kssssSSssk..',
];

const koopaBody = [
  '........kkk...',
  '.......ksssk..',
  '......kswksSk.',
  '......kssksSsk',
  '.......kssssSk',
  '.......kSkkk..',
  '...kkkkkSk....',
  '..klLlgkSk....',
  '.klLLglgksk...',
  '.kllggllkssk..',
  'klggLllgkSsk..',
  'kglgllggkSsk..',
  'kggggggkSSsk..',
  '.kwwwwwWSSk...',
  '..kkkkkkkk....',
  '...kssssSk....',
];

export const enemies = {
  goomba: [
    [...goombaHead, '.kddkSSkddk...', 'kdddk..kdddk..', 'kkkk....kkkk..'],
    [...goombaHead, '..kddkSSkddk..', '..kdddk..kdddk', '..kkkk....kkkk'],
  ],
  koopa: [
    [...koopaBody, '..kssk.kssk...', '.kssSk.kssSk..', '.kkkk..kkkk...'],
    [...koopaBody, '....ksskSsk...', '...kssSk.kssk.', '...kkkk..kkkk.'],
  ],
  shell: [
    [
      '...kkkkkkkk...',
      '..klLLLLlggk..',
      '..klLLllgggk..',
      '.klLLglglgggk.',
      'klLLglllglgggk',
      'klLglLLlglgggk',
      'kllglLLlgggggk',
      'kggggggggggggk',
      'kwwwwwwwwwwwWk',
      'kWWWWWWWWWWWWk',
      '.kggkkkkgggkk.',
      '.kkkkkkkkkkkk.',
    ],
    [
      '...kkkkkkkk...',
      '..kglLLLLlgk..',
      '..kglLLllggk..',
      '.kglLLglglggk.',
      'kgglLglllglggk',
      'kglglLLlglgggk',
      'kgglglLLlggggk',
      'kggggggggggggk',
      'kwwwwwwwwwwwWk',
      'kWWWWWWWWWWWWk',
      '.kkgggkkkkggk.',
      '.kkkkkkkkkkkk.',
    ],
  ],
} as const;

export const pickups = {
  mushroom: [
    '....kkkkkk....', '...kRRRRrrk...', '..kRwwRRwwrk..', '.kRwwwRwwwrrk.',
    '.kRRRRRRrrrrk.', 'kRRwwRRwwrrrrk', 'kRRwwrrwwrrrrk', 'kkkkkkkkkkkkkk',
    '..kwssssssk...', '..kwssssssk...', '..kwskskSsk...', '..kssssSSsk...',
    '..ksssSSSsk...', '...kkkkkkk....',
  ],
  flower: [
    '...kkkkkkkk...', '..kRRRRRRrrk..', '.kRRyyyyyRrrk.', '.kRywwwyyRrrk.',
    '.kRRyyyyyrrrk.', '..krrrrrrrrk..', '...kkkkkkkk...', '......kgk.....',
    '..kk..kgk.kk..', '.kLlk.kgkklgk.', '..kLlkklklgk..', '...kllklggk...',
    '....kllllk....', '.....kkkk.....',
  ],
} as const;
