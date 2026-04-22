# Plaited Experience Standard

> Status: target doctrine. Current source still carries transitional MSS `scale`
> fields in some schemas; see [Modnet Translation](modnet-translation.md).

## Position

Plaited does not treat shared UI as the interoperability unit.

Each user's screen belongs to that user and their local agent. Other nodes see
approved data, resources, services, and policy-governed projections. Their
agents may render different interfaces for the same underlying exposure.

The shared substrate is:

- actor-owned facts and resources
- actor-owned services and actions
- policy and grants
- provenance
- runtime-approved projections

The local substrate is:

- generated UI
- task-specific layout
- accessibility and device adaptation
- user preference and workflow memory

## Responsibility Split

Agents propose and organize. Actors own and validate. Runtime policy decides
what crosses node boundaries.

| Layer | Responsibility |
|---|---|
| Agent | Extract facts from messy input, propose services, draft policies, generate local UI, keep the authoring model humane |
| Actor | Own source state, expose service handlers, record provenance, reject invalid or unauthorized operations |
| Runtime / Supervisor | Validate descriptors, evaluate projection requests, enforce grants, maintain replayable policy state |
| Human | Approve sensitive sharing, authority changes, destructive actions, and policy escalation |

## Conceptual Model

```text
user intent and messy domain input
  -> agent-proposed facts/resources/services/policies
  -> actor-owned state and service handlers
  -> runtime-governed projections and grants
  -> local generated UI for each audience/context
```

## Descriptive Vocabulary

The target descriptive tags are:

- `content`: what domain the actor is about
- `structure`: how source state is conceptually organized
- `mechanics`: what services, actions, loops, or incentives exist
- `boundary`: what sharing, audience, and policy constraints apply

These tags help discovery, review, and agent reasoning. They do not grant
authority. Runtime objects decide what can actually happen.

## Runtime Substrate

Facts and resources are projectable state, not tags. Services and actions are
capabilities, not labels. Policy and grants are enforceable runtime decisions,
not prose. Provenance attaches to state, projections, grants, and code
promotion. Projections are approved views over actor-owned state or services.

## Farm Stand Example

A farmer should not have to assemble a farm stand from hand-authored object
scales. The user can say what is true in ordinary language:

```text
I have Fuji apples today, $4/lb retail, $2.50/lb wholesale, pickup until 2pm.
Ask before sharing supplier terms.
```

The agent may propose:

- facts: inventory, prices, pickup window, location, availability
- services: reserve item, request wholesale quote, pay invoice, subscribe to restock
- policies: public retail availability, supplier-only wholesale terms, organizer aggregation
- provenance: farmer-entered price, agent-normalized item name, last updated time
- projections: consumer shopping, supplier ordering, organizer logistics, public availability

The actor validates and owns the accepted state. The runtime decides what each
requester may receive. UI remains local: one person may see a shopping list,
another a supplier order sheet, another a market map.

## Constraints

Do not let generated UI hide authority. Every cross-node exposure still needs
declared source, audience, policy, projection shape, and provenance.

Do not treat agent inference as approval. Agents can propose policies and
interfaces; actors and runtime policy enforce them.
