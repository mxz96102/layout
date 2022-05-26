module.exports = {
  testEnvironment: 'jsdom',
  preset: 'ts-jest',
  collectCoverage: false,
  collectCoverageFrom: ['src/**/*.{ts,js}', '!**/node_modules/**', '!**/vendor/**'],
  // testRegex: '__tests__/.*-spec\\.ts?$',
  testRegex: '__tests__/.*test\\.ts?$',
  moduleDirectories: ['node_modules', 'src', 'es'],
  moduleFileExtensions: ['js', 'ts', 'json'],
  globals: {
    'ts-jest': {
      diagnostics: false,
    },
  },
};
