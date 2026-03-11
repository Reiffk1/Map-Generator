import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          if (id.includes('react-konva') || id.includes('konva') || id.includes('use-image')) {
            return 'canvas-editor';
          }

          if (
            id.includes('jspdf') ||
            id.includes('html2canvas') ||
            id.includes('dompurify')
          ) {
            return 'export-tools';
          }

          if (
            id.includes('framer-motion') ||
            id.includes('sonner') ||
            id.includes('react-resizable-panels')
          ) {
            return 'ui-vendor';
          }

          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|zustand)[\\/]/.test(id)) {
            return 'react-core';
          }

          return 'vendor';
        },
      },
    },
  },
});
