import { publisher as _publisher } from './publisher.js'
import { BPEvent, Publisher } from './types.js'

export const publisher = <T extends BPEvent = BPEvent>(): Publisher<T> => _publisher<T>()
