module.exports = {
  roots: ['<rootDir>/apps/web/tests'],
  testEnvironment: 'node',
  testMatch: ['<rootDir>/apps/web/tests/**/*.test.cjs'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/apps/web/src/$1',
    '^@app/database/src/(.*)$': '<rootDir>/packages/database/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        target: 'ES2022',
        module: 'CommonJS',
        jsx: 'react-jsx',
        esModuleInterop: true,
      },
      diagnostics: false,
    }],
  },
  clearMocks: true,
}
