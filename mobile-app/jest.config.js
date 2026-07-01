/**
 * Jest config for pure-logic unit tests (no React Native / Expo runtime).
 * Scoped to `*.test.ts` under services/ — modules under test must not import RN/WatermelonDB.
 * ts-jest compiles the TS standalone with a CommonJS override so we don't inherit the Expo/JSX tsconfig.
 */
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/services/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        isolatedModules: true,
        tsconfig: { module: 'commonjs', esModuleInterop: true, skipLibCheck: true, strict: true },
      },
    ],
  },
};
