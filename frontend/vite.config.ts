import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Fix COOP issues for Firebase Auth popups
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
    },
    // Enable HTTPS for better Firebase Auth compatibility (disabled for now)
    // https: true, // Enable this if you have SSL certificates
    port: 3000,
    host: true, // Allow external connections
  },
  // Optimize dependencies for Firebase
  optimizeDeps: {
    include: [
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
      'firebase/storage'
    ]
  },
  build: {
    // Ensure proper chunking for Firebase
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: [
            'firebase/app',
            'firebase/auth', 
            'firebase/firestore',
            'firebase/storage'
          ]
        }
      }
    }
  }
});
