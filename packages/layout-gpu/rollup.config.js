import { uglify } from 'rollup-plugin-uglify';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import bundleSize from 'rollup-plugin-bundle-size';

module.exports = [{
  input: 'src/index.ts',
  output: {
    file: 'dist/layout-gpu.min.js',
    name: 'layout-gpu',
    format: 'umd',
    sourcemap: true,
  },
  plugins: [
    resolve(),
    commonjs({
      include: 'node_modules/**'
    }),
    typescript(),
    uglify(),
    bundleSize()
  ],
}];
