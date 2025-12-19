/**
 * Navigation Page Logic
 * Handles data loading, search, and theme switching
 */

// Global state
let allData = [];
let currentUser = null;

// DOM Elements
const app = document.getElementById('app');
const searchInput = document.getElementById('searchInput');
const themeToggle = document.getElementById('themeToggle');
const userMenu = document.getElementById('userMenu');
const userMenuToggle = document.getElementById('userMenuToggle');
const userMenuDropdown = document.getElementById('userMenuDropdown');
const userMenuAdminLink = document.getElementById('userMenuAdminLink');
const userLogoutBtn = document.getElementById('userLogoutBtn');

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    checkAuthAndLoadData();
    setupEventListeners();
});

/**
 * Initialize theme from localStorage or system preference
 */
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        setTheme(savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setTheme('dark');
    } else {
        setTheme('light');
    }
}

/**
 * Set theme and update UI
 * @param {string} theme - 'light' or 'dark'
 */
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    updateThemeToggle(theme);
}

/**
 * Toggle between light and dark theme
 */
function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'light' : 'dark');
}

function updateThemeToggle(theme) {
    if (!themeToggle) return;
    const isDark = theme === 'dark';
    themeToggle.textContent = isDark ? '🌞' : '🌙';
    themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Theme toggle
    themeToggle.addEventListener('click', toggleTheme);

    // Search input with debounce
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            filterLinks(e.target.value);
        }, 200);
    });

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            setTheme(e.matches ? 'dark' : 'light');
        }
    });

    if (userMenuToggle) {
        userMenuToggle.addEventListener('click', handleUserMenuToggleClick);
    }

    if (userLogoutBtn) {
        userLogoutBtn.addEventListener('click', logoutUser);
    }

    if (userMenuAdminLink) {
        userMenuAdminLink.addEventListener('click', () => {
            closeUserMenu();
        });
    }

    document.addEventListener('click', (event) => {
        if (!userMenu) return;
        if (!userMenu.contains(event.target)) {
            closeUserMenu();
        }
    });
}

/**
 * Check authentication and load data
 */
async function checkAuthAndLoadData() {
    const token = localStorage.getItem('token');

    if (!token) {
        // Not logged in, show login prompt
        showLoginPrompt();
        return;
    }

    try {
        // Verify token and get user info
        const authResponse = await fetch('/api/auth/check', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!authResponse.ok) {
            // Token invalid, clear and show login
            localStorage.removeItem('token');
            showLoginPrompt();
            return;
        }

        const authResult = await authResponse.json();
        currentUser = authResult.data;

        // Update user link to show username
        updateUserMenu();

        // Load navigation data
        await loadData();
    } catch (error) {
        console.error('Auth check error:', error);
        showLoginPrompt();
    }
}

/**
 * Update user menu button and dropdown
 */
function updateUserMenu() {
    if (!userMenuToggle) return;

    if (currentUser) {
        userMenuToggle.textContent = currentUser.username;
        userMenuToggle.classList.add('is-auth');
        if (userMenu) {
            userMenu.classList.add('is-auth');
        }
    } else {
        userMenuToggle.textContent = 'Login';
        userMenuToggle.classList.remove('is-auth');
        if (userMenu) {
            userMenu.classList.remove('is-auth');
            userMenu.classList.remove('open');
        }
    }
}

function handleUserMenuToggleClick(event) {
    if (!currentUser) {
        window.location.href = '/login.html';
        return;
    }
    event.preventDefault();
    if (userMenu) {
        userMenu.classList.toggle('open');
    }
}

function closeUserMenu() {
    if (userMenu) {
        userMenu.classList.remove('open');
    }
}

function logoutUser() {
    localStorage.removeItem('token');
    currentUser = null;
    closeUserMenu();
    showLoginPrompt();
}

/**
 * Show login prompt when not authenticated
 */
