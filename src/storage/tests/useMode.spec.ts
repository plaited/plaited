import {assert} from '@esm-bundle/chai'
import {useMode} from '..'

it('useStore()', () => {
  const [getMode, setMode] = useMode<'ready' | 'running' | 'paused'>('ready')
  setMode('running')
  assert.equal(getMode(), 'running')
})
