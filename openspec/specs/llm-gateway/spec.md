## Purpose

The `LlmModule` gateway provides a single, provider-agnostic interface for all LLM text generation, streaming, and embedding within `apps/api`. It abstracts the Vercel AI SDK, resolves models from task types and configuration, enforces per-task token budgets, supports prompt caching, and emits observability signals.

## Requirements

### Requirement: Single Vercel AI SDK gateway

All LLM text generation, streaming, and embedding in `apps/api` SHALL go through the `LlmModule` gateway, which uses the Vercel AI SDK. Feature modules MUST NOT import a provider SDK (e.g. `@anthropic-ai/sdk`, `openai`) directly. The active chat provider SHALL be selected from configuration (`AI_PROVIDER`), not hardcoded.

#### Scenario: Generation routes through the SDK with the configured provider

- **WHEN** a feature module calls the gateway's text-generation method for a given task type
- **THEN** the gateway invokes the Vercel AI SDK `generateText` with the model resolved for that task type
- **AND** the resolved model belongs to the provider named by `AI_PROVIDER`
- **AND** the gateway returns the generated text plus token-usage metadata to the caller

#### Scenario: Streaming routes through the SDK

- **WHEN** a feature module calls the gateway's streaming method for a task type
- **THEN** the gateway invokes the Vercel AI SDK `streamText` with the resolved model
- **AND** returns a stream the caller can consume incrementally

#### Scenario: No direct provider-SDK imports

- **WHEN** the `apps/api` source tree is scanned for imports of `@anthropic-ai/sdk` or `openai` outside the `llm` module's provider-adapter wiring
- **THEN** no such import exists

### Requirement: Task-type model-tier resolution

The gateway SHALL resolve a model ID from a requested **task type**, never from a caller-supplied model string. Each task type SHALL map to a configured model ID and a known tier (`utility`, `mid-tier`, or `thinking`). The supported task types SHALL be: quiz generation, answer verification, domain tagging, agent Q&A, certification pre-fill, on-demand material generation, and complex reasoning. Model IDs SHALL come from per-task-type environment variables.

#### Scenario: Utility task resolves to the configured utility model

- **WHEN** the gateway resolves the model for the `quiz-generation` task type
- **AND** the utility model is configured as `claude-haiku-4-5`
- **THEN** the resolved model ID is `claude-haiku-4-5`
- **AND** the resolved tier is `utility`

#### Scenario: Answer verification uses a utility-tier model distinct from the generation call

- **WHEN** the gateway resolves the model for the `answer-verification` task type
- **THEN** the resolved tier is `utility`

#### Scenario: Agent task resolves to the configured mid-tier model

- **WHEN** the gateway resolves the model for the `agent-qa` task type
- **AND** the mid-tier model is configured as `claude-sonnet-4-6`
- **THEN** the resolved model ID is `claude-sonnet-4-6`
- **AND** the resolved tier is `mid-tier`

#### Scenario: Complex reasoning resolves to the thinking tier

- **WHEN** the gateway resolves the model for the `complex-reasoning` task type
- **THEN** the resolved tier is `thinking`

#### Scenario: Unknown task type is rejected

- **WHEN** the gateway is asked to resolve a model for a task type that is not registered
- **THEN** it raises an error rather than falling back to a default model

### Requirement: Per-task token budgets

Each task type SHALL have a configured maximum output-token budget that the gateway applies to its calls, preventing runaway cost. The budget SHALL be passed to the SDK call as the max-tokens limit for that task type.

#### Scenario: Configured budget is applied to the call

- **WHEN** the gateway generates text for a task type whose configured token budget is 1024
- **THEN** the underlying SDK call is invoked with a max-tokens limit of 1024

#### Scenario: Each task type can carry an independent budget

- **WHEN** quiz generation is configured with a 1024-token budget and agent Q&A with a 2048-token budget
- **THEN** a quiz-generation call uses 1024 and an agent-Q&A call uses 2048

### Requirement: Batched embedding service with declared dimension

