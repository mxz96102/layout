import { uglify } from 'rollup-plugin-uglify';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import bundleSize from 'rollup-plugin-bundle-size';

module.exports = [{
  input: 'src/index.ts',
  output: {
    file: 'dist/layout.min.js',
    name: 'layout',
    format: 'umd',
    sourcemap: true,
  },
  plugins: [
    resolve(),
    typescript(),
    uglify(),
    bundleSize()
  ],
}];
