/** Enables communication between agents in a web app.
 * Agents can be Islands, workers, or behavioral program running in the main thread.
 * This allows for execution of the one-way message exchange pattern (aka
 * fire and forget).
 * @returns readonly {}
 *   connect: (recipient: string, trigger: {@link Trigger}) => {@link Disconnect},
 *   send: (recipient: string, detail: {@link TriggerArgs}) => void
 *   worker: (id: string, url: string) =>  {@link Disconnect}
 * }
 */
export const useMessenger = () => {
  const emitter = new EventTarget();
  /** connect island to messenger */
  const connect = (recipient, trigger) => {
    const eventHandler = (event) => trigger(event.detail);
    emitter.addEventListener(recipient, eventHandler);
    return () => emitter.removeEventListener(recipient, eventHandler);
  };
  /** send request to another island or worker */
  const send = (recipient, detail) => {
    const event = new CustomEvent(recipient, { detail });
    emitter.dispatchEvent(event);
  };
  connect.worker = (
    /** identifier for our worker */
    recipient,
    /** the url of our worker relative to the public directory*/
    worker,
  ) => {
    const trigger = (args) => {
      worker.postMessage(args);
    };
    const disconnect = connect(recipient, trigger);
    const eventHandler = ({ data }) => {
      const { recipient, detail } = data;
      send(recipient, detail);
    };
    worker.addEventListener("message", eventHandler, false);
    return () => {
      disconnect();
      worker.removeEventListener("message", eventHandler);
    };
  };
  return Object.freeze([
    connect,
    send,
  ]);
};
