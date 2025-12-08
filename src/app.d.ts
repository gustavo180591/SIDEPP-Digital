// src/app.d.ts
// Esta declaración le dice a SvelteKit qué guarda en event.locals
declare global {
  namespace App {
    interface UserInstitution {
      id: string;
      name: string | null;
    }

    interface Locals {
      user?: {
        id: string;
        email: string;
        name?: string | null;
        role: 'ADMIN' | 'FINANZAS' | 'LIQUIDADOR';
        institutions: UserInstitution[];
        // Para compatibilidad temporal - primera institución si hay
        institutionId?: string | null;
        institutionName?: string | null;
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
