// Workout program templates (zero axial lumbar load, 100% machines & cables).
// Includes the default 4-day Upper/Lower program and 4 classic alternate templates.
// name/shortName/tagline/description/routine names are English source strings — translate
// at render/instantiation time with t(), never bake a translation in here (see i18n.js).
import { uid } from './format.js'
import { t } from './i18n.js'

export const TEMPLATES = [
  {
    id: 'upper-lower',
    name: 'Upper / Lower (4 days)',
    shortName: 'Upper / Lower',
    tagline: 'Default · 4 days · Freq 2×',
    description: 'Maximum hypertrophy with 100% machines and cables (zero axial lumbar load). 2× frequency per muscle group.',
    emoji: 'barbell',
    daysCount: 4,
    freq: '2×',
    isDefault: true,
    week: { 1: 0, 2: 1, 4: 2, 5: 3 },
    routines: [
      [
        'Upper A (Push)',
        'barbell',
        [
          ['0577', 3, 8, { repsMin: 8, repsMax: 10, restSec: 150 }],  // Press pecho horizontal máquina convergente (2.5 min)
          ['2330', 3, 8, { repsMin: 8, repsMax: 12, restSec: 120 }],  // Jalón al pecho agarre prono polea (2 min)
          ['0603', 3, 8, { repsMin: 8, repsMax: 10, restSec: 150 }],  // Press de hombro sentado máquina (2.5 min)
          ['1350', 3, 10, { repsMin: 10, repsMax: 12, restSec: 120 }], // Remo en máquina con apoyo al pecho (2 min)
          ['0178', 3, 12, { repsMin: 12, repsMax: 15, restSec: 90 }],  // Elevaciones laterales en polea (1.5 min)
          ['0194', 3, 10, { repsMin: 10, repsMax: 12, restSec: 90 }],  // Extensión tríceps overhead cuerda (1.5 min)
          ['0868', 3, 10, { repsMin: 10, repsMax: 12, restSec: 90 }],  // Curl bíceps en polea (barra recta) (1.5 min)
          ['0210', 2, 12, { repsMin: 12, repsMax: 15, restSec: 60 }],  // Antebrazo: extensores en polea (1 min)
        ]
      ],
      [
        'Lower A (Quads)',
        'legs',
        [
          ['0739', 4, 8, { repsMin: 8, repsMax: 10, restSec: 180 }],  // Prensa piernas inclinada 45° (3 min)
          ['1425', 3, 10, { repsMin: 10, repsMax: 12, restSec: 120, side: true }], // Prensa unilateral (2 min)
          ['0585', 3, 12, { repsMin: 12, repsMax: 15, restSec: 120 }], // Extensión cuádriceps (2 min)
          ['0599', 3, 10, { repsMin: 10, repsMax: 12, restSec: 120 }], // Curl femoral sentado (2 min)
          ['0605', 4, 10, { repsMin: 10, repsMax: 12, restSec: 90 }],  // Elevación talones de pie (1.5 min)
          ['0598', 3, 12, { repsMin: 12, repsMax: 15, restSec: 90 }],  // Aductores en máquina (1.5 min)
          ['0212', 3, 12, { repsMin: 12, repsMax: 15, restSec: 60 }],  // Crunch en polea alta (1 min)
          ['0247', 2, 12, { repsMin: 12, repsMax: 15, restSec: 60 }],  // Antebrazo: flexores en polea (1 min)
        ]
      ],
      [
        'Upper B (Pull)',
        'pullup',
        [
          ['0861', 3, 10, { repsMin: 10, repsMax: 12, restSec: 120, side: true }], // Remo unilateral polea baja (2 min)
          ['0818', 3, 10, { repsMin: 10, repsMax: 12, restSec: 120 }], // Jalón agarre neutro / divergente (2 min)
          ['1299', 3, 8, { repsMin: 8, repsMax: 10, restSec: 150 }],  // Press pecho inclinado en máquina (2.5 min)
          ['0596', 3, 10, { repsMin: 10, repsMax: 12, restSec: 90 }],  // Pec deck (1.5 min)
          ['0602', 3, 12, { repsMin: 12, repsMax: 15, restSec: 90 }],  // Rear delt fly (1.5 min)
          ['0178', 3, 12, { repsMin: 12, repsMax: 15, restSec: 90 }],  // Elevaciones laterales en polea (1.5 min)
          ['1636', 3, 10, { repsMin: 10, repsMax: 12, restSec: 90 }],  // Curl Bayesian en polea (1.5 min)
          ['0194', 3, 10, { repsMin: 10, repsMax: 12, restSec: 90 }],  // Extensión tríceps overhead cuerda (1.5 min)
          ['0210', 2, 12, { repsMin: 12, repsMax: 15, restSec: 60 }],  // Antebrazo: extensores en polea (1 min)
        ]
      ],
      [
        'Lower B (Hamstrings)',
        'legs',
        [
          ['0599', 4, 8, { repsMin: 8, repsMax: 10, restSec: 120 }],   // Curl femoral sentado (2 min)
          ['0739', 3, 10, { repsMin: 10, repsMax: 12, restSec: 180 }], // Prensa piernas (pies altos) (3 min)
          ['1425', 3, 10, { repsMin: 10, repsMax: 12, restSec: 120, side: true }], // Prensa unilateral (2 min)
          ['0585', 3, 10, { repsMin: 10, repsMax: 12, restSec: 120 }], // Extensión cuádriceps (2 min)
          ['0738', 4, 12, { repsMin: 12, repsMax: 15, restSec: 90 }],  // Elevación talones en prensa (1.5 min)
          ['0598', 2, 12, { repsMin: 12, repsMax: 15, restSec: 90 }],  // Aductores en máquina (1.5 min)
          ['0212', 3, 12, { repsMin: 12, repsMax: 15, restSec: 60 }],  // Crunch en polea alta (1 min)
          ['0464', 3, 45, { mode: 'time', sec: 45, restSec: 60 }],     // Plancha activa (1 min)
          ['0247', 2, 12, { repsMin: 12, repsMax: 15, restSec: 60 }],  // Antebrazo: flexores en polea (1 min)
        ]
      ]
    ]
  },
  {
    id: 'ppl',
    name: 'Push / Pull / Legs (PPL - 6 days)',
    shortName: 'Push / Pull / Legs',
    tagline: '6 days · Freq 2× · High volume',
    description: 'Push, pull and legs split trained 2× per week. Designed 100% around machines and cables.',
    emoji: 'figureStrength',
    daysCount: 6,
    freq: '2×',
    week: { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 },
    routines: [
      [
        'Push A',
        'barbell',
        [
          ['0577', 3, 6, { repsMin: 6, repsMax: 8, restSec: 150 }],  // Press pecho horizontal máquina convergente (2.5 min)
          ['0603', 3, 8, { repsMin: 8, repsMax: 10, restSec: 150 }], // Press hombro sentado máquina (2.5 min)
          ['1299', 3, 8, { repsMin: 8, repsMax: 10, restSec: 120 }], // Press pecho inclinado en máquina (2 min)
          ['0178', 4, 12, { repsMin: 12, repsMax: 15, restSec: 90 }], // Elevaciones laterales en polea (1.5 min)
          ['0596', 3, 8, { repsMin: 8, repsMax: 10, restSec: 120 }],  // Pec deck / aperturas (2 min)
          ['0194', 3, 10, { repsMin: 10, repsMax: 12, restSec: 90 }], // Extensión tríceps cuerda (1.5 min)
        ]
      ],
      [
        'Pull A',
        'pullup',
        [
          ['2330', 3, 8, { repsMin: 8, repsMax: 10, restSec: 150 }],  // Jalón al pecho agarre prono (2.5 min)
          ['1350', 3, 8, { repsMin: 8, repsMax: 10, restSec: 120 }],  // Remo máquina con apoyo al pecho (2 min)
          ['0861', 3, 10, { repsMin: 10, repsMax: 12, restSec: 120, side: true }], // Remo unilateral polea (2 min)
          ['0602', 3, 12, { repsMin: 12, repsMax: 15, restSec: 90 }], // Rear delt fly (1.5 min)
          ['0868', 3, 8, { repsMin: 8, repsMax: 10, restSec: 90 }],   // Curl bíceps en polea (1.5 min)
          ['0165', 3, 10, { repsMin: 10, repsMax: 12, restSec: 90 }], // Curl martillo polea cuerda (1.5 min)
        ]
      ],
      [
        'Legs A',
        'legs',
        [
          ['0739', 3, 6, { repsMin: 6, repsMax: 8, restSec: 180 }],   // Prensa piernas 45° (3 min)
          ['1425', 3, 8, { repsMin: 8, repsMax: 10, restSec: 120, side: true }], // Prensa unilateral (2 min)
          ['0599', 3, 10, { repsMin: 10, repsMax: 12, restSec: 120 }], // Curl femoral sentado (2 min)
          ['0585', 3, 10, { repsMin: 10, repsMax: 12, restSec: 90 }],  // Extensión cuádriceps (1.5 min)
          ['0605', 4, 12, { repsMin: 12, repsMax: 15, restSec: 90 }],  // Elevación talones de pie (1.5 min)
          ['0212', 3, 12, { repsMin: 12, repsMax: 15, restSec: 60 }],  // Crunch en polea alta (1 min)
        ]
      ],
      [
        'Push B',
        'barbell',
        [
          ['1299', 3, 6, { repsMin: 6, repsMax: 8, restSec: 150 }],  // Press pecho inclinado en máquina (2.5 min)
          ['0603', 3, 8, { repsMin: 8, repsMax: 10, restSec: 150 }], // Press hombro sentado máquina (2.5 min)
          ['0596', 3, 10, { repsMin: 10, repsMax: 12, restSec: 90 }], // Pec deck (1.5 min)
          ['0178', 4, 12, { repsMin: 12, repsMax: 15, restSec: 90 }], // Elevaciones laterales en polea (1.5 min)
          ['0194', 3, 10, { repsMin: 10, repsMax: 12, restSec: 90 }], // Extensión tríceps overhead polea (1.5 min)
          ['0201', 3, 10, { repsMin: 10, repsMax: 12, restSec: 90 }], // Pushdown tríceps (1.5 min)
        ]
      ],
      [
        'Pull B',
        'pullup',
        [
          ['0818', 3, 6, { repsMin: 6, repsMax: 8, restSec: 150 }],   // Jalón agarre neutro (2.5 min)
          ['0861', 3, 8, { repsMin: 8, repsMax: 10, restSec: 120, side: true }], // Remo unilateral polea (2 min)
          ['1350', 3, 10, { repsMin: 10, repsMax: 12, restSec: 120 }], // Remo máquina apoyo pecho (2 min)
          ['0602', 3, 12, { repsMin: 12, repsMax: 15, restSec: 90 }], // Rear delt fly (1.5 min)
          ['1636', 3, 8, { repsMin: 8, repsMax: 10, restSec: 90 }],   // Curl Bayesian en polea (1.5 min)
          ['1633', 3, 10, { repsMin: 10, repsMax: 12, restSec: 90 }], // Curl predicador unilateral (1.5 min)
        ]
      ],
      [
        'Legs B',
        'legs',
        [
          ['0599', 3, 6, { repsMin: 6, repsMax: 8, restSec: 120 }],   // Curl femoral sentado (2 min)
          ['0739', 3, 8, { repsMin: 8, repsMax: 10, restSec: 180 }],  // Prensa piernas (pies altos) (3 min)
          ['1425', 3, 10, { repsMin: 10, repsMax: 12, restSec: 120, side: true }], // Prensa unilateral (2 min)
          ['0585', 3, 12, { repsMin: 12, repsMax: 15, restSec: 120 }], // Extensión cuádriceps (2 min)
          ['0605', 4, 12, { repsMin: 12, repsMax: 15, restSec: 90 }],  // Elevación talones de pie (1.5 min)
          ['0212', 3, 12, { repsMin: 12, repsMax: 15, restSec: 60 }],  // Crunch en polea (1 min)
        ]
      ]
    ]
  },
  {
    id: 'full-body',
    name: 'Full Body (3 days)',
    shortName: 'Full Body',
    tagline: '3 days · Freq 3× · High efficiency',
    description: 'Full body across 3 alternating sessions (Monday, Wednesday, Friday). Ideal for busy schedules.',
    emoji: 'bolt',
    daysCount: 3,
    freq: '3×',
    week: { 1: 0, 3: 1, 5: 2 },
    routines: [
      [
        'Full Body A',
        'barbell',
        [
          ['0739', 3, 6, { repsMin: 6, repsMax: 8, restSec: 180 }],   // Prensa piernas 45° (3 min)
          ['0577', 3, 6, { repsMin: 6, repsMax: 8, restSec: 150 }],   // Press pecho horizontal máquina (2.5 min)
          ['1350', 3, 8, { repsMin: 8, repsMax: 10, restSec: 120 }],  // Remo máquina con apoyo (2 min)
          ['0603', 3, 8, { repsMin: 8, repsMax: 10, restSec: 120 }],  // Press hombro sentado máquina (2 min)
          ['0599', 3, 10, { repsMin: 10, repsMax: 12, restSec: 90 }], // Curl femoral sentado (1.5 min)
          ['0194', 3, 10, { repsMin: 10, repsMax: 12, restSec: 90 }], // Extensión tríceps overhead cuerda (1.5 min)
        ]
      ],
      [
        'Full Body B',
        'pullup',
        [
          ['0739', 3, 8, { repsMin: 8, repsMax: 10, restSec: 180 }],  // Prensa piernas (pies altos) (3 min)
          ['1299', 3, 8, { repsMin: 8, repsMax: 10, restSec: 150 }],  // Press pecho inclinado máquina (2.5 min)
          ['2330', 3, 8, { repsMin: 8, repsMax: 10, restSec: 120 }],  // Jalón al pecho agarre prono (2 min)
          ['0585', 3, 10, { repsMin: 10, repsMax: 12, restSec: 120 }], // Extensión cuádriceps (2 min)
          ['0178', 3, 12, { repsMin: 12, repsMax: 15, restSec: 90 }], // Elevaciones laterales en polea (1.5 min)
          ['1636', 3, 10, { repsMin: 10, repsMax: 12, restSec: 90 }], // Curl Bayesian en polea (1.5 min)
        ]
      ],
      [
        'Full Body C',
        'legs',
        [
          ['1425', 3, 8, { repsMin: 8, repsMax: 10, restSec: 120, side: true }], // Prensa unilateral (2 min)
          ['0596', 3, 8, { repsMin: 8, repsMax: 10, restSec: 120 }],  // Pec deck (2 min)
          ['0861', 3, 10, { repsMin: 10, repsMax: 12, restSec: 120, side: true }], // Remo unilateral polea (2 min)
          ['0585', 3, 12, { repsMin: 12, repsMax: 15, restSec: 90 }], // Extensión cuádriceps (1.5 min)
          ['0605', 4, 10, { repsMin: 10, repsMax: 12, restSec: 90 }], // Elevación talones de pie (1.5 min)
          ['0602', 3, 12, { repsMin: 12, repsMax: 15, restSec: 90 }], // Rear delt fly (1.5 min)
          ['0212', 3, 12, { repsMin: 12, repsMax: 15, restSec: 60 }], // Crunch en polea alta (1 min)
        ]
      ]
    ]
  },
  {
    id: 'arnold',
    name: 'Arnold Split (6 days)',
    shortName: 'Arnold Split',
    tagline: '6 days · Freq 2× · Antagonists',
    description: 'The classic Arnold split — Chest/Back, Shoulders/Arms and Legs — adapted 100% to machines.',
    emoji: 'arm',
    daysCount: 6,
    freq: '2×',
    week: { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 },
    routines: [
      [
        'Chest + Back A',
        'barbell',
        [
          ['0577', 4, 6, { repsMin: 6, repsMax: 8, restSec: 150 }],   // Press pecho horizontal convergente (2.5 min)
          ['2330', 4, 8, { repsMin: 8, repsMax: 10, restSec: 150 }],  // Jalón al pecho agarre prono (2.5 min)
          ['1299', 3, 8, { repsMin: 8, repsMax: 10, restSec: 120 }],  // Press pecho inclinado en máquina (2 min)
          ['1350', 3, 8, { repsMin: 8, repsMax: 10, restSec: 120 }],  // Remo máquina con apoyo al pecho (2 min)
          ['0596', 3, 12, { repsMin: 12, repsMax: 15, restSec: 90 }], // Pec deck (1.5 min)
          ['0199', 3, 12, { repsMin: 12, repsMax: 15, restSec: 90 }], // Pullover en polea / jalón recto (1.5 min)
        ]
      ],
      [
        'Shoulders + Arms A',
        'arms',
        [
          ['0603', 4, 6, { repsMin: 6, repsMax: 8, restSec: 150 }],   // Press hombro sentado máquina (2.5 min)
          ['0178', 4, 12, { repsMin: 12, repsMax: 15, restSec: 90 }], // Elevaciones laterales en polea (1.5 min)
          ['0602', 3, 12, { repsMin: 12, repsMax: 15, restSec: 90 }], // Rear delt fly (1.5 min)
          ['0868', 3, 8, { repsMin: 8, repsMax: 10, restSec: 90 }],   // Curl bíceps en polea (1.5 min)
          ['0194', 3, 8, { repsMin: 8, repsMax: 10, restSec: 90 }],   // Extensión tríceps overhead (1.5 min)
          ['0165', 3, 10, { repsMin: 10, repsMax: 12, restSec: 90 }], // Curl martillo polea (1.5 min)
          ['0201', 3, 10, { repsMin: 10, repsMax: 12, restSec: 90 }], // Pushdown tríceps (1.5 min)
        ]
      ],
      [
        'Legs A',
        'legs',
        [
          ['0739', 4, 6, { repsMin: 6, repsMax: 8, restSec: 180 }],   // Prensa piernas inclinada 45° (3 min)
          ['0599', 3, 8, { repsMin: 8, repsMax: 10, restSec: 120 }],  // Curl femoral sentado (2 min)
          ['1425', 3, 10, { repsMin: 10, repsMax: 12, restSec: 120, side: true }], // Prensa unilateral (2 min)
          ['0585', 3, 12, { repsMin: 12, repsMax: 15, restSec: 90 }], // Extensión cuádriceps (1.5 min)
          ['0605', 4, 12, { repsMin: 12, repsMax: 15, restSec: 90 }], // Elevación talones de pie (1.5 min)
          ['0212', 3, 12, { repsMin: 12, repsMax: 15, restSec: 60 }], // Crunch en polea (1 min)
        ]
      ],
      [
        'Chest + Back B',
        'barbell',
        [
          ['1299', 4, 6, { repsMin: 6, repsMax: 8, restSec: 150 }],   // Press pecho inclinado en máquina (2.5 min)
          ['0818', 4, 8, { repsMin: 8, repsMax: 10, restSec: 150 }],  // Jalón agarre neutro (2.5 min)
          ['0596', 3, 10, { repsMin: 10, repsMax: 12, restSec: 90 }], // Pec deck (1.5 min)
          ['0861', 3, 8, { repsMin: 8, repsMax: 10, restSec: 120, side: true }], // Remo unilateral polea (2 min)
          ['0577', 3, 10, { repsMin: 10, repsMax: 12, restSec: 120 }], // Press pecho horizontal máquina (2 min)
          ['0199', 3, 12, { repsMin: 12, repsMax: 15, restSec: 90 }], // Pullover en polea (1.5 min)
        ]
      ],
      [
        'Shoulders + Arms B',
        'arms',
        [
          ['0603', 4, 8, { repsMin: 8, repsMax: 10, restSec: 150 }],  // Press hombro en máquina (2.5 min)
          ['0178', 4, 12, { repsMin: 12, repsMax: 15, restSec: 90 }], // Elevaciones laterales en polea (1.5 min)
          ['0602', 3, 12, { repsMin: 12, repsMax: 15, restSec: 90 }], // Rear delt fly (1.5 min)
          ['1636', 3, 8, { repsMin: 8, repsMax: 10, restSec: 90 }],   // Curl Bayesian (1.5 min)
          ['0194', 3, 10, { repsMin: 10, repsMax: 12, restSec: 90 }], // Extensión tríceps overhead (1.5 min)
          ['1633', 3, 10, { repsMin: 10, repsMax: 12, restSec: 90 }], // Curl predicador unilateral (1.5 min)
          ['0201', 3, 10, { repsMin: 10, repsMax: 12, restSec: 90 }], // Pushdown tríceps (1.5 min)
        ]
      ],
      [
        'Legs B',
        'legs',
        [
          ['0599', 4, 8, { repsMin: 8, repsMax: 10, restSec: 120 }],   // Curl femoral sentado (2 min)
          ['0739', 3, 8, { repsMin: 8, repsMax: 10, restSec: 180 }],   // Prensa piernas (pies altos) (3 min)
          ['1425', 3, 10, { repsMin: 10, repsMax: 12, restSec: 120, side: true }], // Prensa unilateral (2 min)
          ['0585', 3, 12, { repsMin: 12, repsMax: 15, restSec: 90 }],  // Extensión cuádriceps (1.5 min)
          ['0605', 4, 12, { repsMin: 12, repsMax: 15, restSec: 90 }],  // Elevación talones de pie (1.5 min)
          ['0212', 3, 12, { repsMin: 12, repsMax: 15, restSec: 60 }],  // Crunch en polea (1 min)
        ]
      ]
    ]
  },
  {
    id: 'weider',
    name: 'Weider / Bro Split (5 days)',
    shortName: 'Weider Split',
    tagline: '5 days · Freq 1× · Classic bodybuilding',
    description: 'Chest, Back, Shoulders, Legs and Arms. One muscle group per day with maximum localized stimulus.',
    emoji: 'dumbbell',
    daysCount: 5,
    freq: '1×',
    week: { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 },
    routines: [
      [
        'Chest (Monday)',
        'barbell',
        [
          ['0577', 4, 6, { repsMin: 6, repsMax: 8, restSec: 150 }],   // Press pecho horizontal convergente (2.5 min)
          ['1299', 3, 8, { repsMin: 8, repsMax: 10, restSec: 120 }],  // Press pecho inclinado máquina (2 min)
          ['0019', 3, 8, { repsMin: 8, repsMax: 10, restSec: 120 }],  // Máquina de fondos / press (2 min)
          ['0155', 3, 12, { repsMin: 12, repsMax: 15, restSec: 90 }], // Cruces en polea (1.5 min)
        ]
      ],
      [
        'Back (Tuesday)',
        'pullup',
        [
          ['2330', 4, 8, { repsMin: 8, repsMax: 10, restSec: 120 }],  // Jalón al pecho agarre prono (2 min)
          ['1350', 3, 8, { repsMin: 8, repsMax: 10, restSec: 120 }],  // Remo máquina apoyo pecho (2 min)
          ['0861', 3, 10, { repsMin: 10, repsMax: 12, restSec: 120, side: true }], // Remo unilateral polea (2 min)
          ['0199', 3, 12, { repsMin: 12, repsMax: 15, restSec: 90 }], // Jalón brazos rectos / pullover (1.5 min)
          ['0602', 3, 12, { repsMin: 12, repsMax: 15, restSec: 90 }], // Rear delt fly (1.5 min)
        ]
      ],
      [
        'Shoulders + Traps (Wednesday)',
        'shoulders',
        [
          ['0603', 4, 8, { repsMin: 8, repsMax: 10, restSec: 150 }],  // Press hombro sentado máquina (2.5 min)
          ['0178', 4, 12, { repsMin: 12, repsMax: 15, restSec: 90 }], // Elevaciones laterales en polea (1.5 min)
          ['0602', 3, 12, { repsMin: 12, repsMax: 15, restSec: 90 }], // Rear delt fly en máquina (1.5 min)
          ['0203', 3, 12, { repsMin: 12, repsMax: 15, restSec: 90 }], // Face pulls en polea (1.5 min)
          ['0220', 3, 10, { repsMin: 10, repsMax: 12, restSec: 90 }], // Encogimientos (shrugs) en polea (1.5 min)
        ]
      ],
      [
        'Legs (Thursday)',
        'legs',
        [
          ['0739', 4, 6, { repsMin: 6, repsMax: 8, restSec: 180 }],   // Prensa piernas inclinada 45° (3 min)
          ['0739', 3, 10, { repsMin: 10, repsMax: 12, restSec: 150 }], // Prensa piernas (pies altos) (2.5 min)
          ['0599', 3, 8, { repsMin: 8, repsMax: 10, restSec: 120 }],  // Curl femoral sentado (2 min)
          ['0585', 3, 12, { repsMin: 12, repsMax: 15, restSec: 90 }], // Extensión cuádriceps (1.5 min)
          ['0605', 4, 12, { repsMin: 12, repsMax: 15, restSec: 90 }], // Elevación talones de pie (1.5 min)
          ['0598', 3, 12, { repsMin: 12, repsMax: 15, restSec: 90 }], // Aductores en máquina (1.5 min)
        ]
      ],
      [
        'Arms (Friday)',
        'arms',
        [
          ['0194', 3, 8, { repsMin: 8, repsMax: 10, restSec: 90 }],   // Extensión tríceps overhead polea (1.5 min)
          ['0868', 3, 8, { repsMin: 8, repsMax: 10, restSec: 90 }],   // Curl bíceps en polea (1.5 min)
          ['0201', 3, 10, { repsMin: 10, repsMax: 12, restSec: 90 }], // Pushdown de tríceps (1.5 min)
          ['1636', 3, 10, { repsMin: 10, repsMax: 12, restSec: 90 }], // Curl Bayesian (1.5 min)
          ['1723', 3, 12, { repsMin: 12, repsMax: 15, restSec: 90 }], // Extensión tríceps unilateral (1.5 min)
          ['0165', 3, 10, { repsMin: 10, repsMax: 12, restSec: 90 }], // Curl martillo polea (1.5 min)
        ]
      ]
    ]
  }
]

