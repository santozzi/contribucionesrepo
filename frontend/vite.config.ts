import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // En `npm run dev` fuera de Docker, el backend corre aparte en :8080.
    proxy: { '/api': process.env.API_URL ?? 'http://localhost:8080' },
  },
});
