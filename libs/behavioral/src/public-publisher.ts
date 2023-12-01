import { publisher as _publisher } from './publisher.js'
import { TriggerArgs, Publisher } from './types.js'

export const publisher = <T extends TriggerArgs = TriggerArgs>(): Publisher<T> => _publisher<T>()
