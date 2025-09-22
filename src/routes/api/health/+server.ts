import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';

export const GET = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return json({ ok: true });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'db error';
    return json({ ok: false, error: errorMessage }, { status: 500 });
  }
};
