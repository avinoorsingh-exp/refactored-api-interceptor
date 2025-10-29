// babel.config.cjs (root)
module.exports = {
  sourceType: 'unambiguous',     // <-- lets Babel parse both ESM & CJS automatically
  presets: [
    ['@babel/preset-env', {
      targets: { node: '20' },
      modules: 'commonjs',       // <-- rewrite ESM to CJS for Jest 29
    }],
  ],
};
