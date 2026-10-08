const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expo,
  { ignores: ['dist/**', 'fixtures/generated/**', 'android/**', 'ios/**', '.venv-research/**', '.build-tools/**', 'research/fixtures/generated/**', 'research/results/generated/**'] },
]);
