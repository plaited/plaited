import { expect, test } from 'bun:test'
import { createKeyframes, createTokens } from 'plaited/ui'

test('createKeyframes: generates named keyframes with unique id', () => {
  const { pulse } = createKeyframes('pulse', {
    '0%': { transform: 'scale(1)' },
    '50%': { transform: 'scale(1.1)' },
    '100%': { transform: 'scale(1)' },
  })
  expect(pulse.id.startsWith('pulse_')).toBeTruthy()
  expect(pulse()).toMatchSnapshot()
})

test('createKeyframes: works with design token references', () => {
  const { animations } = createTokens('animations', {
    scale: {
      $value: {
        $function: 'scale',
        $arguments: '1.2',
      },
    },
    rotate: {
      $value: {
        $function: 'rotate',
        $arguments: '360deg',
      },
    },
  })

  const { spin } = createKeyframes('spin', {
    '0%': { transform: 'rotate(0deg)' },
    '100%': { transform: animations.rotate },
  })

  const { pulse } = createKeyframes('pulse', {
    '0%': { transform: 'scale(1)' },
    '50%': { transform: animations.scale },
    '100%': { transform: 'scale(1)' },
  })

  expect(spin()).toMatchSnapshot()
  expect(pulse()).toMatchSnapshot()
})
