const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

// Bundles the TypeORM CLI entry point (entities + migrations) the same way
// webpack.config.js bundles main.ts, so '@muixer/shared' gets inlined instead
// of staying an external require that doesn't exist in the production image.
module.exports = {
  output: {
    path: join(__dirname, '../../dist/apps/api/migrations-compiled'),
    filename: 'data-source.js',
    library: { type: 'commonjs2' },
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@muixer/shared': join(__dirname, '../../dist/libs/shared/index.js'),
    },
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/data-source.ts',
      tsConfig: './tsconfig.app.json',
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: false,
      sourceMap: false,
    }),
  ],
};
