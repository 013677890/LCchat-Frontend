import eslintConfig from '@electron-toolkit/eslint-config'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginVue from 'eslint-plugin-vue'
import tsParser from '@typescript-eslint/parser'
import vueParser from 'vue-eslint-parser'

export default [
  { ignores: ['**/node_modules', '**/dist', '**/out'] },
  eslintConfig,
  ...eslintPluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        ecmaFeatures: {
          jsx: true
        },
        extraFileExtensions: ['.vue']
      }
    }
  },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      parser: tsParser
    },
    rules: {
      'no-unused-vars': 'off'
    }
  },
  {
    files: ['**/*.d.ts', '**/*.vue'],
    rules: {
      'no-unused-vars': 'off'
    }
  },
  {
    files: ['**/*.{js,jsx,ts,tsx,vue}'],
    rules: {
      'vue/require-default-prop': 'off',
      'vue/multi-word-component-names': 'off'
    }
  },
  eslintConfigPrettier
]
