/**
 * Crypto utility functions for password hashing
 * Uses PBKDF2 with SHA-256 for secure password hashing
 */

// PBKDF2 configuration
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const HASH_LENGTH = 32;

/**
 * Generate random salt
 * @returns {Uint8Array}
 */
function generateSalt() {
    return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

/**
 * Convert Uint8Array to hex string
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert hex string to Uint8Array
 * @param {string} hex
 * @returns {Uint8Array}
 */
function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

/**
 * Hash password using PBKDF2-SHA256
 * @param {string} password - Plain text password
 * @param {Uint8Array} [salt] - Optional salt (generated if not provided)
 * @returns {Promise<string>} - Format: salt$hash (both hex encoded)
 */
export async function hashPassword(password, salt = null) {
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);

    // Generate salt if not provided
    if (!salt) {
        salt = generateSalt();
    }

    // Import password as key
    const key = await crypto.subtle.importKey(
        'raw',
        passwordData,
        'PBKDF2',
        false,
        ['deriveBits']
    );

    // Derive hash using PBKDF2
    const hashBuffer = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256'
        },
        key,
        HASH_LENGTH * 8
    );

    const hashBytes = new Uint8Array(hashBuffer);

    // Return salt$hash format
    return `${bytesToHex(salt)}$${bytesToHex(hashBytes)}`;
}

/**
 * Verify password against stored hash
 * @param {string} password - Plain text password
 * @param {string} storedHash - Stored hash in salt$hash format
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, storedHash) {
    try {
        // Handle legacy SHA-256 hashes (64 char hex without $)
        if (!storedHash.includes('$')) {
            const encoder = new TextEncoder();
            const data = encoder.encode(password);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const legacyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            return legacyHash === storedHash;
        }

        // Parse salt and hash from stored value
        const [saltHex, hashHex] = storedHash.split('$');
        const salt = hexToBytes(saltHex);

        // Hash the input password with the same salt
        const computedHash = await hashPassword(password, salt);

        // Compare hashes
        return computedHash === storedHash;
    } catch (e) {
        return false;
    }
}
