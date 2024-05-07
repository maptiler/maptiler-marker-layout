module.exports = {
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  root: true,

  overrides: [
    {
      files: ['*.ts'],
      rules: {
        '@typescript-eslint/ban-ts-comment': 'off', // Disable the TypeScript directive rule
        '@typescript-eslint/no-unused-vars': 'off'
      },
    },
  ],
};