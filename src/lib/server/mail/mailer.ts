import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// Configuración SMTP desde variables de entorno
const SMTP_HOST = process.env.SMTP_HOST || 'mail.sidepp2.com.ar';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_SECURE = process.env.SMTP_SECURE === 'true'; // true para 465, false para otros puertos
const SMTP_USER = process.env.SMTP_USER || 'sa@sidepp2.com.ar';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'SIDEPP Digital <sa@sidepp2.com.ar>';

// URL base de la aplicación
const APP_URL = process.env.ORIGIN || 'http://localhost:3000';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false // Para certificados self-signed del hosting
      }
    });
  }
  return transporter;
}

export async function sendPasswordResetEmail(email: string, token: string, userName?: string): Promise<boolean> {
  const resetUrl = `${APP_URL}/reset-password/${token}`;
  const name = userName || email.split('@')[0];

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Restablecer Contraseña - SIDEPP Digital</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%); border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">SIDEPP Digital</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Sistema de Gestión de Aportes Sindicales</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 22px; font-weight: 600;">Restablecer Contraseña</h2>

              <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Hola <strong>${name}</strong>,
              </p>

              <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta. Si no realizaste esta solicitud, puedes ignorar este correo.
              </p>

              <p style="margin: 0 0 30px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Para crear una nueva contraseña, haz clic en el siguiente botón:
              </p>

              <!-- Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px; box-shadow: 0 4px 6px rgba(185, 28, 28, 0.3);">
                      Restablecer Contraseña
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Este enlace expirará en <strong>1 hora</strong> por seguridad.
              </p>

              <p style="margin: 20px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:
              </p>

              <p style="margin: 10px 0 0; padding: 12px; background-color: #f3f4f6; border-radius: 6px; word-break: break-all;">
                <a href="${resetUrl}" style="color: #b91c1c; text-decoration: none; font-size: 13px;">${resetUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; color: #6b7280; font-size: 13px; text-align: center;">
                Este correo fue enviado automáticamente por SIDEPP Digital.<br>
                Por favor no respondas a este mensaje.
              </p>
              <p style="margin: 15px 0 0; color: #9ca3af; font-size: 12px; text-align: center;">
                © ${new Date().getFullYear()} SIDEPP Digital. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const textContent = `
Restablecer Contraseña - SIDEPP Digital

Hola ${name},

Recibimos una solicitud para restablecer la contraseña de tu cuenta en SIDEPP Digital.

Si no realizaste esta solicitud, puedes ignorar este correo.

Para crear una nueva contraseña, visita el siguiente enlace:
${resetUrl}

Este enlace expirará en 1 hora por seguridad.

---
Este correo fue enviado automáticamente por SIDEPP Digital.
Por favor no respondas a este mensaje.
  `;

  try {
    const transport = getTransporter();

    await transport.sendMail({
      from: SMTP_FROM,
      to: email,
      subject: 'Restablecer Contraseña - SIDEPP Digital',
      text: textContent,
      html: htmlContent
    });

    console.log(`✅ Email de reset enviado a: ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Error al enviar email de reset:', error);
    return false;
  }
}

// Verificar configuración SMTP
export async function verifySmtpConfig(): Promise<boolean> {
  try {
    const transport = getTransporter();
    await transport.verify();
    console.log('✅ Configuración SMTP verificada correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error en configuración SMTP:', error);
    return false;
  }
}
