import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    core: 'src/core.ts',
    workflow: 'src/workflow.ts',
    visualize: 'src/visualize/index.ts',
    batch: 'src/batch.ts',
    resource: 'src/resource.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  minify: true,
});



