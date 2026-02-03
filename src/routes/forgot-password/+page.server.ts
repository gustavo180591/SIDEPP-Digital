import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { UserService } from '$lib/db/services/userService';
import { sendPasswordResetEmail } from '$lib/server/mail/mailer';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const actions: Actions = {
  default: async ({ request }) => {
    const formData = await request.formData();
    const email = formData.get('email')?.toString()?.trim();

    // Validar email
    if (!email) {
      return fail(400, {
        error: 'El email es requerido',
        email: ''
      });
    }

    if (!EMAIL_REGEX.test(email)) {
      return fail(400, {
        error: 'El formato del email no es válido',
        email
      });
    }

    try {
      // Generar token de reset
      const result = await UserService.generateResetToken(email);

      // Siempre mostrar éxito para no revelar si el email existe
      // (por seguridad, no revelar qué emails están registrados)
      if (result) {
        // Enviar email
        const emailSent = await sendPasswordResetEmail(
          result.user.email,
          result.token,
          result.user.name || undefined
        );

        if (!emailSent) {
          console.error('Error al enviar email de reset a:', email);
          // Aún así mostrar éxito por seguridad
        }
      } else {
        console.log('Intento de reset para email no registrado:', email);
      }

      return {
        success: true,
        message: 'Si el email está registrado, recibirás instrucciones para restablecer tu contraseña.'
      };
    } catch (error) {
      console.error('Error en forgot-password:', error);
      return fail(500, {
        error: 'Ocurrió un error. Por favor intenta de nuevo.',
        email
      });
    }
  }
};
