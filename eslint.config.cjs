module.exports = [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        fetch: "readonly",
        process: "readonly",
        module: "readonly",
        require: "readonly",
      },
    },
    rules: {
      // Keep defaults light; surface obvious problems
      "no-undef": "error",
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-console": "off",
    },
  },
]
