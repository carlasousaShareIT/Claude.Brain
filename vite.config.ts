import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/memory': 'http://localhost:7777',
      '/missions': 'http://localhost:7777',
      '/reminders': 'http://localhost:7777',
      '/experiments': 'http://localhost:7777',
      '/sessions': 'http://localhost:7777',
      '/locks': 'http://localhost:7777',
      '/agents': 'http://localhost:7777',
      '/orchestration': 'http://localhost:7777',
      '/audit': 'http://localhost:7777',
    },
  },
})
