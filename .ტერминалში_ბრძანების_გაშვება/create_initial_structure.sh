services/translation-session-service/
  src/
    index.ts              # Main Hono app setup, middleware
    routes.ts             # API routes definition
    controller.ts         # Request handlers/business logic
    model.ts              # TypeScript interfaces (TranslationSession, Payloads)
    db.ts                 # Supabase client and DB interaction functions
    middleware/           # Optional: for auth, logging
      auth.ts           # JWT validation middleware
      logger.ts         # Request logging middleware
  .env.example          # Example environment variables
  .gitignore
  package.json
  tsconfig.json
  bun.lockb 