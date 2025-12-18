/**
 * JWT Authentication module using Web Crypto API
 */

/**
 * Base64 URL encode
 * @param {string} str
 * @returns {string}
 */
function base64UrlEncode(str) {
    return btoa(str)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/**
 * Base64 URL decode
 * @param {string} str
 * @returns {string}
 */
function base64UrlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) {
        str += '=';
    }
    return atob(str);
}

/**
 * Generate JWT token
 * @param {Object} payload - Token payload
 * @param {Object} env - Environment variables
 * @returns {Promise<string>}
 */
export async function generateJWT(payload, env) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const tokenPayload = {
        ...payload,
        iat: now,
        exp: now + 86400 * 15, // 15 days
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(tokenPayload));
    const message = `${encodedHeader}.${encodedPayload}`;

    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(env.JWT_SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(message)
    );

    const encodedSignature = base64UrlEncode(
        String.fromCharCode(...new Uint8Array(signature))
    );

    return `${message}.${encodedSignature}`;
}

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @param {Object} env - Environment variables
 * @returns {Promise<Object|null>} - Decoded payload or null if invalid
 */
export async function verifyJWT(token, env) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            return null;
        }

        const [header, payload, signature] = parts;
        const message = `${header}.${payload}`;

        const key = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(env.JWT_SECRET),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
        );

        const signatureBytes = Uint8Array.from(
            base64UrlDecode(signature),
            c => c.charCodeAt(0)
        );

        const valid = await crypto.subtle.verify(
            'HMAC',
            key,
            signatureBytes,
            new TextEncoder().encode(message)
        );

        if (!valid) {
            return null;
        }

        const decodedPayload = JSON.parse(base64UrlDecode(payload));

        // Check expiration
        if (decodedPayload.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }

        return decodedPayload;
    } catch (e) {
        return null;
    }
}

/**
 * Extract token from Authorization header
 * @param {Request} request
 * @returns {string|null}
 */
export function extractToken(request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.substring(7);
}
