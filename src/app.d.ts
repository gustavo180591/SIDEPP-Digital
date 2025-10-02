// src/app.d.ts
// Esta declaración le dice a SvelteKit qué guarda en event.locals
declare global {
  namespace App {
    interface Locals {
      user?: {
        id: string;
        email: string;
        name?: string | null;
        role: 'ADMIN' | 'OPERATOR' | 'INTITUTION';
        institutionId?: string | null;
      };
    }

    // Para acceder a user desde load() en +layout/+page
    interface PageData {
      user?: Locals['user'];
    }

    // interface Error {}
    // interface Platform {}
    // interface PrivateEnv {}
    // interface PublicEnv {}
  }
}

export {};
