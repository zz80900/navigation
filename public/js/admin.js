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
let selectedCategoryId = null;

const LINKS_PER_PAGE = 15;
const ACTIVE_CATEGORY_KEY = 'adminActiveCategory';
const ACTIVE_PAGE_KEY_PREFIX = 'adminCategoryPage';

let linkPagination = {
    page: 1,
    perPage: LINKS_PER_PAGE,
    totalPages: 1,
    total: 0,
};

let draggingLinkId = null;
let isReorderInFlight = false;
let draggingCategoryId = null;
let isCategoryDragging = false;
let isCategoryReorderInFlight = false;

// DOM Elements
const categoryList = document.getElementById('categoryList');
const linkTableBody = document.getElementById('linkTableBody');
const activeCategoryLabel = document.getElementById('activeCategoryLabel');
const linkStatsLabel = document.getElementById('linkStatsLabel');
const paginationStatus = document.getElementById('paginationStatus');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const themeToggle = document.getElementById('themeToggle');
const logoutBtn = document.getElementById('logoutBtn');
const addCategoryBtn = document.getElementById('addCategoryBtn');
const addLinkBtn = document.getElementById('addLinkBtn');
const categoryModal = document.getElementById('categoryModal');
const linkModal = document.getElementById('linkModal');
const toast = document.getElementById('toast');
const linkIconInput = document.getElementById('linkIcon');
const iconPreviewImage = document.getElementById('iconPreviewImage');
const iconPreviewStatus = document.getElementById('iconPreviewStatus');

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
    updateThemeToggleAppearance(theme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'light' : 'dark');
}

function updateThemeToggleAppearance(theme) {
    if (!themeToggle) return;
    const isDark = theme === 'dark';
    themeToggle.textContent = isDark ? '🌞' : '🌙';
    themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
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

    // Save buttons
    document.getElementById('saveCategoryBtn').addEventListener('click', saveCategory);
    document.getElementById('saveLinkBtn').addEventListener('click', saveLink);
    document.getElementById('saveUserBtn').addEventListener('click', saveUser);
    document.getElementById('savePasswordBtn').addEventListener('click', savePassword);

    if (linkIconInput) {
        linkIconInput.addEventListener('input', (event) => updateIconPreview(event.target.value));
    }

    // Category click (selection)
    categoryList.addEventListener('click', handleCategoryClick);
    categoryList.addEventListener('dragstart', handleCategoryDragStart);
    categoryList.addEventListener('dragover', handleCategoryDragOver);
    categoryList.addEventListener('dragleave', handleCategoryDragLeave);
    categoryList.addEventListener('drop', handleCategoryDrop);
    categoryList.addEventListener('dragend', clearCategoryDragState);

    // Pagination controls
    prevPageBtn.addEventListener('click', () => changePage(-1));
    nextPageBtn.addEventListener('click', () => changePage(1));

    // Drag-and-drop on link rows
    linkTableBody.addEventListener('dragstart', handleLinkDragStart);
    linkTableBody.addEventListener('dragover', handleLinkDragOver);
    linkTableBody.addEventListener('dragleave', handleLinkDragLeave);
    linkTableBody.addEventListener('drop', handleLinkDrop);
    linkTableBody.addEventListener('dragend', clearDragState);
}

// ============ Category Selection & Pagination Helpers ============

function handleCategoryClick(event) {
    if (isCategoryDragging) {
        return;
    }

    if (event.target.closest('.category-actions')) {
        return;
    }

    const item = event.target.closest('.category-item');
    if (!item) {
        return;
    }

    const categoryId = parseInt(item.dataset.id, 10);
    if (!categoryId || categoryId === selectedCategoryId) {
        return;
    }

    setActiveCategory(categoryId);
}

