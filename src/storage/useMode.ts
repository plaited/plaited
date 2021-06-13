import {useStore} from './useStore'

export const useMode = <T extends string>(arg: T) => useStore<T>(arg)
