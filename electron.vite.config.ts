import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer/src'),
        '@shared': resolve(__dirname, 'src/shared')
      }
    },
    plugins: [
      react(),
      {
        // Module scripts loaded from file:// fail the CORS check when they carry
        // a `crossorigin` attribute, so strip it from the generated HTML.
        name: 'opennotes:strip-crossorigin',
        transformIndexHtml: {
          order: 'post',
          handler: (html: string) => html.replace(/\s+crossorigin(?:="[^"]*")?/g, '')
        }
      }
    ],
    build: {
      minify: true,
      sourcemap: false,
      chunkSizeWarningLimit: 4096,
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') }
      }
    }
  }
})
