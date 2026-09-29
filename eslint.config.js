// @ts-check
import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['dist/', 'coverage/', '.cache/'] },
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    // Con transporte stdio, stdout es el canal del protocolo MCP: solo se permite escribir en stderr.
    files: ['src/**/*.ts'],
    rules: { 'no-console': ['error', { allow: ['error', 'warn'] }] },
  },
  {
    // Archivos de configuración en JavaScript: fuera del proyecto TypeScript.
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
