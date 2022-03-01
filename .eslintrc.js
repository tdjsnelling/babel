module.exports = {
  extends: ["eslint:recommended", "plugin:prettier/recommended"],
  env: {
    es6: true,
    node: true,
  },
  parserOptions: {
    sourceType: "module",
    ecmaVersion: 2020,
  },
};
