/** is a hook to allow us to send and receive messages from the main thread in a worker */
export const useMain = (
  /** is self of the worker */
  context,
  trigger,
) => {
  const eventHandler = ({ data }) => {
    trigger(data);
  };
  const send = (recipient, detail) => {
    context.postMessage({
      recipient,
      detail,
    });
  };
  context.addEventListener("message", eventHandler, false);
  const disconnect = () => context.removeEventListener("message", eventHandler);
  return Object.freeze([send, disconnect]);
};
