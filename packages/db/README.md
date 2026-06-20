# @readion/db

Shared MikroORM configuration, NestJS `DbModule`, entity base class, pgvector support, and reusable Testcontainers harness for the Readion monorepo.

## Migration Workflow

```bash
# Generate a new migration from schema diff
yarn workspace @readion/db migration:create

# Apply all pending migrations
yarn workspace @readion/db migration:up

# Revert the most recently applied migration
yarn workspace @readion/db migration:down
```

## Immutable Committed Migrations

**Never edit a migration file after it has been committed.**

If a schema correction is needed after a migration is already committed and pushed, create a new migration:

```bash
yarn workspace @readion/db migration:create
```

Edit the new migration file to apply the correction. The committed migration stays untouched.

Editing a committed migration breaks the migration history for any environment that has already applied it, causing schema drift that is difficult to recover from.
