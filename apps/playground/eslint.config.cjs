module.exports = {
  // Flat ESLint config to satisfy ESLint v9+/v10 when run in CI or via global binaries.
  extends: ['next/core-web-vitals'],
  overrides: [
    {
      files: ['**/*.{ts,tsx,js,jsx}'],
      languageOptions: {
        parserOptions: {
          ecmaVersion: 2022,
          sourceType: 'module'
        }
      }
    }
  ]
};
