import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        onstart(args) {
          if (process.env.ELECTRON_RUN_AS_NODE) {
            console.log('NOTE: Unsetting ELECTRON_RUN_AS_NODE to allow Electron API access')
            delete process.env.ELECTRON_RUN_AS_NODE
          }
          args.startup()
        },
        vite: {
          build: {
            target: 'node20',
            rollupOptions: {
              external: ['electron', 'ws', 'bufferutil', 'utf-8-validate', 'electron-updater'],
            },
          },
        },
      },
      preload: {
        input: path.join(__dirname, 'electron/preload.ts'),
      },
      renderer: process.env.NODE_ENV === 'test'
        ? undefined
        : {},
    }),
  ],
})