function showLoginPrompt() {
    currentUser = null;
    updateUserMenu();
    app.innerHTML = `
        <div class="login-prompt">
            <p>Please login to view your navigation links</p>
            <a href="/login.html" class="login-btn">Login</a>
        </div>
    `;
}

/**
 * Load navigation data from API
 */
async function loadData() {
    const token = localStorage.getItem('token');

    try {
        const response = await fetch('/api/links', {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Failed to load data');
        }

        // Check if authenticated
        if (result.authenticated === false) {
            showLoginPrompt();
            return;
        }

        allData = result.data || [];

        if (allData.length === 0) {
            app.innerHTML = '<div class="empty">No links yet. Go to Admin to add some!</div>';
            return;
        }

        renderLinks(allData);
    } catch (error) {
        console.error('Load error:', error);
        app.innerHTML = '<div class="error">Failed to load data. Please refresh.</div>';
    }
}

/**
 * Render links grouped by category
 * @param {Array} data - Categories with links
 */
function renderLinks(data) {
    let html = '';

    for (const category of data) {
        html += `
            <section class="category" data-category-id="${category.id}">
                <h2 class="category-title">${escapeHtml(category.name)}</h2>
                <div class="link-grid">
        `;

        for (const link of category.links) {
            // Use configured icon, or default icon if empty
            const iconUrl = link.icon || '/default_logo_icon.svg';
            // Generate fallback SVG with first letter
            const fallbackSvg = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%232196F3%22 width=%22100%22 height=%22100%22 rx=%2210%22/><text x=%2250%22 y=%2265%22 font-size=%2250%22 text-anchor=%22middle%22 fill=%22white%22>${escapeHtml(link.name.charAt(0).toUpperCase())}</text></svg>`;
            html += `
                <a href="${escapeHtml(link.url)}"
                   class="link-card"
                   target="_blank"
                   rel="noopener noreferrer"
                   data-url="${escapeHtml(link.url)}"
                   data-name="${escapeHtml(link.name.toLowerCase())}">
                    <img class="link-icon"
                         src="${escapeHtml(iconUrl)}"
                         alt="${escapeHtml(link.name)}"
                         onerror="this.onerror=null;this.src='${fallbackSvg}'">
                    <span class="link-name">${escapeHtml(link.name)}</span>
                </a>
            `;
        }

        html += `
                </div>
            </section>
        `;
    }

    app.innerHTML = html;
}

/**
 * Filter links based on search query
 * @param {string} query - Search query
 */
function filterLinks(query) {
    const normalizedQuery = query.toLowerCase().trim();
    const categories = document.querySelectorAll('.category');
    let hasResults = false;

    categories.forEach(category => {
        const links = category.querySelectorAll('.link-card');
        let categoryHasVisible = false;

        links.forEach(link => {
            const name = link.getAttribute('data-name') || '';
            const url = link.getAttribute('data-url') || '';

            if (normalizedQuery === '' ||
                name.includes(normalizedQuery) ||
                url.toLowerCase().includes(normalizedQuery)) {
                link.classList.remove('hidden');
                categoryHasVisible = true;
            } else {
                link.classList.add('hidden');
            }
        });

        if (categoryHasVisible) {
            category.classList.remove('hidden');
            hasResults = true;
        } else {
            category.classList.add('hidden');
        }
    });

    // Show no results message
    const existingNoResults = document.querySelector('.no-results');
    if (existingNoResults) {
        existingNoResults.remove();
    }

    if (!hasResults && normalizedQuery !== '') {
        const noResults = document.createElement('div');
        noResults.className = 'no-results';
        noResults.textContent = `No results for "${query}"`;
        app.appendChild(noResults);
    }
}

/**
 * Get favicon URL for a given website URL
 * @param {string} url - Website URL
 * @returns {string} - Favicon URL
 */
function getFaviconUrl(url) {
    try {
        const hostname = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
    } catch {
        return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%232196F3" width="100" height="100" rx="10"/><text x="50" y="65" font-size="50" text-anchor="middle" fill="white">?</text></svg>';
    }
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
