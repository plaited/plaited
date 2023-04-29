/** takes an array of conditional css class name strings and returns them concatenated */
export const classNames = (...classes) => classes.filter(Boolean).join(" ");
