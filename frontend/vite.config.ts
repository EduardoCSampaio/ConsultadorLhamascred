// filepath: c:\Users\Eduardo\Desktop\SistemaConsultas\frontend\vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist', // Isso garantirá que o output vá para frontend/dist
  }
});