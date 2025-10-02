module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['prettier'],
  extends: ['eslint:recommended', 'prettier'],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: [
    '.eslintrc.js',
    'dist/',
    'node_modules/',
    'prisma/migrations/',
  ],
  rules: {
    'no-unused-vars': 'off', // TypeScript handles this
    'no-console': 'off',
    'prettier/prettier': ['error', { endOfLine: 'auto' }],
  },
};
