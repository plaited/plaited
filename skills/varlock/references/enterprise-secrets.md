# Enterprise Secrets

Secret provider setup for enterprise deployments using Varlock's `@source` directive.

## How It Works

In enterprise deployments, secrets resolve from the organization's secret manager at runtime. The agent sees the schema (knows a variable is needed), generates code that reads `process.env.VAR_NAME`, but never sees the actual value.

```
┌──────────────────┐    reads     ┌──────────────────┐
│  Agent (at dev)  │ ──────────► │  .env.schema     │
│                  │             │  (metadata only)  │
└──────────────────┘             └──────────────────┘

┌──────────────────┐    resolves  ┌──────────────────┐
│  Varlock (at run)│ ──────────► │  Secret Manager  │
│                  │             │  (actual values)  │
└──────────────────┘             └──────────────────┘
```

## Provider Patterns

### 1Password (op CLI)

```ini
INFERENCE_API_KEY=
  @sensitive
  @required
  @description API key for hosted inference
  @source exec('op read "op://Plaited/inference-key/credential"')

DATABASE_URL=
  @sensitive
  @required
  @type url
  @source exec('op read "op://Plaited/database/connection-string"')
```

Requires: `op` CLI installed and authenticated (`op signin`).

### AWS Secrets Manager

```ini
DATABASE_URL=
  @sensitive
  @required
  @type url
  @source exec('aws secretsmanager get-secret-value --secret-id plaited/db-url --query SecretString --output text')

A2A_CERT_PATH=
  @sensitive
  @required
  @type path
  @source exec('aws secretsmanager get-secret-value --secret-id plaited/a2a-cert --query SecretString --output text > /tmp/a2a-cert.pem && echo /tmp/a2a-cert.pem')
```

Requires: `aws` CLI configured with appropriate IAM role.

### Azure Key Vault

```ini
INFERENCE_API_KEY=
  @sensitive
  @required
  @source exec('az keyvault secret show --vault-name plaited-vault --name inference-key --query value -o tsv')
```

Requires: `az` CLI authenticated (`az login`).

### Google Cloud Secret Manager

```ini
INFERENCE_API_KEY=
  @sensitive
  @required
  @source exec('gcloud secrets versions access latest --secret=inference-key')
```

Requires: `gcloud` CLI authenticated with appropriate permissions.

### Infisical

```ini
DATABASE_URL=
  @sensitive
  @required
  @type url
  @source exec('infisical secrets get DATABASE_URL --plain')
```

Requires: `infisical` CLI logged in to the project.

### Bitwarden (bw CLI)

```ini
INFERENCE_API_KEY=
  @sensitive
  @required
  @source exec('bw get password plaited-inference-key')
```

Requires: `bw` CLI unlocked (`bw unlock`).

## Environment-Specific Overrides

Varlock supports environment-specific files. The PM provisions nodes with the appropriate environment:

```
.env.schema           # Base schema (committed to repo)
.env.development      # Local dev values (gitignored)
.env.staging          # Staging overrides
.env.production       # Production — all @sensitive vars use @source
```

Resolution order: `@source` > `.env.{NODE_ENV}` > `.env` > schema defaults.

## Node Provisioning Flow

When the PM provisions a worker node:

1. **Seed generates** `.env.schema` declaring what the worker needs
2. **PM reads** the schema to understand requirements (safe — no secrets in schema)
3. **Infrastructure** provisions secret manager entries (out of band)
4. **Varlock resolves** secrets at worker startup via `@source` directives
5. **Worker runs** with validated environment — agent code only uses `process.env`

The PM never sees the actual secret values. It only sees the metadata: "this worker needs a `DATABASE_URL` of type `url`, and it's `@sensitive` and `@required`."
