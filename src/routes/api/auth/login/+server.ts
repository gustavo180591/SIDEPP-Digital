import { json, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import { verifyPassword, createSession } from '$lib/server/auth/utils';
import { invalidateSession } from '$lib/server/auth/utils';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress, request: { headers } }) => {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return json(
        { error: 'Email y contraseña son requeridos' },
        { status: 400 }
      );
    }

    // Buscar usuario por email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    // Verificar contraseña
    const isValidPassword = await verifyPassword(password, user.hash);
    if (!isValidPassword) {
      return json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    // Invalidar sesiones anteriores si es necesario
    // await invalidateAllSessions(user.id);

    // Crear nueva sesión
    const userAgent = headers.get('user-agent') || '';
    const ipAddress = getClientAddress().toString();
    
    const { token, expiresAt } = await createSession(user.id, userAgent, ipAddress);

    // Actualizar último inicio de sesión
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Establecer cookie de sesión
    cookies.set('session_token', token, {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      expires: expiresAt,
    });

    return json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Error en el inicio de sesión:', error);
    return json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
};
