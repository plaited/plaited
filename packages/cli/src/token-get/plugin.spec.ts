import test from 'ava'
import sinon from 'sinon'
import postcss, { Plugin } from'postcss'
import { readFile } from'fs/promises'
import path from'path'
import { tokensGet } from'./index.js'
import { map } from'./__mocks__/map.js'


test('tokensGet(): fetches map value correctly', async t => {
  const res = await readFile(path.resolve(__dirname, './__mocks__/styles.css'), 'utf8')
  const { css } = await postcss([
    (tokensGet(map) as Plugin),
  ]).process(res, { from: undefined, to: '' })
  t.snapshot(css)
})
  
test('tokensGet: throws on invalid path global token', async t => {
  const res = await readFile(path.resolve(__dirname, './__mocks__/error-1.css'), 'utf8')
  const spy = sinon.spy(console, 'error')
  await postcss([
    (tokensGet(map) as Plugin),
  ]).process(res, { from: undefined, to: '' })
  t.truthy(spy.called)
  
})

test('tokensGet: throws on invalid path aliased token', async t => {
  const res = await readFile(path.resolve(__dirname, './__mocks__/error-2.css'), 'utf8')
  const spy = sinon.spy(console, 'error')
  await postcss([
    (tokensGet(map) as Plugin),
  ]).process(res, { from: undefined, to: '' })
  t.truthy(spy.called)
  
})

test('tokensGet: throws on incomplete path global token', async t => {
  const res = await readFile(path.resolve(__dirname, './__mocks__/error-3.css'), 'utf8')
  const spy = sinon.spy(console, 'error')
  await postcss([
    (tokensGet(map) as Plugin),
  ]).process(res, { from: undefined, to: '' })
  t.truthy(spy.called)
})

test('tokensGet: throws on incomplete path aliased token', async t => {
  const res = await readFile(path.resolve(__dirname, './__mocks__/error-4.css'), 'utf8')
  const spy = sinon.spy(console, 'error')
  await postcss([
    (tokensGet(map) as Plugin),
  ]).process(res, { from: undefined, to: '' })
  t.truthy(spy.called)
})