The gateway SHALL provide an embedding service that generates embeddings via the Vercel AI SDK using an embedding provider/model configured independently from the chat provider. The default embedding model SHALL be OpenAI `text-embedding-3-small` producing 1536-dimension vectors. The service SHALL support embedding many inputs in a single batched call for bulk ingestion, and SHALL expose the configured model's declared output dimension as a value other modules can read.

#### Scenario: Default embedding model produces 1536-dimension vectors

- **WHEN** the embedding service embeds a single text with the default configuration
- **THEN** it returns a vector of length 1536
- **AND** the service's declared dimension constant equals 1536

#### Scenario: Batch embedding returns one vector per input in order

- **WHEN** the embedding service is given an array of 50 texts in one batch call
- **THEN** it returns 50 vectors, each of the declared dimension, in the same order as the inputs
- **AND** it does so without issuing 50 separate single-text calls

#### Scenario: Embedding provider is independent of chat provider

- **WHEN** `AI_PROVIDER` is `anthropic` and the embedding model is configured as an OpenAI model
- **THEN** the embedding service uses the OpenAI embedding model
- **AND** the chat gateway still uses the Anthropic chat model

#### Scenario: Declared embedding dimension is exposed for downstream column validation

- **WHEN** another module reads the embedding service's declared dimension
- **THEN** it receives the configured model's output dimension (1536 for the default)
- **AND** can compare it against a pgvector column dimension without issuing an embedding call

### Requirement: Provider prompt-caching helper

The gateway SHALL provide a helper that marks large, repeated static context (system prompts, certification domain lists) as cacheable using the active provider's prompt-caching mechanism (e.g. Anthropic `cache_control`). When the active provider does not support prompt caching, the helper SHALL pass the content through unchanged without error.

#### Scenario: Static context is marked cacheable for a supporting provider

- **WHEN** a caller wraps a system prompt with the prompt-cache helper and the active provider supports prompt caching
- **THEN** the message passed to the SDK carries the provider's cache-control marker on that content

#### Scenario: Helper is a no-op for a non-supporting provider

- **WHEN** a caller wraps content with the prompt-cache helper and the active provider does not support prompt caching
- **THEN** the content is passed through unchanged and no error is raised

### Requirement: Gateway LLM-call instrumentation

The gateway SHALL emit LLM call latency, token usage, and error-rate metrics labelled by model and use-case (task type), and SHALL wrap LLM and embedding calls in tracing spans. These signals are emitted through the metrics/tracing infrastructure provided by the `observability` change.

#### Scenario: A successful call records latency and token usage

- **WHEN** the gateway completes a generation call for the `quiz-generation` task type using model `claude-haiku-4-5`
- **THEN** a latency observation and a token-usage observation are recorded with labels `model=claude-haiku-4-5` and `use_case=quiz-generation`

#### Scenario: A failed call increments the error metric

- **WHEN** an LLM call for a task type raises an error
- **THEN** the error-rate metric is incremented with the model and use-case labels for that call

### Requirement: AI provider configuration validated at boot

The `apps/api` Zod env schema SHALL be extended with the AI provider configuration group: provider name, API key(s), per-task-type model IDs, embedding provider/model, per-task token budgets, and the response-cache TTL. The application SHALL fail fast at startup with a clear error if a required AI value is missing or malformed. The embedding dimension SHALL NOT be a runtime-configurable value.

#### Scenario: Missing required AI provider key fails boot

- **WHEN** the application boots in production with `AI_PROVIDER` set but the provider API key absent
- **THEN** startup fails with an error naming the missing configuration field

#### Scenario: Valid AI configuration boots successfully

- **WHEN** the application boots with a valid provider name, API key, per-task model IDs, embedding model, token budgets, and cache TTL
- **THEN** the gateway initializes and resolves models for every supported task type

#### Scenario: Embedding dimension is not accepted as runtime config

- **WHEN** the env schema is inspected
- **THEN** there is no environment variable that sets the embedding vector dimension at runtime
