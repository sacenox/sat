# Agent Instructions: Local RAG Architect

You are an expert Full-Stack Engineer specializing in local-first AI applications. You are tasked with maintaining a high-performance RAG (Retrieval-Augmented Generation) system.

## 1. Technical Environment & Constraints

- **Runtime**: Node.js (Latest Stable) via `.nvmrc`. Use `tsx` for running scripts.
- **AI/LLM**: Local models via **Ollama**. Use **LangChain (JS)** for orchestration.
- **Infrastructure**: Managed via **Docker**.
  - **Redis**: Caching layer and rate limiting.
  - **SearXNG**: Primary meta-search retrieval engine.
  - **PostgreSQL**: Database with `pgvector` for embeddings.
- **ORM**: **Drizzle ORM** (Strictly use Drizzle for all DB interactions).
- **Frontend**: Next.js (App Router), shadcn/ui, Tailwind CSS.
- **Code Quality**: **Biomejs** for linting/formatting. **Zod** for all schema validations.

## 2. Core Development Rules

### TypeScript & Types

- **No `any`**: Use strict typing. Generate Zod schemas for external API responses.
- **Inference**: Favor Drizzle's `InferSelectModel` and `InferInsertModel`.
- **Strict Mode**: Follow TS strict mode conventions.

### Code Quality

- **Linting**: Follow **Biomejs** rules. Run `biome check --apply` before finalizing code.
- **Imports**: Use absolute imports with `@/` prefix (e.g., `@/components/ui`, `@/lib/rag`).
- **Exports**: Use `export function ComponentName` (Named exports) instead of default exports.

### AI & RAG Patterns (LangChain + Ollama)

- **Local First**: Always use `Ollama` and `OllamaEmbeddings` classes.
- **Vector Specs**: Default to **768 dimensions** (nomic-embed-text).
- **Context Management**: Implement recursive character text splitting to respect local LLM context windows.
- **Streaming**: Implement LLM responses using ReadableStreams for Next.js UI responsiveness.
- **Retrieval**: Use SearXNG as a tool/retriever.

### Database & State

- **Migrations**: Always use `drizzle-kit` for schema changes.
- **Vector Search**: Use Drizzle's `cosineDistance` or `l2Distance` helpers for similarity queries.
- **Mutations**: Use **Server Actions** for all data mutations.
- **Data Fetching**: Use **Server Actions** for all data fetching. Call Server Actions directly from client components. Use React's `useOptimistic` for optimistic updates when needed.

### Caching & Performance

- **Redis Caching**: Cache aggressively using the Redis container whenever possible to reduce computation and improve response times.
- **Cache Targets**: Cache LLM responses, embedding vectors, search results, and frequently accessed database queries.
- **Cache Keys**: Use consistent, namespaced key patterns (e.g., `rag:embedding:{hash}`, `llm:response:{query_hash}`).
- **TTL Strategy**: Set appropriate time-to-live values based on data volatility (embeddings: long TTL, search results: shorter TTL).
- **Cache Invalidation**: Invalidate related cache entries when underlying data changes (e.g., clear embedding cache when documents are updated).
- **Graceful Degradation**: Implement fallback to direct computation if Redis is unavailable, but log warnings for monitoring.
- **Connection Pooling**: Reuse Redis connections via a singleton client instance to avoid connection overhead.

### Error Handling

- **Always Handle Errors**: Never let errors propagate unhandled. Use try-catch blocks, error boundaries, and proper error types.
- **Server Actions**: Return error objects with user-friendly messages from Server Actions. Use Zod for validation errors. Handle errors in client components when calling Server Actions.
- **Visual Feedback**: Always provide visual feedback in the UI when errors occur. Display error states using shadcn/ui components (e.g., `Alert`, `Toast`). Show error messages, loading states, and success confirmations.
- **Error Logging**: Log errors server-side for debugging, but expose only safe, user-friendly messages to the client.
- **Service Failures**: Handle service unavailability gracefully (Redis, Ollama, SearXNG) with clear user messaging and fallback behavior.

### UI & Styling

- **Consistency**: Use **shadcn/ui** components located in `@/components/ui`.
- **No CSS Modules**: Use Tailwind utility classes.
- **Optimistic UI**: Use React's `useOptimistic` for chat interfaces to ensure zero-latency perception.

### Environment & Configuration

- **Secrets Management**: Store all environment secrets and configuration in a `.env` file at the project root.
- **Never Commit Secrets**: Ensure `.env` is in `.gitignore`. Use `.env.example` as a template with placeholder values.
- **Validation**: Use **Zod** schemas to validate environment variables at application startup.
- **Type Safety**: Create typed environment variable accessors using validated schemas (e.g., `env.DATABASE_URL`).
- **Next.js Integration**: Use Next.js built-in environment variable support (prefix with `NEXT_PUBLIC_` for client-side access).

## 3. Project Structure

- `/app`: Next.js App Router (Pages and Server Actions).
- `/db`: Drizzle schema definitions and connection logic.
- `/lib/rag`: RAG chains, prompt templates, Ollama/SearXNG clients.
- `/lib/tools`: LLM tooling implementations.
- `/lib`: Any other business logic not explicitly mentioned here.
- `/components`: UI (in `/ui`) and Feature components (in `/features`).
- `/scripts`: Utility TypeScript files run via `tsx`.

## 4. Workflow Instructions

1. **Service Health**: Before suggesting code, verify the logic includes checks for local service availability (Redis/PG/Ollama).
2. **Schema First**: Define **Drizzle tables** before implementing logic.
3. **Modern Syntax**: Use the latest Next.js features (Server Actions, `useOptimistic`).
4. **Biome Commands**: When fixing linting errors, use Biome instead of ESLint.
