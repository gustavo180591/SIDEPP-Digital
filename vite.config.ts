import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	resolve: {
		// Configuración para manejar módulos de Node.js
		alias: {
			// Evitar que Vite intente procesar el archivo problemático de pdf-parse
			'pdf-parse': fileURLToPath(new URL('./src/lib/shims/pdf-parse.js', import.meta.url).href)
		}
	},
	optimizeDeps: {
		exclude: ['pdf-parse']
	},
	test: {
		// Configuración de pruebas (deshabilitadas en desarrollo)
		environment: 'node',
		exclude: [
			'**/node_modules/**',
			'**/dist/**',
			'**/cypress/**',
			'**/.{idea,git,cache,output,temp}/**',
			'**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
			'**/test/**', // Excluir directorios de prueba
		],
		coverage: {
			enabled: false
		}
	}
});
