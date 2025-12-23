import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      // Đặt base là './' để các file tài nguyên (css, js) nhận đường dẫn tương đối.
      // Điều này giúp web chạy được dù bạn đặt tên repo GitHub là gì.
      base: './', 
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
          // Replaced __dirname with process.cwd() to fix TypeScript error
          '@': path.resolve(process.cwd()), 
        }
      },
      build: {
        outDir: 'dist',
      }
    };
});