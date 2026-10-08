import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// 常规构建：dist/（用于网站部署）
// 离线单文件：vite build --mode single → dist-single/（全部资源内联，双击即用）
export default defineConfig(({ mode }) => {
  const single = mode === 'single'
  return {
    base: './',
    plugins: [vue(), tailwindcss(), ...(single ? [viteSingleFile()] : [])],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    build: single
      ? {
          outDir: 'dist-single',
          emptyOutDir: true,
          assetsInlineLimit: 100_000_000,
          chunkSizeWarningLimit: 100_000,
        }
      : {},
  }
})
