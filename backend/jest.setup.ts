/**
 * Jest global setup - runs before any test module is imported.
 *
 * The module-level guards in auth.ts and csrf.ts throw at load time if these
 * env vars are missing.  Setting them here ensures the modules can be imported
 * in tests without hitting those guards.
 *
 * These values are test-only secrets and must NEVER be used in production.
 */
process.env.JWT_SECRET = 'test-jwt-secret-32chars-unit-tests-only!'
process.env.CSRF_SIGNING_KEY = 'test-csrf-signing-key-unit-tests-only!'
process.env.AZURE_STORAGE_ACCOUNT_NAME = 'teststorageaccount'
