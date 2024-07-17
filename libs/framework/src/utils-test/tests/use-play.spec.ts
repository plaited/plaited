import { test, expect } from 'bun:test'
import type { Play } from '../types.js'
import { usePlay } from '../use-play.js'

const play:Play = async ({ wait }) => {
  await wait(100)
}

test('usePlay: should not throw', async () => {
  expect(async () => await usePlay(play)).not.toThrow()
})

test('usePlay: should throw', async () => {
  expect(async () => await usePlay(play, 50)).toThrow()
})