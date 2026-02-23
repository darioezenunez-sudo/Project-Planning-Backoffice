module.exports = {
  '*.{ts,tsx}': ['next lint --fix --file', 'prettier --write'],
  '*.{json,md,css}': ['prettier --write'],
};
