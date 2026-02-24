/**
 * auth.js - Authentication, navigation, and page setup helpers
 * Depends on: utils.js, api.js (must be loaded before this file)
 */

// ============================================================
// Authentication Checks
// ============================================================

/**
 * Check if user is logged in; redirect to login page if not.
 * Call this at the top of every protected page.
 */
function checkAuth() {
    if (!isSessionValid()) {
        redirectToLogin();
    }
}

/**
 * Get user type from localStorage
 * @returns {number} User type (1=student, 2=teacher, 3/5/6/7/8=admin variants)
 */
function getUserType() {
    return parseInt(localStorage.getItem('utype'), 10) || 0;
}

/**
 * Get username from localStorage
 * @returns {string} Username
 */
function getUserName() {
    return localStorage.getItem('username') || '';
}

/**
 * Check if user is an admin type (3, 5, 6, 7, 8)
 * @returns {boolean}
 */
function isAdmin() {
    var t = getUserType();
    return [3, 5, 6, 7, 8].indexOf(t) !== -1;
}

/**
 * Check if user is a teacher (type 2)
 * @returns {boolean}
 */
function isTeacher() {
    return getUserType() === 2;
}

/**
 * Check if user is a student (type 1)
 * @returns {boolean}
 */
function isStudent() {
    return getUserType() === 1;
}

// ============================================================
// Page Setup
// ============================================================

/**
 * Initialize the navbar with user info and notification badges.
 * Looks for elements: #navbar-username, #navbar-notifications, #notification-badge
 */
function setupNavbar() {
    // Display username
    var usernameEl = document.getElementById('navbar-username');
    if (usernameEl) {
        usernameEl.textContent = getUserName();
    }

    // Load notifications
    loadNotifications();

    // Bind logout button
    setupLogout();
}

/**
 * Build and insert the sidebar menu based on user type.
 * Looks for element: #sidebar-menu
 */
function setupSidebar() {
    var sidebarEl = document.getElementById('sidebar-menu');
    if (!sidebarEl) return;

    var userType = getUserType();
    sidebarEl.innerHTML = buildSidebarMenu(userType);
}

/**
 * Fetch notifications from the server and update the navbar badge.
 */
function loadNotifications() {
    apiGetNotifications()
        .then(function (data) {
            var badge = document.getElementById('notification-badge');
            var container = document.getElementById('navbar-notifications');

            if (!data) return;

            // Parse notification data
            var notifications = [];
            try {
                notifications = typeof data === 'string' ? JSON.parse(data) : data;
            } catch (e) {
                notifications = [];
            }

            if (!Array.isArray(notifications)) {
                notifications = [];
            }

            // Update badge count
            if (badge) {
                if (notifications.length > 0) {
                    badge.textContent = notifications.length;
                    badge.style.display = 'inline-block';
                } else {
                    badge.style.display = 'none';
                }
            }

            // Populate notification dropdown
            if (container) {
                container.innerHTML = '';
                if (notifications.length === 0) {
                    var emptyEl = document.createElement('div');
                    emptyEl.className = 'notification-empty';
                    emptyEl.textContent = 'اعلان جدیدی وجود ندارد';
                    container.appendChild(emptyEl);
                } else {
                    notifications.forEach(function (notif) {
                        var item = document.createElement('div');
                        item.className = 'notification-item';
                        item.textContent = notif.title || notif.text || notif;
                        container.appendChild(item);
                    });
                }
            }
        })
        .catch(function (err) {
            // Silently handle notification load failure
            console.warn('Failed to load notifications:', err);
        });
}

/**
 * Bind the logout button (#btn-logout) to perform logout.
 */
function setupLogout() {
    var logoutBtn = document.getElementById('btn-logout');
    if (!logoutBtn) return;

    logoutBtn.addEventListener('click', function (e) {
        e.preventDefault();
        apiLogout()
            .then(function () {
                redirectToLogin();
            })
            .catch(function () {
                // Force redirect even if API call fails
                redirectToLogin();
            });
    });
}

// ============================================================
// Sidebar Menu Builder
// ============================================================

/**
 * Build sidebar HTML based on user type
 * @param {number} userType - User type from localStorage
 * @returns {string} HTML string for sidebar menu items
 */
function buildSidebarMenu(userType) {
    var items = [];

    // Common items for all users
    items.push({ href: 'dashboard.html', icon: '🏠', text: 'صفحه اصلی' });

    if (userType === 1) {
        // Student menu
        items.push({ href: 'dashboard.html', icon: '📚', text: 'لیست دروس' });
        items.push({ href: 'chat.html', icon: '💬', text: 'پیام‌ها' });
    } else if (userType === 2) {
        // Teacher menu
        items.push({ href: 'dashboard.html', icon: '📚', text: 'لیست دروس' });
        items.push({ href: 'class-details.html', icon: '📋', text: 'جزئیات کلاس' });
        items.push({ href: 'chat.html', icon: '💬', text: 'پیام‌ها' });
    } else if ([3, 5, 6, 7, 8].indexOf(userType) !== -1) {
        // Admin menu
        items.push({ href: 'dashboard.html', icon: '📚', text: 'لیست دروس' });
        items.push({ href: 'class-details.html', icon: '📋', text: 'جزئیات کلاس' });
        items.push({ href: 'chat.html', icon: '💬', text: 'پیام‌ها' });
        items.push({ href: 'dashboard.html', icon: '⚙️', text: 'پنل مدیریت' });
    }

    // Build HTML
    var html = '<ul class="sidebar-nav">';
    items.forEach(function (item) {
        html += '<li class="sidebar-item">';
        html += '<a href="' + escapeHtml(item.href) + '" class="sidebar-link">';
        html += '<span class="sidebar-icon">' + item.icon + '</span>';
        html += '<span class="sidebar-text">' + escapeHtml(item.text) + '</span>';
        html += '</a></li>';
    });
    html += '</ul>';

    return html;
}

// ============================================================
// Page Initialization
// ============================================================

/**
 * Auto-initialize on page load:
 * - Check auth
 * - Sync session time
 * - Setup navbar & sidebar
 */
document.addEventListener('DOMContentLoaded', function () {
    // Skip auth check on the login page itself
    var path = window.location.pathname;
    var isLoginPage = path === '/' ||
                      path.endsWith('/index.html') ||
                      (path.endsWith('/') && !path.slice(0, -1).includes('/index'));

    if (!isLoginPage) {
        checkAuth();

        // Sync session time with server
        apiSetTime().catch(function (err) {
            console.warn('Failed to sync time:', err);
        });

        // Setup page chrome
        setupNavbar();
        setupSidebar();
    }
});
