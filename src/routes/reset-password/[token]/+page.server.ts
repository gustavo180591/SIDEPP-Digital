import { fail, redirect, isRedirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { UserService } from '$lib/db/services/userService';

export const load: PageServerLoad = async ({ params }) => {
  const { token } = params;

  // Verificar si el token es válido
  const user = await UserService.findByResetToken(token);

  if (!user) {
    return {
      valid: false,
      error: 'El enlace ha expirado o no es válido. Por favor solicita uno nuevo.'
    };
  }

  return {
    valid: true,
    email: user.email
  };
};

export const actions: Actions = {
  default: async ({ request, params }) => {
    const { token } = params;
    const formData = await request.formData();
    const password = formData.get('password')?.toString();
    const confirmPassword = formData.get('confirmPassword')?.toString();

    // Validaciones
    if (!password || !confirmPassword) {
      return fail(400, {
        error: 'Todos los campos son requeridos'
      });
    }

    if (password !== confirmPassword) {
      return fail(400, {
        error: 'Las contraseñas no coinciden'
      });
    }

    if (password.length < 8) {
      return fail(400, {
        error: 'La contraseña debe tener al menos 8 caracteres'
      });
    }

    if (!/[A-Z]/.test(password)) {
      return fail(400, {
        error: 'La contraseña debe contener al menos una mayúscula'
      });
    }

    if (!/[a-z]/.test(password)) {
      return fail(400, {
        error: 'La contraseña debe contener al menos una minúscula'
      });
    }

    if (!/[0-9]/.test(password)) {
      return fail(400, {
        error: 'La contraseña debe contener al menos un número'
      });
    }

    try {
      const success = await UserService.resetPassword(token, password);

      if (!success) {
        return fail(400, {
          error: 'El enlace ha expirado o no es válido. Por favor solicita uno nuevo.'
        });
      }

      // Redirigir al login con mensaje de éxito
      throw redirect(303, '/login?reset=success');
    } catch (error) {
      // Re-throw redirects (SvelteKit 2.x)
      if (isRedirect(error)) throw error;

      console.error('Error en reset-password:', error);
      return fail(500, {
        error: 'Ocurrió un error. Por favor intenta de nuevo.'
      });
    }
  }
};
