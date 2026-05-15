/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  // setupFiles runs BEFORE any module is imported in a test file.
  // This is where we set env vars that module-level guards read at load time
  // (JWT_SECRET, CSRF_SIGNING_KEY).
  setupFiles: ['<rootDir>/jest.setup.ts'],
  // Only transform project source — leave node_modules as-is.
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
}
