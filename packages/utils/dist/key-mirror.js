/** create an object who's keys and values are the same by simply passing in the keys as arguments */
export const keyMirror = (...inputs) => {
  const mirrored = inputs.reduce((acc, key) => ({ ...acc, [key]: key }), {});
  return Object.freeze(mirrored);
};
