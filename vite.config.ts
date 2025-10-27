import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      // Build as Multi-Page App so menu.html / game.html ถูกส่งออกไปด้วย
      build: {
        rollupOptions: {
          input: {
            main: path.resolve(__dirname, 'index.html'),
            menu: path.resolve(__dirname, 'menu.html'),
            game: path.resolve(__dirname, 'game.html'),
          }
        }
      }
    };
});
