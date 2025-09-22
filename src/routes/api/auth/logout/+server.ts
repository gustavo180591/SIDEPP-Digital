import { json, type RequestHandler } from '@sveltejs/kit';
import { invalidateSession } from '$lib/server/auth/utils';

export const POST: RequestHandler = async ({ cookies }) => {
  const sessionToken = cookies.get('session_token');
  
  if (sessionToken) {
    await invalidateSession(sessionToken);
    cookies.delete('session_token', { path: '/' });
  }

  return json({ success: true });
};
