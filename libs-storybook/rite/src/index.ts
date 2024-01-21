import { instrument } from '@storybook/instrumenter'
import * as utils from './utils.js'

const lib = instrument({ ...utils }, { intercept: (_method, path) => !['assert', 'match'].includes(path[0] as string) })

export const { assert, match, wait, throws, findByText, findByAttribute, fireEvent } = lib
