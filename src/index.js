/**
 * Cloudflare Worker Entry Point
 * Navigation Site with Admin Panel
 */

import { handlePublicAPI } from './api/public.js';
import { handleAdminAPI } from './api/admin.js';
import { handleAuthAPI } from './api/auth.js';
import { verifyJWT, extractToken } from './auth.js';
import { corsResponse, errorResponse } from './utils/response.js';

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return corsResponse();
        }

        // API Routes
        if (path.startsWith('/api/')) {
            // Public API - categories and links (requires authentication)
            if (path === '/api/categories' || path === '/api/links') {
                const token = extractToken(request);
                if (!token) {
                    // Not logged in, return empty data
                    return handlePublicAPI(request, env, path, null);
                }
                const payload = await verifyJWT(token, env);
                // Pass user info to public API (null if token invalid)
                return handlePublicAPI(request, env, path, payload);
            }

            // Auth API - login, logout, check
            if (path.startsWith('/api/auth/')) {
                return handleAuthAPI(request, env, path);
            }

            // Admin API - requires authentication
            if (path.startsWith('/api/admin/')) {
                const token = extractToken(request);
                if (!token) {
                    return errorResponse('Unauthorized - No token provided', 401);
                }

                const payload = await verifyJWT(token, env);
                if (!payload) {
                    return errorResponse('Unauthorized - Invalid or expired token', 401);
                }

                return handleAdminAPI(request, env, path, payload);
            }

            return errorResponse('API endpoint not found', 404);
        }

        // Static files are handled by Cloudflare Assets
        // This is a fallback for any unmatched routes
        return env.ASSETS.fetch(request);
    },
};
