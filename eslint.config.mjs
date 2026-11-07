import js from '@eslint/js';
import ts from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
import sonar from 'eslint-plugin-sonarjs';

export default ts.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', '.baseline-*/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': hooks, sonarjs: sonar },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'sonarjs/cognitive-complexity': ['error', 15],
      complexity: ['error', 10],
      'max-depth': ['error', 3],
      'max-len': ['error', { code: 120, ignoreStrings: true, ignoreTemplateLiterals: true, ignoreUrls: true }],
    },
  },
);
