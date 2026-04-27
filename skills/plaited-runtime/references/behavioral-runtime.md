# Behavioral Runtime Reference

Status: active source-backed coordination reference.

## Runtime Surface

- `behavioral()` coordination runtime
- `bThread`, `bSync`, `useFeedback`, `useSnapshot`
- snapshot diagnostics for selection/deadlock/runtime error conditions

## Practical Rules

- keep coordination constraints in threads
- keep side effects in feedback handlers
- preserve explicit diagnostics for blocked/error conditions
- avoid silent malformed-payload drops in boundary handlers

## Relation To Doctrine

Behavioral runtime is the local coordination substrate used by both private-lane and exchange-lane policy flows. It is not itself a substitute for contract or auth policy definitions.
