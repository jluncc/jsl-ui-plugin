import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'scripts/content': 'src/content/index.ts',
    'scripts/options': 'src/options/index.ts',
    'scripts/background': 'src/background/index.ts',
  },
  outDir: 'dist',
  format: ['iife'],
  target: 'es2022',
  clean: true,
  outExtension: () => ({ js: '.js' }),
  onSuccess: async () => {
    const { cp, mkdir } = await import('node:fs/promises');
    await mkdir('dist', { recursive: true });
    await cp('static', 'dist', { recursive: true });
    await cp('src/styles', 'dist/styles', { recursive: true });
  },
});
