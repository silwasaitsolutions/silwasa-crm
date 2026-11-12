// Deterministic env for tests; no real database is touched.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.SESSION_SECRET = "x".repeat(48);
process.env.ENCRYPTION_KEY = "a".repeat(64);
process.env.CORS_ORIGINS = "http://localhost:3000";
