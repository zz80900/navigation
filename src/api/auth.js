/**
 * Authentication API handlers
 */

import { jsonResponse, errorResponse } from '../utils/response.js';
import { hashPassword, verifyPassword } from '../utils/crypto.js';
import { generateJWT, verifyJWT, extractToken } from '../auth.js';

/**
 * Handle authentication API requests
 * @param {Request} request
 * @param {Object} env
 * @param {string} path
 * @returns {Promise<Response>}
 */
export async function handleAuthAPI(request, env, path) {
    // POST /api/auth/login - User login
    if (path === '/api/auth/login' && request.method === 'POST') {
        try {
            const body = await request.json();
            const { username, password } = body;

            if (!username || !password) {
                return errorResponse('Username and password are required', 400);
            }

            // Find user
            const user = await env.DB.prepare(
                'SELECT id, username, password_hash, status FROM users WHERE username = ?'
            ).bind(username).first();

            if (!user) {
                return errorResponse('Invalid username or password', 401);
            }

            // Check if user is disabled
            if (user.status === 0) {
                return errorResponse('Account is disabled', 403);
            }

            // Verify password
            const valid = await verifyPassword(password, user.password_hash);
            if (!valid) {
                return errorResponse('Invalid username or password', 401);
            }

            // Generate JWT
            const token = await generateJWT(
                { userId: user.id, username: user.username },
                env
            );

            return jsonResponse({
                success: true,
                data: {
                    token,
                    user: { id: user.id, username: user.username },
                },
            });
        } catch (e) {
            return errorResponse('Login failed: ' + e.message, 500);
        }
    }

    // GET /api/auth/check - Verify token
    if (path === '/api/auth/check' && request.method === 'GET') {
        const token = extractToken(request);
        if (!token) {
            return errorResponse('No token provided', 401);
        }

        const payload = await verifyJWT(token, env);
        if (!payload) {
            return errorResponse('Invalid or expired token', 401);
        }

        return jsonResponse({
            success: true,
            data: { userId: payload.userId, username: payload.username },
        });
    }

    // POST /api/auth/logout - Logout (client-side token removal)
    if (path === '/api/auth/logout' && request.method === 'POST') {
        return jsonResponse({ success: true, message: 'Logged out' });
    }

    return errorResponse('Not found', 404);
}
