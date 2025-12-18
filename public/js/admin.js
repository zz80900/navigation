/**
 * Admin Page Logic
 * Handles category and link CRUD operations
 */

// Global state
let categories = [];
let links = [];
let users = [];
let token = null;
let currentUser = null;
let isSuperAdmin = false;

// DOM Elements
const categoryList = document.getElementById('categoryList');
const linkTableBody = document.getElementById('linkTableBody');
const themeToggle = document.getElementById('themeToggle');
const logoutBtn = document.getElementById('logoutBtn');
const addCategoryBtn = document.getElementById('addCategoryBtn');
const addLinkBtn = document.getElementById('addLinkBtn');
const categoryModal = document.getElementById('categoryModal');
const linkModal = document.getElementById('linkModal');
const toast = document.getElementById('toast');

// User management elements
const userPanel = document.getElementById('userPanel');
const userList = document.getElementById('userList');
const addUserBtn = document.getElementById('addUserBtn');
const userModal = document.getElementById('userModal');
const passwordModal = document.getElementById('passwordModal');
const changePasswordBtn = document.getElementById('changePasswordBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    checkAuth();
    setupEventListeners();
});

/**
 * Initialize theme
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

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    themeToggle.textContent = theme === 'dark' ? 'Light' : 'Dark';
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'light' : 'dark');
}

/**
 * Check authentication
 */
async function checkAuth() {
    token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    try {
        const response = await fetch('/api/auth/check', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            localStorage.removeItem('token');
            window.location.href = '/login.html';
            return;
        }

        const result = await response.json();
        currentUser = result.data;
        isSuperAdmin = currentUser.userId === 1;

        // Show user panel if super admin
        if (isSuperAdmin) {
            userPanel.style.display = 'block';
            await loadUsers();
        }

        // Load data
        await loadCategories();
        await loadLinks();
    } catch (error) {
        console.error('Auth check error:', error);
        showToast('Authentication failed', 'error');
    }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Theme toggle
    themeToggle.addEventListener('click', toggleTheme);

    // Logout
    logoutBtn.addEventListener('click', logout);

    // Add buttons
    addCategoryBtn.addEventListener('click', () => openCategoryModal());
    addLinkBtn.addEventListener('click', () => openLinkModal());

    // User management buttons
    addUserBtn.addEventListener('click', () => openUserModal());
    changePasswordBtn.addEventListener('click', () => openPasswordModal());

    // Modal close buttons
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => {
            categoryModal.classList.remove('active');
            linkModal.classList.remove('active');
            userModal.classList.remove('active');
            passwordModal.classList.remove('active');
        });
    });

    // Modal overlay click to close
    [categoryModal, linkModal, userModal, passwordModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });

    // Save buttons
    document.getElementById('saveCategoryBtn').addEventListener('click', saveCategory);
    document.getElementById('saveLinkBtn').addEventListener('click', saveLink);
    document.getElementById('saveUserBtn').addEventListener('click', saveUser);
    document.getElementById('savePasswordBtn').addEventListener('click', savePassword);
}

/**
 * Logout
 */
function logout() {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
}

/**
 * API request helper
 */
async function apiRequest(url, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    return response.json();
}

// ============ Category Management ============

/**
 * Load categories
 */
async function loadCategories() {
    try {
        const result = await apiRequest('/api/admin/categories');
        if (result.success) {
            categories = result.data;
            renderCategories();
            updateCategorySelect();
        } else {
            showToast(result.error || 'Failed to load categories', 'error');
        }
    } catch (error) {
        console.error('Load categories error:', error);
        showToast('Failed to load categories', 'error');
    }
}

/**
 * Render category list
 */
function renderCategories() {
    if (categories.length === 0) {
        categoryList.innerHTML = '<li class="empty-state">No categories</li>';
        return;
    }

    categoryList.innerHTML = categories.map(cat => `
        <li class="category-item" data-id="${cat.id}">
            <span class="category-name">${escapeHtml(cat.name)}</span>
            <div class="category-actions">
                <button class="btn btn-secondary btn-sm" onclick="editCategory(${cat.id})">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deleteCategory(${cat.id})">Del</button>
            </div>
        </li>
    `).join('');
}

