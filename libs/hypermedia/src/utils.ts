export const isMessageEvent = (event: MessageEvent | Event): event is MessageEvent => event.type === 'message'
