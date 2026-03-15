# Schema Patterns

`.env.schema` patterns for Plaited node configuration, organized by node role.

## Common Variables (All Nodes)

Every node in the modnet topology needs identity and connectivity:

```ini
# Node identity
NODE_ROLE=worker
  @type enum(pm,worker,registry,observer)
  @required
  @description Role in the modnet topology (see modnet.constants.ts NODE_ROLE)

NODE_NAME=
  @required
  @description Human-readable node identifier
```

## Worker Node

A worker node executes tasks within a project sandbox. Needs inference access and A2A connectivity:

```ini
# Model inference
INFERENCE_URL=http://localhost:11434
  @type url
  @required
  @description Local inference server endpoint (e.g., Ollama)

INFERENCE_API_KEY=
  @sensitive
  @required
  @description API key for hosted inference (empty for local Ollama)

# A2A communication
A2A_CERT_PATH=
  @sensitive
  @required
  @type path
  @description mTLS certificate for A2A communication

A2A_KEY_PATH=
  @sensitive
  @required
  @type path
  @description mTLS private key

# Node identity
NODE_ROLE=worker
  @type enum(pm,worker,registry,observer)
  @required

NODE_NAME=
  @required
  @description Human-readable node identifier
```

## PM (Project Manager) Node

The PM orchestrates work and provisions worker nodes. Needs additional infrastructure access:

```ini
# Model inference (PM may use a more capable model)
INFERENCE_URL=https://api.anthropic.com
  @type url
  @required
  @description Inference endpoint for orchestration model

INFERENCE_API_KEY=
  @sensitive
  @required
  @description API key for orchestration model
  @source exec('op read "op://Plaited/pm-inference-key/credential"')

# A2A communication
A2A_CERT_PATH=
  @sensitive
  @required
  @type path
  @description mTLS certificate for A2A communication

A2A_KEY_PATH=
  @sensitive
  @required
  @type path
  @description mTLS private key

# Infrastructure
REGISTRY_URL=
  @type url
  @required
  @description URL of the registry node for module discovery

# Node identity
NODE_ROLE=pm
  @type enum(pm,worker,registry,observer)
  @required

NODE_NAME=
  @required
  @description Human-readable node identifier
```

## Registry Node

The registry maintains the module directory and peer index:

```ini
# Storage
REGISTRY_DB_PATH=
  @type path
  @required
  @description Path to the registry SQLite database

REGISTRY_SIGNING_KEY=
  @sensitive
  @required
  @description Ed25519 private key for signing Agent Card JWS

# A2A communication
A2A_CERT_PATH=
  @sensitive
  @required
  @type path
  @description mTLS certificate for A2A communication

A2A_KEY_PATH=
  @sensitive
  @required
  @type path
  @description mTLS private key

# Node identity
NODE_ROLE=registry
  @type enum(pm,worker,registry,observer)
  @required

NODE_NAME=
  @required
  @description Human-readable node identifier
```

## Observer Node

The observer collects snapshots and monitors health:

```ini
# Monitoring
METRICS_ENDPOINT=
  @type url
  @description Prometheus-compatible metrics push endpoint

ALERT_WEBHOOK_URL=
  @sensitive
  @type url
  @description Webhook URL for health alerts

# A2A communication (read-only — observer doesn't need to be trusted for writes)
A2A_CERT_PATH=
  @sensitive
  @required
  @type path
  @description mTLS certificate for A2A communication

A2A_KEY_PATH=
  @sensitive
  @required
  @type path
  @description mTLS private key

# Node identity
NODE_ROLE=observer
  @type enum(pm,worker,registry,observer)
  @required

NODE_NAME=
  @required
  @description Human-readable node identifier
```

## Schema Annotation Reference

| Annotation | Purpose | Example |
|-----------|---------|---------|
| `@sensitive` | Value must never appear in logs, context, or training data | API keys, certificates |
| `@required` | Node fails to start without this variable | Most infrastructure vars |
| `@type` | Validates the value format | `url`, `path`, `enum(...)`, `number`, `boolean` |
| `@description` | Human-readable purpose (shown to agents) | Always include for clarity |
| `@source` | External secret provider command | `exec('op read ...')`, `exec('aws ...')` |
| `@default` | Fallback value if not set | Only for non-sensitive vars |
