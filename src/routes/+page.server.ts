import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
    // Pasar el usuario a la página de inicio
    const user = locals.user ? {
        id: locals.user.id,
        email: locals.user.email,
        name: locals.user.name,
        role: locals.user.role
    } : null;

    return {
        user
    };
};
