import { json, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import { hashPassword, createSession } from '$lib/server/auth/utils';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress, request: { headers } }) => {
  try {
    const { email, password, name } = await request.json();

    // Validación básica
    if (!email || !password) {
      return json(
        { error: 'Email y contraseña son requeridos' },
        { status: 400 }
      );
    }

    // Verificar si el usuario ya existe
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return json(
        { error: 'Ya existe un usuario con este correo electrónico' },
        { status: 409 }
      );
    }

    // Crear nuevo usuario
    const hashedPassword = await hashPassword(password);
    
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name: name || email.split('@')[0],
        hash: hashedPassword,
        role: 'VIEWER', // Rol por defecto, puede ser cambiado por un administrador
      },
    });

    // Crear sesión automáticamente después del registro
    const userAgent = headers.get('user-agent') || '';
    const ipAddress = getClientAddress().toString();
    
    const { token, expiresAt } = await createSession(user.id, userAgent, ipAddress);

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
    }, { status: 201 });
  } catch (error) {
    console.error('Error en el registro:', error);
    return json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
};
