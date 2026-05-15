/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Map @/ alias to the frontend root (mirrors tsconfig paths)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  // Run @testing-library/jest-dom matchers in every test file
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },
  // Ignore Next.js internals and node_modules
  transformIgnorePatterns: ['/node_modules/'],
  // Suppress noisy console output during tests
  silent: false,
}