/**
 * Update category select in link modal
 */
function updateCategorySelect() {
    const select = document.getElementById('linkCategory');
    select.innerHTML = '<option value="">Select category...</option>' +
        categories.map(cat => `<option value="${cat.id}">${escapeHtml(cat.name)}</option>`).join('');
}

/**
 * Open category modal
 */
function openCategoryModal(category = null) {
    document.getElementById('categoryModalTitle').textContent = category ? 'Edit Category' : 'Add Category';
    document.getElementById('categoryId').value = category ? category.id : '';
    document.getElementById('categoryName').value = category ? category.name : '';
    document.getElementById('categorySortOrder').value = category ? category.sort_order : 0;
    categoryModal.classList.add('active');
}

/**
 * Edit category
 */
window.editCategory = function(id) {
    const category = categories.find(c => c.id === id);
    if (category) {
        openCategoryModal(category);
    }
};

/**
 * Save category
 */
async function saveCategory() {
    const id = document.getElementById('categoryId').value;
    const name = document.getElementById('categoryName').value.trim();
    const sort_order = parseInt(document.getElementById('categorySortOrder').value) || 0;

    if (!name) {
        showToast('Please enter category name', 'error');
        return;
    }

    try {
        let result;
        if (id) {
            result = await apiRequest(`/api/admin/categories/${id}`, 'PUT', { name, sort_order });
        } else {
            result = await apiRequest('/api/admin/categories', 'POST', { name, sort_order });
        }

        if (result.success) {
            showToast(id ? 'Category updated' : 'Category created', 'success');
            categoryModal.classList.remove('active');
            await loadCategories();
        } else {
            showToast(result.error || 'Failed to save category', 'error');
        }
    } catch (error) {
        console.error('Save category error:', error);
        showToast('Failed to save category', 'error');
    }
}

/**
 * Delete category
 */
window.deleteCategory = async function(id) {
    if (!confirm('Delete this category and all its links?')) {
        return;
    }

    try {
        const result = await apiRequest(`/api/admin/categories/${id}`, 'DELETE');
        if (result.success) {
            showToast('Category deleted', 'success');
            await loadCategories();
            await loadLinks();
        } else {
            showToast(result.error || 'Failed to delete category', 'error');
        }
    } catch (error) {
        console.error('Delete category error:', error);
        showToast('Failed to delete category', 'error');
    }
};

// ============ Link Management ============

/**
 * Load links
 */
async function loadLinks() {
    try {
        const result = await apiRequest('/api/admin/links');
        if (result.success) {
            links = result.data;
            renderLinks();
        } else {
            showToast(result.error || 'Failed to load links', 'error');
        }
    } catch (error) {
        console.error('Load links error:', error);
        showToast('Failed to load links', 'error');
    }
}

/**
 * Render link table
 */
