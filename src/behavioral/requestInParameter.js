export const requestInParameter = ({eventName: requestEventName, payload: requestPayload}) => (
  {eventName: parameterEventName, callback: parameterCallback}
) => (parameterCallback
    ? parameterCallback({payload: requestPayload, eventName: requestEventName})
    : requestEventName === parameterEventName)
