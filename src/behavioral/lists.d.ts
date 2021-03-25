import { CandidateBid, PendingBid, RuleParameterValue } from './types';
export declare const candidatesList: (pending: PendingBid[]) => CandidateBid[];
export declare const blockedList: (pending: PendingBid[]) => RuleParameterValue[];