function renderLinks() {
    if (links.length === 0) {
        linkTableBody.innerHTML = '<tr><td colspan="5" class="empty-state">No links</td></tr>';
        return;
    }

    linkTableBody.innerHTML = links.map(link => {
        // Use configured icon, or default icon if empty
        const iconUrl = link.icon || '/default_logo_icon.svg';
        // Generate fallback SVG with first letter
        const fallbackSvg = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%232196F3%22 width=%22100%22 height=%22100%22 rx=%2210%22/><text x=%2250%22 y=%2265%22 font-size=%2250%22 text-anchor=%22middle%22 fill=%22white%22>${escapeHtml(link.name.charAt(0).toUpperCase())}</text></svg>`;
        return `
            <tr data-id="${link.id}">
                <td class="link-icon-cell">
                    <img class="link-icon" src="${escapeHtml(iconUrl)}" alt=""
                         onerror="this.onerror=null;this.src='${fallbackSvg}'">
                </td>
                <td>${escapeHtml(link.name)}</td>
                <td><span class="link-url" title="${escapeHtml(link.url)}">${escapeHtml(link.url)}</span></td>
                <td>${escapeHtml(link.category_name)}</td>
                <td class="actions-cell">
                    <button class="btn btn-secondary btn-sm" onclick="editLink(${link.id})">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteLink(${link.id})">Del</button>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Open link modal
 */
function openLinkModal(link = null) {
    document.getElementById('linkModalTitle').textContent = link ? 'Edit Link' : 'Add Link';
    document.getElementById('linkId').value = link ? link.id : '';
    document.getElementById('linkCategory').value = link ? link.category_id : '';
    document.getElementById('linkName').value = link ? link.name : '';
    document.getElementById('linkUrl').value = link ? link.url : '';
    document.getElementById('linkIcon').value = link ? link.icon : '';
    document.getElementById('linkSortOrder').value = link ? link.sort_order : 0;
    linkModal.classList.add('active');
}

/**
 * Edit link
 */
window.editLink = function(id) {
    const link = links.find(l => l.id === id);
    if (link) {
        openLinkModal(link);
    }
};

/**
 * Save link
 */
async function saveLink() {
    const id = document.getElementById('linkId').value;
    const category_id = parseInt(document.getElementById('linkCategory').value);
    const name = document.getElementById('linkName').value.trim();
    const url = document.getElementById('linkUrl').value.trim();
    const icon = document.getElementById('linkIcon').value.trim();
    const sort_order = parseInt(document.getElementById('linkSortOrder').value) || 0;

    if (!category_id || !name || !url) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    try {
        let result;
        const data = { category_id, name, url, icon, sort_order };

        if (id) {
            result = await apiRequest(`/api/admin/links/${id}`, 'PUT', data);
        } else {
            result = await apiRequest('/api/admin/links', 'POST', data);
        }

        if (result.success) {
            showToast(id ? 'Link updated' : 'Link created', 'success');
            linkModal.classList.remove('active');
            await loadLinks();
        } else {
            showToast(result.error || 'Failed to save link', 'error');
        }
    } catch (error) {
        console.error('Save link error:', error);
        showToast('Failed to save link', 'error');
    }
}

/**
 * Delete link
 */
window.deleteLink = async function(id) {
    if (!confirm('Delete this link?')) {
        return;
    }

    try {
        const result = await apiRequest(`/api/admin/links/${id}`, 'DELETE');
        if (result.success) {
            showToast('Link deleted', 'success');
            await loadLinks();
        } else {
            showToast(result.error || 'Failed to delete link', 'error');
        }
    } catch (error) {
        console.error('Delete link error:', error);
        showToast('Failed to delete link', 'error');
    }
};

// ============ Utilities ============

/**
 * Get favicon URL
 */
function getFaviconUrl(url) {
    try {
        const hostname = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
    } catch {
        return '';
    }
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Show toast notification
 */
function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ============ User Management (Super Admin Only) ============

/**
 * Load users
 */
async function loadUsers() {
    if (!isSuperAdmin) return;

    try {
        const result = await apiRequest('/api/admin/users');
        if (result.success) {
            users = result.data;
            renderUsers();
        } else {
            showToast(result.error || 'Failed to load users', 'error');
        }
    } catch (error) {
        console.error('Load users error:', error);
        showToast('Failed to load users', 'error');
    }
}

/**
 * Render user list
 */
function renderUsers() {
    if (users.length === 0) {
        userList.innerHTML = '<li class="empty-state">No users</li>';
        return;
    }

    userList.innerHTML = users.map(user => {
        const isSelf = user.id === currentUser.userId;
        const isAdmin = user.id === 1;
        const statusClass = user.status === 1 ? 'status-active' : 'status-disabled';
        const statusText = user.status === 1 ? 'Active' : 'Disabled';

        return `
            <li class="user-item" data-id="${user.id}">
                <div class="user-info">
                    <span class="user-name">${escapeHtml(user.username)}${isAdmin ? ' (Admin)' : ''}</span>
                    <span class="user-status ${statusClass}">${statusText}</span>
                </div>
                <div class="user-actions">
                    ${!isAdmin ? `<button class="btn btn-secondary btn-sm" onclick="editUser(${user.id})">Edit</button>` : ''}
                    ${!isAdmin && !isSelf ? `<button class="btn btn-danger btn-sm" onclick="deleteUser(${user.id})">Del</button>` : ''}
                </div>
            </li>
        `;
    }).join('');
}

/**
 * Open user modal
 */
function openUserModal(user = null) {
    const isEdit = !!user;
    document.getElementById('userModalTitle').textContent = isEdit ? 'Edit User' : 'Add User';
    document.getElementById('editUserId').value = user ? user.id : '';
    document.getElementById('newUsername').value = user ? user.username : '';
    document.getElementById('newUserPassword').value = '';
    document.getElementById('userStatus').value = user ? user.status : 1;

    // Show/hide fields based on mode
    document.getElementById('usernameGroup').style.display = isEdit ? 'none' : 'block';
    document.getElementById('statusGroup').style.display = isEdit && user.id !== 1 ? 'block' : 'none';

    // Password is optional for edit, required for new
    const passwordInput = document.getElementById('newUserPassword');
    passwordInput.required = !isEdit;
    passwordInput.placeholder = isEdit ? 'Leave empty to keep current' : 'Min 6 characters';

    userModal.classList.add('active');
}

/**
 * Edit user
 */
window.editUser = function(id) {
    const user = users.find(u => u.id === id);
    if (user) {
        openUserModal(user);
    }
};

/**
 * Save user
 */
async function saveUser() {
    const id = document.getElementById('editUserId').value;
    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newUserPassword').value;
    const status = parseInt(document.getElementById('userStatus').value);

    if (!id && !username) {
        showToast('Please enter username', 'error');
        return;
    }

    if (!id && (!password || password.length < 6)) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }

    try {
        let result;
        if (id) {
            // Edit user
            const data = { status };
            if (password) {
                data.new_password = password;
            }
            result = await apiRequest(`/api/admin/users/${id}`, 'PUT', data);
        } else {
            // Create user
            result = await apiRequest('/api/admin/users', 'POST', { username, password });
        }

        if (result.success) {
            showToast(id ? 'User updated' : 'User created', 'success');
            userModal.classList.remove('active');
            await loadUsers();
        } else {
            showToast(result.error || 'Failed to save user', 'error');
        }
    } catch (error) {
        console.error('Save user error:', error);
        showToast('Failed to save user', 'error');
    }
}

/**
 * Delete user
 */
window.deleteUser = async function(id) {
    if (!confirm('Delete this user and all their data?')) {
        return;
    }

    try {
        const result = await apiRequest(`/api/admin/users/${id}`, 'DELETE');
        if (result.success) {
            showToast('User deleted', 'success');
            await loadUsers();
        } else {
            showToast(result.error || 'Failed to delete user', 'error');
        }
    } catch (error) {
        console.error('Delete user error:', error);
        showToast('Failed to delete user', 'error');
    }
};

// ============ Password Management ============

/**
 * Open password modal
 */
function openPasswordModal() {
    document.getElementById('oldPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
    passwordModal.classList.add('active');
}

/**
 * Save password
 */
async function savePassword() {
    const oldPassword = document.getElementById('oldPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!oldPassword || !newPassword || !confirmPassword) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    if (newPassword.length < 6) {
        showToast('New password must be at least 6 characters', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }

    try {
        const result = await apiRequest('/api/admin/password', 'PUT', {
            old_password: oldPassword,
            new_password: newPassword
        });

        if (result.success) {
            showToast('Password changed successfully', 'success');
            passwordModal.classList.remove('active');
        } else {
            showToast(result.error || 'Failed to change password', 'error');
        }
    } catch (error) {
        console.error('Change password error:', error);
        showToast('Failed to change password', 'error');
    }
}
