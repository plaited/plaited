import { Strategy } from './types.ts';
/** @description Randomized Priority Queue Selection Strategy */
export declare const randomizedStrategy: Strategy;
/** @description Chaos Selection Strategy */
export declare const chaosStrategy: Strategy;
/** @description Priority Queue Selection Strategy */
export declare const priorityStrategy: Strategy;
export declare const selectionStrategies: {
    priority: Strategy;
    chaos: Strategy;
    randomized: Strategy;
};
