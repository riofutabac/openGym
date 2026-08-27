import { describe } from 'vitest'
import { runContractTests } from './contract.js'
import { createLocalAdapter } from './local.js'

describe('Local Adapter Conformance', () => {
  // 1. Local Adapter Contract Test (localStorage fallback)
  runContractTests('Local Adapter (localStorage fallback)', () => createLocalAdapter({ mockCapacitor: false }), () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
  })

  // 2. Local Adapter Contract Test (Mobile / Filesystem simulation)
  {
    let virtualFile = null
    runContractTests(
      'Local Adapter (Mobile native mode)',
      () =>
        createLocalAdapter({
          mockCapacitor: true,
          readFile: async () => {
            if (virtualFile === null) throw new Error('File not found')
            return { data: virtualFile }
          },
          writeFile: async ({ data }) => {
            virtualFile = data
          },
        }),
      () => {
        virtualFile = null
        if (typeof localStorage !== 'undefined') {
          localStorage.clear()
        }
      }
    )
  }
})
