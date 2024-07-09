export interface AssertionErrorInterface extends Error {
  name: string
}

export interface AssertionErrorConstructor {
  new (message: string): AssertionErrorInterface
}
