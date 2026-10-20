import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // GitHub Pages serves project sites under /<repo>/; CI sets BASE_PATH.
  base: process.env.BASE_PATH ?? '/',
})
