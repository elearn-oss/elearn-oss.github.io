/**
 * utils.js - Utility functions for the elearn platform
 * Persian date formatting, UI helpers, and common utilities
 */

// ============================================================
// Persian Date Formatting
// ============================================================

/**
 * Convert ISO date string to Persian date (e.g., "۱۴۰۴/۱۲/۰۵")
 * @param {string} dateStr - ISO date string or Date-compatible string
 * @returns {string} Persian formatted date
 */
function pdate(dateStr) {
    if (!dateStr) return '';
    try {
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        return new Intl.DateTimeFormat('fa-IR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(d);
    } catch (e) {
        return '';
    }
}

/**
 * Full Persian date with time (e.g., "۱۴۰۴/۱۲/۰۵ ۱۴:۳۰")
 * @param {string} dateStr - ISO date string or Date-compatible string
 * @returns {string} Persian formatted date and time
 */
function pdatefull(dateStr) {
    if (!dateStr) return '';
    try {
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        var datePart = new Intl.DateTimeFormat('fa-IR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(d);
        var timePart = new Intl.DateTimeFormat('fa-IR', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).format(d);
        return datePart + ' ' + timePart;
    } catch (e) {
        return '';
    }
}

/**
 * Short Persian date (e.g., "۱۴۰۴/۱۲/۰۵")
 * @param {string} dateStr - ISO date string or Date-compatible string
 * @returns {string} Short Persian formatted date
 */
function pdate2(dateStr) {
    if (!dateStr) return '';
    try {
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        return new Intl.DateTimeFormat('fa-IR', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric'
        }).format(d);
    } catch (e) {
        return '';
    }
}

/**
 * Persian time only (e.g., "۱۴:۳۰")
 * @param {string} dateStr - ISO date string or Date-compatible string
 * @returns {string} Persian formatted time
 */
function ptime(dateStr) {
    if (!dateStr) return '';
    try {
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        return new Intl.DateTimeFormat('fa-IR', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).format(d);
    } catch (e) {
        return '';
    }
}

// ============================================================
// File Size Formatting
// ============================================================

/**
 * Format file size in human-readable form
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size (e.g., "1.5 MB")
 */
function getFileSize(bytes) {
    if (bytes === 0 || bytes === null || bytes === undefined) return '0 B';
    var units = ['B', 'KB', 'MB', 'GB', 'TB'];
    var i = 0;
    var size = Math.abs(bytes);
    while (size >= 1024 && i < units.length - 1) {
        size /= 1024;
        i++;
    }
    return (i === 0 ? size : size.toFixed(2)) + ' ' + units[i];
}

// ============================================================
// Loading Overlay
// ============================================================

/** Show loading overlay by adding .active to #page-loader */
function showLoading() {
    var loader = document.getElementById('page-loader');
    if (loader) {
        loader.classList.add('active');
    }
}

/** Hide loading overlay by removing .active from #page-loader */
function hideLoading() {
    var loader = document.getElementById('page-loader');
    if (loader) {
        loader.classList.remove('active');
    }
}

// ============================================================
// Toast Notifications
// ============================================================

/**
 * Show a toast notification
 * @param {string} message - Notification text
 * @param {string} type - One of: success, error, warning, info
 */
function showToast(message, type) {
    type = type || 'info';

    var toast = document.createElement('div');
    toast.className = 'toast-notification toast-' + type;
    toast.textContent = message;

    // Style the toast
    toast.style.cssText =
        'position:fixed;top:20px;left:50%;transform:translateX(-50%);' +
        'padding:12px 24px;border-radius:8px;color:#fff;font-size:14px;' +
        'z-index:100000;opacity:0;transition:opacity 0.3s ease;' +
        'box-shadow:0 4px 12px rgba(0,0,0,0.15);direction:rtl;max-width:90%;';

    var colors = {
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#17a2b8'
    };
    toast.style.backgroundColor = colors[type] || colors.info;
    if (type === 'warning') toast.style.color = '#333';

    document.body.appendChild(toast);

    // Fade in
    requestAnimationFrame(function () {
        toast.style.opacity = '1';
    });

    // Auto-remove after 4 seconds
    setTimeout(function () {
        toast.style.opacity = '0';
        setTimeout(function () {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }, 4000);
}

// ============================================================
// Modal Alerts (Custom, no SweetAlert2 dependency)
// ============================================================

/**
 * Show a modal alert dialog
 * @param {string} title - Alert title
 * @param {string} text - Alert message
 * @param {string} type - One of: success, error, warning, info
 */
function showAlert(title, text, type) {
    type = type || 'info';

    var icons = {
        success: '✓',
        error: '✗',
        warning: '⚠',
        info: 'ℹ'
    };
    var colors = {
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#17a2b8'
    };

    // Build overlay
    var overlay = document.createElement('div');
    overlay.className = 'alert-modal-overlay';
    overlay.style.cssText =
        'position:fixed;top:0;left:0;width:100%;height:100%;' +
        'background:rgba(0,0,0,0.5);z-index:100001;display:flex;' +
        'align-items:center;justify-content:center;direction:rtl;';

    var safeTitle = escapeHtml(title || '');
    var safeText = escapeHtml(text || '');

    var modal = document.createElement('div');
    modal.style.cssText =
        'background:#fff;border-radius:12px;padding:30px;max-width:400px;' +
        'width:90%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.2);';

    var iconEl = document.createElement('div');
    iconEl.style.cssText =
        'width:60px;height:60px;border-radius:50%;margin:0 auto 16px;' +
        'display:flex;align-items:center;justify-content:center;font-size:28px;' +
        'color:#fff;background:' + (colors[type] || colors.info) + ';';
    iconEl.textContent = icons[type] || icons.info;

    var titleEl = document.createElement('h3');
    titleEl.style.cssText = 'margin:0 0 8px;font-size:18px;color:#333;';
    titleEl.textContent = safeTitle;

    var textEl = document.createElement('p');
    textEl.style.cssText = 'margin:0 0 20px;font-size:14px;color:#666;line-height:1.6;';
    textEl.textContent = safeText;

    var btn = document.createElement('button');
    btn.style.cssText =
        'padding:10px 32px;border:none;border-radius:6px;cursor:pointer;' +
        'font-size:14px;color:#fff;background:' + (colors[type] || colors.info) + ';';
    btn.textContent = 'باشه';
    btn.onclick = function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };

    modal.appendChild(iconEl);
    modal.appendChild(titleEl);
    modal.appendChild(textEl);
    modal.appendChild(btn);
    overlay.appendChild(modal);

    // Close on overlay click
    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) {
            overlay.parentNode.removeChild(overlay);
        }
    });

    document.body.appendChild(overlay);
}

