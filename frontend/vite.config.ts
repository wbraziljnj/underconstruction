import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Produção no servidor: https://wbrazilsoftwares.com.br/underconstruction/
  base: '/underconstruction/',
  plugins: [react()],
  build: {
    outDir: '../deploy',
    assetsDir: 'assets',
    emptyOutDir: false
  },
  server: {
    port: 5173,
    host: true
  }
});
