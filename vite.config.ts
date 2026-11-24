import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves this project from /chartunlocked/.
export default defineConfig({
  base: '/chartunlocked/',
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