function setActiveCategory(categoryId) {
    if (!categoryId) {
        return;
    }

    selectedCategoryId = categoryId;
    linkPagination.page = getStoredPageForCategory(categoryId);
    localStorage.setItem(ACTIVE_CATEGORY_KEY, String(categoryId));
    highlightActiveCategory();
    updateLinkToolbar();
    renderPagination();
    loadLinks();
}

function syncSelectedCategory() {
    if (categories.length === 0) {
        selectedCategoryId = null;
        linkPagination = {
            page: 1,
            perPage: LINKS_PER_PAGE,
            totalPages: 1,
            total: 0,
        };
        localStorage.removeItem(ACTIVE_CATEGORY_KEY);
        return;
    }

    if (selectedCategoryId && categories.some(cat => cat.id === selectedCategoryId)) {
        return;
    }

    const storedId = parseInt(localStorage.getItem(ACTIVE_CATEGORY_KEY), 10);
    const fallbackCategory = categories.find(cat => cat.id === storedId) || categories[0];
    selectedCategoryId = fallbackCategory.id;
    linkPagination.page = getStoredPageForCategory(selectedCategoryId);
    localStorage.setItem(ACTIVE_CATEGORY_KEY, String(selectedCategoryId));
}

function highlightActiveCategory() {
    const items = categoryList.querySelectorAll('.category-item');
    items.forEach(item => {
        const id = parseInt(item.dataset.id, 10);
        if (id === selectedCategoryId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

function getStoredPageForCategory(categoryId) {
    if (!categoryId) {
        return 1;
    }
    const stored = localStorage.getItem(`${ACTIVE_PAGE_KEY_PREFIX}:${categoryId}`);
    const parsed = parseInt(stored, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function storePageForCategory(categoryId, page) {
    if (!categoryId || !page) {
        return;
    }
    localStorage.setItem(`${ACTIVE_PAGE_KEY_PREFIX}:${categoryId}`, String(page));
}

function changePage(delta) {
    if (!selectedCategoryId) {
        return;
    }
    const nextPage = linkPagination.page + delta;
    if (nextPage < 1 || nextPage > linkPagination.totalPages) {
        return;
    }
    linkPagination.page = nextPage;
    storePageForCategory(selectedCategoryId, linkPagination.page);
    loadLinks();
}

function renderPagination() {
    if (!paginationStatus) {
        return;
    }

    if (!selectedCategoryId) {
        paginationStatus.textContent = 'Select a category to view links';
        prevPageBtn.disabled = true;
        nextPageBtn.disabled = true;
        return;
    }

    paginationStatus.textContent = `Page ${linkPagination.page} / ${Math.max(linkPagination.totalPages, 1)}`;
    prevPageBtn.disabled = linkPagination.page <= 1;
    nextPageBtn.disabled = linkPagination.page >= linkPagination.totalPages || linkPagination.total === 0;
}

function updateLinkToolbar() {
    if (!activeCategoryLabel || !linkStatsLabel) {
        return;
    }

    if (!selectedCategoryId) {
        activeCategoryLabel.textContent = 'Select a category to manage links';
        linkStatsLabel.textContent = 'Create a category to get started';
        return;
    }

    const category = categories.find(cat => cat.id === selectedCategoryId);
    if (category) {
        activeCategoryLabel.textContent = `Category · ${category.name}`;
    } else {
        activeCategoryLabel.textContent = 'Category';
    }

    if (!linkPagination.total) {
        linkStatsLabel.textContent = `${linkPagination.perPage} per page · No links yet`;
        return;
    }

    const start = (linkPagination.page - 1) * linkPagination.perPage + 1;
    const end = Math.min(linkPagination.total, linkPagination.page * linkPagination.perPage);
    linkStatsLabel.textContent = `${start}-${end} / ${linkPagination.total} · ${linkPagination.perPage} per page`;
}

function updateIconPreview(url) {
    if (!iconPreviewImage || !iconPreviewStatus) {
        return;
    }

    const trimmed = (url || '').trim();

    if (!trimmed) {
        iconPreviewImage.onload = null;
        iconPreviewImage.onerror = null;
        iconPreviewImage.style.display = 'block';
        iconPreviewStatus.textContent = 'Using default icon';
        iconPreviewStatus.classList.remove('error');
        iconPreviewImage.src = '/default_logo_icon.svg';
        return;
    }

    iconPreviewStatus.textContent = 'Loading preview...';
    iconPreviewStatus.classList.remove('error');
    iconPreviewImage.style.display = 'block';
    iconPreviewImage.onload = () => {
        iconPreviewStatus.textContent = 'Preview ready';
        iconPreviewStatus.classList.remove('error');
    };
    iconPreviewImage.onerror = () => {
        iconPreviewImage.style.display = 'none';
        iconPreviewStatus.textContent = 'Preview failed, please check the URL';
        iconPreviewStatus.classList.add('error');
    };
    iconPreviewImage.src = trimmed;
}

// ============ Category Drag Helpers ============

function handleCategoryDragStart(event) {
    if (categories.length < 2) {
        return;
    }

    const item = event.target.closest('.category-item[data-id]');
    if (!item) {
        return;
    }

    if (event.target.closest('.category-actions')) {
        event.preventDefault();
        return;
    }

    const id = parseInt(item.dataset.id, 10);
    if (!id) {
        return;
    }

    draggingCategoryId = id;
    isCategoryDragging = true;

    if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(id));
    }

    item.classList.add('dragging');
}

function handleCategoryDragOver(event) {
    if (!draggingCategoryId) {
        return;
    }

    const item = event.target.closest('.category-item[data-id]');
    if (!item) {
        event.preventDefault();
        return;
    }

    const id = parseInt(item.dataset.id, 10);
    if (!id || id === draggingCategoryId) {
        return;
    }

    event.preventDefault();
    const rect = item.getBoundingClientRect();
    const isBefore = event.clientY < rect.top + rect.height / 2;
    clearCategoryDragIndicators();
    item.classList.toggle('drag-over-top', isBefore);
    item.classList.toggle('drag-over-bottom', !isBefore);
}

function handleCategoryDragLeave(event) {
    const item = event.target.closest('.category-item[data-id]');
    if (!item) {
        return;
    }
    item.classList.remove('drag-over-top', 'drag-over-bottom');
}

function handleCategoryDrop(event) {
    if (!draggingCategoryId) {
        return;
    }

    event.preventDefault();
    const item = event.target.closest('.category-item[data-id]');
    let targetId = null;
    let position = 'after';

    if (item) {
        const id = parseInt(item.dataset.id, 10);
        if (!id || id === draggingCategoryId) {
            clearCategoryDragState();
            return;
        }
        const rect = item.getBoundingClientRect();
        position = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
        targetId = id;
    } else {
        const lastItem = categoryList.querySelector('.category-item[data-id]:last-child');
        if (lastItem) {
            targetId = parseInt(lastItem.dataset.id, 10);
            position = 'after';
        }
    }

    const sourceId = draggingCategoryId;
    clearCategoryDragState();

    if (!targetId || sourceId === targetId) {
        return;
    }

    persistCategoryReorder(sourceId, targetId, position);
}

function clearCategoryDragState() {
    const draggingItem = categoryList.querySelector('.category-item.dragging');
    if (draggingItem) {
        draggingItem.classList.remove('dragging');
    }
    draggingCategoryId = null;
    isCategoryDragging = false;
    clearCategoryDragIndicators();
}

function clearCategoryDragIndicators() {
    categoryList.querySelectorAll('.category-item.drag-over-top, .category-item.drag-over-bottom')
        .forEach(item => item.classList.remove('drag-over-top', 'drag-over-bottom'));
}

async function persistCategoryReorder(categoryId, targetId, position) {
    if (isCategoryReorderInFlight || !categoryId || !targetId) {
        return;
    }

    isCategoryReorderInFlight = true;

    try {
        const payload = {
            category_id: categoryId,
            target_category_id: targetId,
            position: position === 'before' ? 'before' : 'after',
        };
        const result = await apiRequest('/api/admin/categories/reorder', 'PUT', payload);
        if (!result.success) {
            showToast(result.error || 'Failed to reorder category', 'error');
            return;
        }
        await loadCategories();
    } catch (error) {
        console.error('Reorder category error:', error);
        showToast('Failed to reorder category', 'error');
    } finally {
        isCategoryReorderInFlight = false;
    }
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
            syncSelectedCategory();
            renderCategories();
            updateCategorySelect();
            highlightActiveCategory();
            updateLinkToolbar();
            renderPagination();
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

    const allowDrag = categories.length > 1;

    categoryList.innerHTML = categories.map(cat => `
        <li class="category-item" data-id="${cat.id}" draggable="${allowDrag ? 'true' : 'false'}">
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
    if (selectedCategoryId) {
        select.value = selectedCategoryId;
    }
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
            localStorage.removeItem(`${ACTIVE_PAGE_KEY_PREFIX}:${id}`);
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
async function loadLinks(showLoader = true) {
    if (!selectedCategoryId) {
        links = [];
        renderLinks();
        renderPagination();
        updateLinkToolbar();
        return;
    }

    if (showLoader) {
        linkTableBody.innerHTML = '<tr><td colspan="5" class="loading">Loading...</td></tr>';
    }

    const params = new URLSearchParams({
        category_id: selectedCategoryId,
        page: linkPagination.page,
        per_page: LINKS_PER_PAGE,
    });

    try {
        const result = await apiRequest(`/api/admin/links?${params.toString()}`);
        if (result.success) {
            const payload = result.data || {};
            links = payload.links || [];
            const pagination = payload.pagination || {};
            linkPagination = {
                page: pagination.page || 1,
                perPage: pagination.per_page || LINKS_PER_PAGE,
                total: pagination.total || 0,
                totalPages: Math.max(1, pagination.total_pages || 1),
            };
            storePageForCategory(selectedCategoryId, linkPagination.page);
            renderLinks();
            renderPagination();
            updateLinkToolbar();
        } else {
            showToast(result.error || 'Failed to load links', 'error');
            renderLinks();
            renderPagination();
            updateLinkToolbar();
        }
    } catch (error) {
        console.error('Load links error:', error);
        showToast('Failed to load links', 'error');
        renderLinks();
        renderPagination();
        updateLinkToolbar();
    }
}

/**
 * Render link table
 */
function renderLinks() {
    if (!selectedCategoryId) {
        linkTableBody.innerHTML = '<tr><td colspan="5" class="empty-state">Add a category to start managing links</td></tr>';
        return;
    }

    if (links.length === 0) {
        linkTableBody.innerHTML = '<tr><td colspan="5" class="empty-state">No links in this category yet. Click "+ Add Link" to create one.</td></tr>';
        return;
    }

    const allowDrag = links.length > 1;

    linkTableBody.innerHTML = links.map(link => {
        const iconUrl = link.icon || '/default_logo_icon.svg';
        const fallbackSvg = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%232196F3%22 width=%22100%22 height=%22100%22 rx=%2210%22/><text x=%2250%22 y=%2265%22 font-size=%2250%22 text-anchor=%22middle%22 fill=%22white%22>${escapeHtml(link.name.charAt(0).toUpperCase())}</text></svg>`;
        return `
            <tr class="link-row" data-id="${link.id}" draggable="${allowDrag ? 'true' : 'false'}">
                <td class="link-icon-cell">
                    <img class="link-icon" src="${escapeHtml(iconUrl)}" alt=""
                         onerror="this.onerror=null;this.src='${fallbackSvg}'">
                </td>
                <td>${escapeHtml(link.name)}</td>
                <td><span class="link-url" title="${escapeHtml(link.url)}">${escapeHtml(link.url)}</span></td>
                <td>${escapeHtml(link.category_name)}</td>
                <td class="actions-cell">
                    <div class="link-row-actions">
                        <button class="btn btn-secondary btn-sm" onclick="editLink(${link.id})">Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteLink(${link.id})">Del</button>
                    </div>
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
    document.getElementById('linkCategory').value = link ? link.category_id : (selectedCategoryId || '');
    document.getElementById('linkName').value = link ? link.name : '';
    document.getElementById('linkUrl').value = link ? link.url : '';
    if (linkIconInput) {
        linkIconInput.value = link ? link.icon : '';
        updateIconPreview(linkIconInput.value);
    }
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

// ============ Link Reorder Helpers ============

function handleLinkDragStart(event) {
    const row = event.target.closest('tr[data-id]');
    if (!row || row.getAttribute('draggable') === 'false') {
        return;
    }

    if (event.target.closest('.actions-cell')) {
        event.preventDefault();
        return;
    }

    if (links.length < 2) {
        return;
    }

    draggingLinkId = parseInt(row.dataset.id, 10);
    if (!draggingLinkId) {
        return;
    }

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(draggingLinkId));
    row.classList.add('dragging');
}

function handleLinkDragOver(event) {
    if (!draggingLinkId) {
        return;
    }

    const row = event.target.closest('tr[data-id]');
    if (!row) {
        event.preventDefault();
        return;
    }

    const rowId = parseInt(row.dataset.id, 10);
    if (rowId === draggingLinkId) {
        return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    clearDragIndicators();
    const rect = row.getBoundingClientRect();
    const isBefore = event.clientY < rect.top + rect.height / 2;
    row.classList.toggle('drag-over-top', isBefore);
    row.classList.toggle('drag-over-bottom', !isBefore);
}

function handleLinkDragLeave(event) {
    const row = event.target.closest('tr[data-id]');
    if (!row) {
        return;
    }
    row.classList.remove('drag-over-top', 'drag-over-bottom');
}

function handleLinkDrop(event) {
    if (!draggingLinkId) {
        return;
    }

    event.preventDefault();
    const row = event.target.closest('tr[data-id]');
    let targetId = null;
    let position = 'after';

    if (row) {
        const rowId = parseInt(row.dataset.id, 10);
        if (!rowId || rowId === draggingLinkId) {
            clearDragState();
            return;
        }
        const rect = row.getBoundingClientRect();
        position = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
        targetId = rowId;
    } else {
        const lastRow = linkTableBody.querySelector('tr[data-id]:last-child');
        if (lastRow) {
            targetId = parseInt(lastRow.dataset.id, 10);
        }
    }

    const sourceId = draggingLinkId;
    clearDragState();

    if (!targetId || sourceId === targetId) {
        return;
    }

    persistLinkReorder(sourceId, targetId, position);
}

function clearDragState() {
    const draggingRow = linkTableBody.querySelector('.dragging');
    if (draggingRow) {
        draggingRow.classList.remove('dragging');
    }
    draggingLinkId = null;
    clearDragIndicators();
}

function clearDragIndicators() {
    linkTableBody.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(row => {
        row.classList.remove('drag-over-top', 'drag-over-bottom');
    });
}

async function persistLinkReorder(linkId, targetId, position) {
    if (isReorderInFlight || !selectedCategoryId) {
        return;
    }

    isReorderInFlight = true;

    try {
        const payload = {
            category_id: selectedCategoryId,
            link_id: linkId,
            target_link_id: targetId,
            position: position === 'before' ? 'before' : 'after',
        };
        const result = await apiRequest('/api/admin/links/reorder', 'PUT', payload);
        if (!result.success) {
            showToast(result.error || 'Failed to reorder link', 'error');
            return;
        }
        await loadLinks(false);
    } catch (error) {
        console.error('Reorder link error:', error);
        showToast('Failed to reorder link', 'error');
    } finally {
        isReorderInFlight = false;
    }
}

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