export function instantiateTemplate(templateOrId) {
  const tpl = typeof templateOrId === 'string'
    ? TEMPLATES.find(t => t.id === templateOrId) || TEMPLATES[0]
    : (templateOrId || TEMPLATES[0])

  const routines = tpl.routines.map(([name, emoji, list]) => ({
    id: uid(),
    name: t(name),
    emoji: emoji || 'barbell',
    prog: 'double',
    ex: list.map(([id, sets, repsOrSec, extra]) => {
      const o = { id, sets, weight: 0 }
      if (extra?.mode === 'time') {
        o.sec = repsOrSec
        o.mode = 'time'
        o.bw = true
      } else {
        o.reps = repsOrSec
        o.mode = 'reps'
      }
      if (extra?.repsMin != null) o.repsMin = extra.repsMin
      if (extra?.repsMax != null) o.repsMax = extra.repsMax
      if (extra?.restSec != null) o.restSec = extra.restSec
      if (extra?.side) o.side = true
      return o
    })
  }))

  const week = {}
  Object.entries(tpl.week).forEach(([day, routineIdx]) => {
    if (routines[routineIdx]) {
      week[day] = routines[routineIdx].id
    }
  })

  const split = {
    id: uid(),
    name: t(tpl.name),
    emoji: tpl.emoji || 'barbell',
    week
  }

  return { routines, split, template: tpl }
}

export const SPEC = TEMPLATES[0].routines

export const starterRoutines = () => instantiateTemplate('upper-lower').routines
