import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
    // Pasar el usuario a todas las páginas del app
    const user = locals.user ? {
        id: locals.user.id,
        email: locals.user.email,
        name: locals.user.name,
        role: locals.user.role,
        institutionId: locals.user.institutionId
    } : null;

    return {
        user
    };
};
