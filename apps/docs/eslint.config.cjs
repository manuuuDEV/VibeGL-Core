module.exports = {
  extends: ['next/core-web-vitals'],
  overrides: [
    {
      files: ['**/*.{ts,tsx,js,jsx}'],
      languageOptions: {
        parserOptions: { ecmaVersion: 2022, sourceType: 'module' }
      }
    }
  ]
};
