/**
 * Login Page Logic
 */

// DOM Elements
const loginForm = document.getElementById('loginForm');
const errorMsg = document.getElementById('errorMsg');
const loginBtn = document.getElementById('loginBtn');

// Check if already logged in
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    checkAuth();
});

/**
 * Initialize theme
 */
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
}

/**
 * Check if user is already authenticated
 */
async function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const response = await fetch('/api/auth/check', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            // Already logged in, redirect to home
            window.location.href = '/';
        } else {
            // Token invalid, clear it
            localStorage.removeItem('token');
        }
    } catch (error) {
        console.error('Auth check error:', error);
    }
}

/**
 * Handle login form submission
 */
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
        showError('Please enter username and password');
        return;
    }

    // Disable button during request
    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';
    hideError();

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const result = await response.json();

        if (result.success) {
            // Save token and redirect to home
            localStorage.setItem('token', result.data.token);
            window.location.href = '/';
        } else {
            showError(result.error || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('Network error. Please try again.');
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
    }
});

/**
 * Show error message
 * @param {string} message
 */
function showError(message) {
    errorMsg.textContent = message;
    errorMsg.classList.add('show');
}

/**
 * Hide error message
 */
function hideError() {
    errorMsg.classList.remove('show');
}
