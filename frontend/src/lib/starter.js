// The Upper/Lower 4-Day starter plan (zero axial lumbar load, 100% machines & cables).
// Shared by the "Load starter plan" action in Settings / Plan and by onboarding.
import { uid } from './format.js'

export const SPEC = [
  [
    'Torso A (Empuje)',
    'barbell',
    [
      ['0577', 3, 8],  // Press pecho horizontal en máquina convergente
      ['2330', 3, 8],  // Jalón al pecho agarre prono en polea
      ['0603', 3, 8],  // Press de hombro sentado en máquina
      ['1350', 3, 10], // Remo en máquina con apoyo al pecho
      ['0178', 3, 12], // Elevaciones laterales en polea
      ['0194', 3, 10], // Extensión de tríceps overhead con cuerda
      ['0868', 3, 10], // Curl de bíceps en polea (barra recta)
      ['0210', 2, 12], // Antebrazo: extensores en polea (agarre prono)
    ]
  ],
  [
    'Pierna A (Cuádriceps)',
    'legs',
    [
      ['0739', 4, 8],  // Prensa de piernas inclinada 45°
      ['1425', 3, 10], // Prensa unilateral
      ['0585', 3, 12], // Extensión de cuádriceps
      ['0599', 3, 10], // Curl femoral SENTADO
      ['0605', 4, 10], // Elevación de talones DE PIE
      ['0598', 3, 12], // Aductores en máquina
      ['0212', 3, 12], // Crunch en polea alta
      ['0247', 2, 12], // Antebrazo: flexores en polea (agarre supino)
    ]
  ],
  [
    'Torso B (Tracción)',
    'pullup',
    [
      ['0861', 3, 10], // Remo unilateral en polea baja
      ['0818', 3, 10], // Jalón agarre neutro / divergente
      ['1299', 3, 8],  // Press pecho inclinado en máquina
      ['0596', 3, 10], // Pec deck (aperturas en máquina)
      ['0602', 3, 12], // Rear delt fly (pec deck invertido o polea)
      ['0178', 3, 12], // Elevaciones laterales en polea
      ['1636', 3, 10], // Curl Bayesian en polea
      ['0194', 3, 10], // Extensión de tríceps overhead con cuerda
      ['0210', 2, 12], // Antebrazo: extensores en polea
    ]
  ],
  [
    'Pierna B (Isquios)',
    'legs',
    [
      ['0599', 4, 8],  // Curl femoral SENTADO
      ['0739', 3, 10], // Prensa de piernas (pies ALTOS)
      ['1425', 3, 10], // Prensa unilateral
      ['0585', 3, 10], // Extensión de cuádriceps
      ['0738', 4, 12], // Elevación de talones en la prensa
      ['0598', 2, 12], // Aductores en máquina
      ['0212', 3, 12], // Crunch en polea alta
      ['0464', 3, 45, { mode: 'time', sec: 45 }], // Plancha activa
      ['0247', 2, 12], // Antebrazo: flexores en polea
    ]
  ]
]

// Fresh routine objects (new ids) — [Torso A, Pierna A, Torso B, Pierna B].
export const starterRoutines = () =>
  SPEC.map(([name, emoji, list]) => ({
    id: uid(),
    name,
    emoji,
    ex: list.map(([id, sets, repsOrSec, extra]) => {
      if (extra?.mode === 'time') {
        return { id, sets, sec: repsOrSec, weight: 0, mode: 'time', bw: true }
      }
      return { id, sets, reps: repsOrSec, weight: 0, mode: 'reps' }
    })
  }))
