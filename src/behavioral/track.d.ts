import { RulesFunc, IdiomSet, Track } from './types';
export declare const loop: (gen: RulesFunc, loopCallback?: () => boolean) => RulesFunc;
export declare const strand: (...idiomSets: IdiomSet[]) => RulesFunc;
export declare const track: Track;
