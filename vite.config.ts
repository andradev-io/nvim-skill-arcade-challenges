import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// base "/" : the site lives at the root of its own (sub)domain.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
