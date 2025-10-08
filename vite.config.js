import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react'; // 1. Must import the plugin

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()], // 2. Must call the plugin to enable JSX processing
});