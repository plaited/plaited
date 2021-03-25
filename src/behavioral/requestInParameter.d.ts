import { CandidateBid, RuleParameterValue } from './types';
export declare const requestInParameter: ({ eventName: requestEventName, payload: requestPayload }: CandidateBid) => ({ eventName: parameterEventName, callback: parameterCallback }: RuleParameterValue) => boolean;
