const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022
      },
      ecmaVersion: 2022,
      sourceType: 'commonjs'
    },
    rules: {
      // Critical Errors Only
      'no-console': 'off', // Allow console.log for debugging
      'no-debugger': 'error',
      'no-unused-vars': ['warn', {
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_'
      }],

      // Best Practices (Essential)
      'eqeqeq': ['warn', 'always'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-return-assign': 'error',
      'no-throw-literal': 'error',
      'prefer-promise-reject-errors': 'warn',

      // Stylistic Issues (Relaxed)
      'comma-dangle': 'off', // Allow trailing commas
      'indent': 'off', // Disable strict indentation
      'linebreak-style': 'off', // Allow both CRLF and LF
      'no-trailing-spaces': 'warn', // Warn instead of error
      'quotes': 'off', // Allow both single and double quotes
      'semi': 'off', // Allow both with and without semicolons
      'space-before-function-paren': 'off', // Allow both styles
      'object-curly-spacing': 'off', // Allow both styles
      'array-bracket-spacing': 'off', // Allow both styles
      'comma-spacing': 'off', // Allow both styles
      'key-spacing': 'off', // Allow both styles
      'keyword-spacing': 'off', // Allow both styles
      'no-multiple-empty-lines': 'off', // Allow multiple empty lines
      'spaced-comment': 'off', // Allow both styles
      'brace-style': 'off', // Allow both styles
      'func-call-spacing': 'off', // Allow both styles
      'computed-property-spacing': 'off', // Allow both styles
      'space-before-blocks': 'off', // Allow both styles
      'space-in-parens': 'off', // Allow both styles
      'space-infix-ops': 'off', // Allow both styles
      'space-unary-ops': 'off', // Allow both styles
      'comma-style': 'off', // Allow both styles
      'no-useless-call': 'off', // Allow both styles
      'no-useless-concat': 'off', // Allow both styles
      'no-useless-return': 'off', // Allow both styles
      'no-sequences': 'off', // Allow both styles
      'no-unmodified-loop-condition': 'off', // Allow both styles
      'no-unused-expressions': 'off', // Allow both styles
      'radix': 'off', // Allow both styles
      'no-empty': 'warn' // Warn for empty blocks
    }
  },
  {
    files: ['**/*.test.js', '**/*.spec.js', '__tests__/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node
      }
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': 'off'
    }
  },
  {
    files: ['**/*.mjs', 'public/**/*.js'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        ...globals.browser,
        'window': 'readonly',
        'document': 'readonly',
        'navigator': 'readonly',
        'localStorage': 'readonly',
        'sessionStorage': 'readonly',
        'fetch': 'readonly',
        'WebSocket': 'readonly',
        'BroadcastChannel': 'readonly',
        'caches': 'readonly',
        'indexedDB': 'readonly',
        'Chart': 'readonly',
        'moment': 'readonly',
        'uuid': 'readonly',
        'QRCode': 'readonly',
        'adhan': 'readonly'
      }
    }
  }
];
