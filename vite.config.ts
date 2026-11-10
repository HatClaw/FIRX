import { defineConfig, type Plugin, type OutputBundle } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'node:fs';

// Para cPanel em https://canal360.run.place/grow use:
//   VITE_BASE=/grow/ npm run build
// Para raiz (Netlify etc.):
//   npm run build  (padrão /)
const base = process.env.VITE_BASE || '/';

function listPublicFiles(directory: string, prefix = ''): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? listPublicFiles(absolute, relative) : [relative];
  });
}

function cpanelMigrationManifest(): Plugin {
  return {
    name: 'cpanel-migration-manifest',
    generateBundle(_options, bundle: OutputBundle) {
      const extraFiles = ['.htaccess', 'api/.htaccess', 'api/smtp.php'].flatMap((name) => {
        const filePath = path.resolve(__dirname, 'public', name);
        if (!fs.existsSync(filePath)) return [];
        return [{ name, base64: fs.readFileSync(filePath).toString('base64') }];
      });
      const bundledFiles = [...Object.keys(bundle), ...listPublicFiles(path.resolve(__dirname, 'public'))].filter((name, index, all) =>
        all.indexOf(name) === index &&
        name !== 'migration-manifest.json' && !name.endsWith('.map') &&
        !['.htaccess', 'api/.htaccess', 'api/smtp.php'].includes(name)
      ).sort();
      this.emitFile({
        type: 'asset',
        fileName: 'migration-manifest.json',
        source: JSON.stringify({ format: 'growmoney-cpanel-migration', version: 1, base, files: bundledFiles, extraFiles }),
      });
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), cpanelMigrationManifest()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  build: {
    outDir: 'dist',
    // Avoid shipping browser-readable source maps to the public static host.
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          router: ['react-router-dom'],
          query: ['@tanstack/react-query'],
          charts: ['recharts'],
          ui: ['lucide-react', 'class-variance-authority', 'clsx'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});

