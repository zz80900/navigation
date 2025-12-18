/**
 * Unified response helper functions
 */

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Create JSON response
 * @param {Object} data - Response data
 * @param {number} status - HTTP status code
 * @returns {Response}
 */
export function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS,
        },
    });
}

/**
 * Create success response
 * @param {Object} data - Response data
 * @returns {Response}
 */
export function successResponse(data) {
    return jsonResponse({ success: true, data });
}

/**
 * Create error response
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @returns {Response}
 */
export function errorResponse(message, status = 400) {
    return jsonResponse({ success: false, error: message }, status);
}

/**
 * Handle CORS preflight request
 * @returns {Response}
 */
export function corsResponse() {
    return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
    });
}

/**
 * Create HTML response
 * @param {string} html - HTML content
 * @param {number} status - HTTP status code
 * @returns {Response}
 */
export function htmlResponse(html, status = 200) {
    return new Response(html, {
        status,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            ...CORS_HEADERS,
        },
    });
}
