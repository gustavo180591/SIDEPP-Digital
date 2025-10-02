import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
    // Pasar el usuario solo cuando sea necesario
    return {
        user: locals.user
    };
};
