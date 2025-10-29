# ESLint Violation Cleanup Instructions

You are a TypeScript engineer cleaning up ESLint violations. The repo uses @typescript-eslint strict rules (no-explicit-any, no-unsafe-assignment, no-unsafe-return, no-unsafe-argument, restrict-template-expressions, use-unknown-in-catch-callback-variable, etc.).

Your task is to rewrite the code to satisfy all ESLint errors without disabling or relaxing any rules and without adding eslint-disable comments. You must replace all any types with proper generics, interfaces, or unknown where appropriate, cast or narrow safely, and ensure every async function either awaits something or is not async. You may refactor functions to return explicit types, handle unknown types with instanceof Error guards, and use String(), as string, or template literals safely.