/**
 * Show a confirm dialog
 * @param {string} title - Dialog title
 * @param {string} text - Dialog message
 * @returns {Promise<boolean>} Resolves true if confirmed, false if cancelled
 */
function showConfirm(title, text) {
    return new Promise(function (resolve) {
        var overlay = document.createElement('div');
        overlay.className = 'confirm-modal-overlay';
        overlay.style.cssText =
            'position:fixed;top:0;left:0;width:100%;height:100%;' +
            'background:rgba(0,0,0,0.5);z-index:100001;display:flex;' +
            'align-items:center;justify-content:center;direction:rtl;';

        var modal = document.createElement('div');
        modal.style.cssText =
            'background:#fff;border-radius:12px;padding:30px;max-width:400px;' +
            'width:90%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.2);';

        var iconEl = document.createElement('div');
        iconEl.style.cssText =
            'width:60px;height:60px;border-radius:50%;margin:0 auto 16px;' +
            'display:flex;align-items:center;justify-content:center;font-size:28px;' +
            'color:#fff;background:#ffc107;';
        iconEl.textContent = '⚠';

        var titleEl = document.createElement('h3');
        titleEl.style.cssText = 'margin:0 0 8px;font-size:18px;color:#333;';
        titleEl.textContent = title || '';

        var textEl = document.createElement('p');
        textEl.style.cssText = 'margin:0 0 20px;font-size:14px;color:#666;line-height:1.6;';
        textEl.textContent = text || '';

        var btnContainer = document.createElement('div');
        btnContainer.style.cssText = 'display:flex;gap:10px;justify-content:center;';

        var confirmBtn = document.createElement('button');
        confirmBtn.style.cssText =
            'padding:10px 32px;border:none;border-radius:6px;cursor:pointer;' +
            'font-size:14px;color:#fff;background:#28a745;';
        confirmBtn.textContent = 'بله';

        var cancelBtn = document.createElement('button');
        cancelBtn.style.cssText =
            'padding:10px 32px;border:none;border-radius:6px;cursor:pointer;' +
            'font-size:14px;color:#fff;background:#dc3545;';
        cancelBtn.textContent = 'خیر';

        function cleanup() {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }

        confirmBtn.onclick = function () { cleanup(); resolve(true); };
        cancelBtn.onclick = function () { cleanup(); resolve(false); };

        btnContainer.appendChild(confirmBtn);
        btnContainer.appendChild(cancelBtn);
        modal.appendChild(iconEl);
        modal.appendChild(titleEl);
        modal.appendChild(textEl);
        modal.appendChild(btnContainer);
        overlay.appendChild(modal);

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) { cleanup(); resolve(false); }
        });

        document.body.appendChild(overlay);
    });
}

// ============================================================
// Security & URL Helpers
// ============================================================

/**
 * Escape HTML entities to prevent XSS
 * @param {string} str - Raw string
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

/**
 * Get a URL query parameter by name
 * @param {string} name - Parameter name
 * @returns {string|null} Parameter value or null
 */
function getQueryParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
}

// ============================================================
// Session Helpers
// ============================================================

/**
 * Check if localStorage has a valid session
 * @returns {boolean} True if session appears valid
 */
function isSessionValid() {
    return !!(localStorage.getItem('username') && localStorage.getItem('utype'));
}

/**
 * Clear localStorage and redirect to the login page
 */
function redirectToLogin() {
    localStorage.clear();
    window.location.href = 'index.html';
}
