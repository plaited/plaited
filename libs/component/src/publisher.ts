import { publisher as _publisher } from '@plaited/utils'
import { TriggerArgs } from '@plaited/behavioral'
import { Publisher } from '../../types/dist/index.js'

export const publisher = <T extends TriggerArgs = TriggerArgs>(): Publisher<T> => _publisher<T>()
