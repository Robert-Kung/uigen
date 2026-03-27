# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (localhost:3000) with Turbopack
npm run build        # Production build
npm run lint         # ESLint via Next.js
npm run test         # Run all tests with Vitest
npm run setup        # First-time setup: install deps + Prisma generate + migrate
npm run db:reset     # Reset database (destructive)
```

Run a single test file:
```bash
npx vitest src/components/editor/__tests__/file-tree.test.tsx
```

## Architecture Overview

UIGen is an AI-powered React component generator. Users chat with Claude AI, which generates React components that render live in an iframe — no files are ever written to disk.

### Three-Panel Layout

`src/app/main-content.tsx` is the root UI component with resizable panels:
- **Left (35%):** Chat interface (`src/components/chat/`)
- **Right (65%):** Toggle between live Preview (iframe) and Code view (file tree + Monaco editor)

### Data Flow

1. User submits prompt → `ChatContext` calls `/api/chat`
2. `/api/chat/route.ts` sends messages to Claude with two tools: `str_replace_editor` (file create/edit) and `file_manager` (file delete/rename)
3. Tool calls are streamed back and processed in `FileSystemContext`, updating the in-memory `VirtualFileSystem`
4. `PreviewFrame` detects file changes, uses `@babel/standalone` to transpile JSX, and renders in an iframe via `jsx-transformer.ts`
5. On completion, if user is authenticated + has a projectId, project is saved to SQLite via Prisma

### Key Abstractions

- **`VirtualFileSystem`** (`src/lib/file-system.ts`): In-memory file tree. All "files" live here — nothing on disk during a session.
- **`FileSystemContext`** (`src/lib/contexts/file-system-context.tsx`): React context wrapping VirtualFileSystem; receives tool call results from chat and triggers preview refresh.
- **`ChatContext`** (`src/lib/contexts/chat-context.tsx`): Wraps Vercel AI SDK's `useChat`, calls `/api/chat`, passes tool results to FileSystemContext.
- **`jsx-transformer.ts`** (`src/lib/transform/`): Builds the iframe HTML — creates import maps for React/Radix/etc., embeds transpiled code, handles dependency resolution for the preview.
- **`provider.ts`** (`src/lib/`): Returns a real Anthropic Claude model when `ANTHROPIC_API_KEY` is set, otherwise a `MockLanguageModel` that returns fixture responses.

### Authentication

JWT sessions via `jose` + `bcrypt`. `src/middleware.ts` protects `/api/projects` and `/api/filesystem`. Sessions stored in cookies with 7-day expiration (`src/lib/auth.ts`).

Anonymous users: work is tracked in localStorage via `src/lib/anon-work-tracker.ts` and can be claimed on sign-up.

### Database

Prisma with SQLite (`prisma/dev.db`). Schema defined in `prisma/schema.prisma` — always read it for authoritative data structure. Two models: `User` and `Project`. Projects store messages and virtual file system state as JSON strings in a single `data` column.

### System Prompt

The AI generation instructions are in `src/lib/prompts/generation.tsx`. This controls what Claude generates and which tools it uses.

## Environment

The only required env var is `ANTHROPIC_API_KEY` in `.env`. Without it, the app runs with a mock provider that returns static placeholder responses.

## Tech Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Prisma/SQLite · Vercel AI SDK · Anthropic Claude · Monaco Editor · Babel Standalone · Shadcn/ui (new-york style)
