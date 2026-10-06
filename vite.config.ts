import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  server: { port: 5173, host: true },
  build: {
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        // 파이어베이스는 자주 바뀌지 않으므로 따로 묶어 브라우저 캐시를 오래 쓰게 한다
        advancedChunks: {
          groups: [
            // 단, 사진 올릴 때만 쓰는 storage 는 빼서 필요할 때 따로 불러온다
            { name: 'firebase', test: /node_modules[\\/](@firebase[\\/](?!storage)|firebase[\\/](?!storage))/ },
            { name: 'react', test: /node_modules[\/](react|react-dom|react-router|react-router-dom|scheduler)[\/]/ },
          ],
        },
      },
    },
  },
});
