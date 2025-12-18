/**
 * Public API handlers - requires authentication to see data
 */

import { jsonResponse, errorResponse } from '../utils/response.js';

/**
 * Handle public API requests
 * @param {Request} request
 * @param {Object} env
 * @param {string} path
 * @param {Object|null} user - Authenticated user from JWT (null if not logged in)
 * @returns {Promise<Response>}
 */
export async function handlePublicAPI(request, env, path, user) {
    if (request.method !== 'GET') {
        return errorResponse('Method not allowed', 405);
    }

    // If not logged in, return empty data
    if (!user) {
        return jsonResponse({ success: true, data: [], authenticated: false });
    }

    const userId = user.userId;

    // GET /api/categories - Get user's categories
    if (path === '/api/categories') {
        try {
            const result = await env.DB.prepare(
                'SELECT id, name, sort_order FROM categories WHERE user_id = ? ORDER BY sort_order ASC'
            ).bind(userId).all();
            return jsonResponse({ success: true, data: result.results, authenticated: true });
        } catch (e) {
            return errorResponse('Database error: ' + e.message, 500);
        }
    }

    // GET /api/links - Get user's links grouped by category
    if (path === '/api/links') {
        try {
            const url = new URL(request.url);
            const categoryId = url.searchParams.get('category_id');

            let query = `
                SELECT l.id, l.name, l.url, l.icon, l.sort_order,
                       c.id as category_id, c.name as category_name, c.sort_order as category_sort
                FROM links l
                JOIN categories c ON l.category_id = c.id
                WHERE l.user_id = ?
            `;

            let result;
            if (categoryId) {
                query += ` AND l.category_id = ? ORDER BY l.sort_order ASC`;
                result = await env.DB.prepare(query).bind(userId, categoryId).all();
                return jsonResponse({ success: true, data: result.results, authenticated: true });
            } else {
                query += ` ORDER BY c.sort_order ASC, l.sort_order ASC`;
                result = await env.DB.prepare(query).bind(userId).all();

                // Group by category
                const grouped = {};
                for (const link of result.results) {
                    if (!grouped[link.category_id]) {
                        grouped[link.category_id] = {
                            id: link.category_id,
                            name: link.category_name,
                            sort_order: link.category_sort,
                            links: [],
                        };
                    }
                    grouped[link.category_id].links.push({
                        id: link.id,
                        name: link.name,
                        url: link.url,
                        icon: link.icon,
                        sort_order: link.sort_order,
                    });
                }

                // Sort by category sort_order and return as array
                const data = Object.values(grouped).sort(
                    (a, b) => a.sort_order - b.sort_order
                );
                return jsonResponse({ success: true, data, authenticated: true });
            }
        } catch (e) {
            return errorResponse('Database error: ' + e.message, 500);
        }
    }

    return errorResponse('Not found', 404);
}
