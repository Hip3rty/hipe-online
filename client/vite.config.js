import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // caminhos relativos: funciona no navegador e dentro do app Capacitor
  server: {
    port: 5173,
    // em desenvolvimento, /ws é encaminhado para o servidor local
    proxy: { '/ws': { target: 'ws://localhost:8080', ws: true }, '/api': 'http://localhost:8080' },
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 800,
  },
});
