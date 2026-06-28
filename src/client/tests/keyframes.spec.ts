import { expect, test } from 'bun:test'
import { createKeyframes } from 'plaited/client'

test('createKeyframes: generates named keyframes with unique id', () => {
  const { pulse } = createKeyframes('pulse', {
    '0%': { transform: 'scale(1)' },
    '50%': { transform: 'scale(1.1)' },
    '100%': { transform: 'scale(1)' },
  })
  expect(pulse.id.startsWith('pulse_')).toBeTruthy()
  expect(pulse()).toMatchSnapshot()
})

test('createKeyframes: works with var() values', () => {
  const { spin } = createKeyframes('spin', {
    '0%': { transform: 'rotate(0deg)' },
    '100%': { transform: 'var(--animations-rotate)' },
  })

  const { pulse } = createKeyframes('pulse', {
    '0%': { transform: 'scale(1)' },
    '50%': { transform: 'var(--animations-scale)' },
    '100%': { transform: 'scale(1)' },
  })

  expect(spin()).toMatchSnapshot()
  expect(pulse()).toMatchSnapshot()
})
