/**
 * Admin API handlers - authentication required
 */

import { jsonResponse, errorResponse } from '../utils/response.js';
import { hashPassword, verifyPassword } from '../utils/crypto.js';

/**
 * Handle admin API requests
 * @param {Request} request
 * @param {Object} env
 * @param {string} path
 * @param {Object} user - Authenticated user from JWT
 * @returns {Promise<Response>}
 */
export async function handleAdminAPI(request, env, path, user) {
    const method = request.method;

    // ============ Category Management ============

    const userId = user.userId;

    // POST /api/admin/categories - Create category
    if (path === '/api/admin/categories' && method === 'POST') {
        try {
            const body = await request.json();
            const { name, sort_order = 0 } = body;

            if (!name) {
                return errorResponse('Category name is required', 400);
            }

            const result = await env.DB.prepare(
                'INSERT INTO categories (user_id, name, sort_order) VALUES (?, ?, ?)'
            ).bind(userId, name, sort_order).run();

            return jsonResponse({
                success: true,
                data: { id: result.meta.last_row_id },
            });
        } catch (e) {
            return errorResponse('Failed to create category: ' + e.message, 500);
        }
    }

    // GET /api/admin/categories - Get user's categories
    if (path === '/api/admin/categories' && method === 'GET') {
        try {
            const result = await env.DB.prepare(
                'SELECT * FROM categories WHERE user_id = ? ORDER BY sort_order ASC'
            ).bind(userId).all();
            return jsonResponse({ success: true, data: result.results });
        } catch (e) {
            return errorResponse('Failed to get categories: ' + e.message, 500);
        }
    }

    // PUT /api/admin/categories/:id - Update category (only own)
    const categoryMatch = path.match(/^\/api\/admin\/categories\/(\d+)$/);
    if (categoryMatch && method === 'PUT') {
        try {
            const id = categoryMatch[1];
            const body = await request.json();
            const { name, sort_order } = body;

            if (!name) {
                return errorResponse('Category name is required', 400);
            }

            // Only update if belongs to current user
            const result = await env.DB.prepare(
                'UPDATE categories SET name = ?, sort_order = ? WHERE id = ? AND user_id = ?'
            ).bind(name, sort_order || 0, id, userId).run();

            if (result.meta.changes === 0) {
                return errorResponse('Category not found or access denied', 404);
            }

            return jsonResponse({ success: true });
        } catch (e) {
            return errorResponse('Failed to update category: ' + e.message, 500);
        }
    }

    // DELETE /api/admin/categories/:id - Delete category (only own)
    if (categoryMatch && method === 'DELETE') {
        try {
            const id = categoryMatch[1];

            // Verify ownership first
            const category = await env.DB.prepare(
                'SELECT id FROM categories WHERE id = ? AND user_id = ?'
            ).bind(id, userId).first();

            if (!category) {
                return errorResponse('Category not found or access denied', 404);
            }

            // Delete all links in this category first
            await env.DB.prepare('DELETE FROM links WHERE category_id = ? AND user_id = ?').bind(id, userId).run();
            await env.DB.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?').bind(id, userId).run();

            return jsonResponse({ success: true });
        } catch (e) {
            return errorResponse('Failed to delete category: ' + e.message, 500);
        }
    }

    // ============ Link Management ============

    // POST /api/admin/links - Create link
    if (path === '/api/admin/links' && method === 'POST') {
        try {
            const body = await request.json();
            const { category_id, name, url, icon = '', sort_order = 0 } = body;

            if (!category_id || !name || !url) {
                return errorResponse('category_id, name, and url are required', 400);
            }

            // Verify category belongs to current user
            const category = await env.DB.prepare(
                'SELECT id FROM categories WHERE id = ? AND user_id = ?'
            ).bind(category_id, userId).first();

            if (!category) {
                return errorResponse('Category not found or access denied', 404);
            }

            const result = await env.DB.prepare(
                'INSERT INTO links (user_id, category_id, name, url, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
            ).bind(userId, category_id, name, url, icon, sort_order).run();

            return jsonResponse({
                success: true,
                data: { id: result.meta.last_row_id },
            });
        } catch (e) {
            return errorResponse('Failed to create link: ' + e.message, 500);
        }
    }

    // GET /api/admin/links - Get user's links
    if (path === '/api/admin/links' && method === 'GET') {
        try {
            const result = await env.DB.prepare(
                `SELECT l.*, c.name as category_name
                 FROM links l
                 JOIN categories c ON l.category_id = c.id
                 WHERE l.user_id = ?
                 ORDER BY c.sort_order ASC, l.sort_order ASC`
            ).bind(userId).all();
            return jsonResponse({ success: true, data: result.results });
        } catch (e) {
            return errorResponse('Failed to get links: ' + e.message, 500);
        }
    }

    // PUT /api/admin/links/:id - Update link (only own)
    const linkMatch = path.match(/^\/api\/admin\/links\/(\d+)$/);
    if (linkMatch && method === 'PUT') {
        try {
            const id = linkMatch[1];
            const body = await request.json();
            const { category_id, name, url, icon, sort_order } = body;

            if (!category_id || !name || !url) {
                return errorResponse('category_id, name, and url are required', 400);
            }

            // Verify category belongs to current user
            const category = await env.DB.prepare(
                'SELECT id FROM categories WHERE id = ? AND user_id = ?'
            ).bind(category_id, userId).first();

            if (!category) {
                return errorResponse('Category not found or access denied', 404);
            }

            // Only update if link belongs to current user
            const result = await env.DB.prepare(
                `UPDATE links SET
                    category_id = ?, name = ?, url = ?, icon = ?, sort_order = ?
                WHERE id = ? AND user_id = ?`
            ).bind(category_id, name, url, icon || '', sort_order || 0, id, userId).run();

            if (result.meta.changes === 0) {
                return errorResponse('Link not found or access denied', 404);
            }

            return jsonResponse({ success: true });
        } catch (e) {
            return errorResponse('Failed to update link: ' + e.message, 500);
        }
    }

    // DELETE /api/admin/links/:id - Delete link (only own)
    if (linkMatch && method === 'DELETE') {
        try {
            const id = linkMatch[1];
            const result = await env.DB.prepare(
                'DELETE FROM links WHERE id = ? AND user_id = ?'
            ).bind(id, userId).run();

            if (result.meta.changes === 0) {
                return errorResponse('Link not found or access denied', 404);
            }

            return jsonResponse({ success: true });
        } catch (e) {
            return errorResponse('Failed to delete link: ' + e.message, 500);
        }
    }

    // ============ Password Management ============

    // PUT /api/admin/password - Change own password
    if (path === '/api/admin/password' && method === 'PUT') {
        try {
            const body = await request.json();
            const { old_password, new_password } = body;

            if (!old_password || !new_password) {
                return errorResponse('Old and new passwords are required', 400);
            }

            if (new_password.length < 6) {
                return errorResponse('New password must be at least 6 characters', 400);
            }

            // Get current user
            const userRecord = await env.DB.prepare(
                'SELECT password_hash FROM users WHERE id = ?'
            ).bind(userId).first();

            if (!userRecord) {
                return errorResponse('User not found', 404);
            }

            // Verify old password
            const valid = await verifyPassword(old_password, userRecord.password_hash);
            if (!valid) {
                return errorResponse('Old password is incorrect', 400);
            }

            // Update password
            const newHash = await hashPassword(new_password);
            await env.DB.prepare(
                'UPDATE users SET password_hash = ? WHERE id = ?'
            ).bind(newHash, userId).run();

            return jsonResponse({ success: true, message: 'Password updated' });
        } catch (e) {
            return errorResponse('Failed to change password: ' + e.message, 500);
        }
    }

    // ============ User Management (Super Admin Only, userId=1) ============

    const isSuperAdmin = userId === 1;

    // GET /api/admin/users - Get all users (super admin only)
    if (path === '/api/admin/users' && method === 'GET') {
        if (!isSuperAdmin) {
            return errorResponse('Access denied - Super admin only', 403);
        }

        try {
            const result = await env.DB.prepare(
                'SELECT id, username, status, created_at FROM users ORDER BY id ASC'
            ).all();
            return jsonResponse({ success: true, data: result.results });
        } catch (e) {
            return errorResponse('Failed to get users: ' + e.message, 500);
        }
    }

    // POST /api/admin/users - Create user (super admin only)
    if (path === '/api/admin/users' && method === 'POST') {
        if (!isSuperAdmin) {
            return errorResponse('Access denied - Super admin only', 403);
        }

        try {
            const body = await request.json();
            const { username, password } = body;

            if (!username || !password) {
                return errorResponse('Username and password are required', 400);
            }

            if (username.length < 3) {
                return errorResponse('Username must be at least 3 characters', 400);
            }

            if (password.length < 6) {
                return errorResponse('Password must be at least 6 characters', 400);
            }

            // Check if username exists
            const existing = await env.DB.prepare(
                'SELECT id FROM users WHERE username = ?'
            ).bind(username).first();

            if (existing) {
                return errorResponse('Username already exists', 400);
            }

            const passwordHash = await hashPassword(password);
            const result = await env.DB.prepare(
                'INSERT INTO users (username, password_hash, status) VALUES (?, ?, 1)'
            ).bind(username, passwordHash).run();

            return jsonResponse({
                success: true,
                data: { id: result.meta.last_row_id },
            });
        } catch (e) {
            return errorResponse('Failed to create user: ' + e.message, 500);
        }
    }

    // User management by ID
    const userMatch = path.match(/^\/api\/admin\/users\/(\d+)$/);

    // PUT /api/admin/users/:id - Update user (super admin only)
    if (userMatch && method === 'PUT') {
        if (!isSuperAdmin) {
            return errorResponse('Access denied - Super admin only', 403);
        }

        try {
            const targetUserId = parseInt(userMatch[1]);
            const body = await request.json();
            const { status, new_password } = body;

            // Cannot modify super admin status
            if (targetUserId === 1 && status !== undefined) {
                return errorResponse('Cannot modify super admin status', 400);
            }

            // Update status if provided
            if (status !== undefined) {
                await env.DB.prepare(
                    'UPDATE users SET status = ? WHERE id = ?'
                ).bind(status ? 1 : 0, targetUserId).run();
            }

            // Update password if provided
            if (new_password) {
                if (new_password.length < 6) {
                    return errorResponse('Password must be at least 6 characters', 400);
                }
                const passwordHash = await hashPassword(new_password);
                await env.DB.prepare(
                    'UPDATE users SET password_hash = ? WHERE id = ?'
                ).bind(passwordHash, targetUserId).run();
            }

            return jsonResponse({ success: true });
        } catch (e) {
            return errorResponse('Failed to update user: ' + e.message, 500);
        }
    }

    // DELETE /api/admin/users/:id - Delete user (super admin only)
    if (userMatch && method === 'DELETE') {
        if (!isSuperAdmin) {
            return errorResponse('Access denied - Super admin only', 403);
        }

        try {
            const targetUserId = parseInt(userMatch[1]);

            // Cannot delete super admin
            if (targetUserId === 1) {
                return errorResponse('Cannot delete super admin', 400);
            }

            // Delete user's links and categories first
            await env.DB.prepare('DELETE FROM links WHERE user_id = ?').bind(targetUserId).run();
            await env.DB.prepare('DELETE FROM categories WHERE user_id = ?').bind(targetUserId).run();
            await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(targetUserId).run();

            return jsonResponse({ success: true });
        } catch (e) {
            return errorResponse('Failed to delete user: ' + e.message, 500);
        }
    }

    return errorResponse('Not found', 404);
}
