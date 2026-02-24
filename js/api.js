/**
 * api.js - API client for the elearn platform
 * Wraps all AJAX calls to the elearn.uk.ac.ir backend using fetch API.
 * ASP.NET returns data in result.d - all functions unwrap this automatically.
 */

/**
 * Base URL for API calls.
 *
 * When served through server.py on localhost the proxy handles routing,
 * so a relative URL (empty string) is used — no CORS issues.
 * When opened directly from any other origin, fall back to the absolute URL
 * (works if the server allows cross-origin requests, or when deployed on the
 * university's own domain).
 *
 * In demo/mock mode this value is irrelevant because mock.js overrides
 * apiPost() and apiGet() completely.
 */
var _isLocalhost = (window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1');
var API_BASE = _isLocalhost ? '' : 'https://elearn.uk.ac.ir/';

// ============================================================
// Generic Request Helpers
// ============================================================

/**
 * Send a POST request with JSON body.
 * Handles session expiry ('resno' in response) by redirecting to login.
 * @param {string} url - Endpoint path (relative to API_BASE)
 * @param {Object} data - Request body (will be JSON-stringified)
 * @returns {Promise<*>} Unwrapped response data (result.d)
 */
function apiPost(url, data) {
    return fetch(API_BASE + url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(data || {}),
        credentials: 'include'
    })
    .then(function (response) {
        if (!response.ok) {
            throw new Error('HTTP ' + response.status + ': ' + response.statusText);
        }
        return response.json();
    })
    .then(function (result) {
        var d = result.d !== undefined ? result.d : result;
        // Check for session expiry: backend returns exactly 'resno' or 'resno:...'
        if (typeof d === 'string' && (d === 'resno' || d.substring(0, 6) === 'resno:')) {
            redirectToLogin();
            return Promise.reject(new Error('Session expired'));
        }
        return d;
    });
}

/**
 * Send a GET request.
 * Handles session expiry ('resno') by redirecting to login.
 * @param {string} url - Endpoint path (relative to API_BASE)
 * @param {Object} [data] - Query parameters as key-value pairs
 * @returns {Promise<*>} Unwrapped response data (result.d)
 */
function apiGet(url, data) {
    var queryString = '';
    if (data && typeof data === 'object') {
        var params = new URLSearchParams();
        Object.keys(data).forEach(function (key) {
            if (data[key] !== undefined && data[key] !== null) {
                params.append(key, data[key]);
            }
        });
        queryString = params.toString();
        if (queryString) queryString = '?' + queryString;
    }

    return fetch(API_BASE + url + queryString, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        credentials: 'include'
    })
    .then(function (response) {
        if (!response.ok) {
            throw new Error('HTTP ' + response.status + ': ' + response.statusText);
        }
        return response.json();
    })
    .then(function (result) {
        var d = result.d !== undefined ? result.d : result;
        if (typeof d === 'string' && (d === 'resno' || d.substring(0, 6) === 'resno:')) {
            redirectToLogin();
            return Promise.reject(new Error('Session expired'));
        }
        return d;
    });
}

// ============================================================
// Auth APIs
// ============================================================

/** Login with username, password, and optional setpass flag */
function apiLogin(username, password, setpass) {
    return apiPost('Index.aspx/get_login', {
        valuser: username,
        valpass: password,
        setpass: setpass || ''
    });
}

/** Sync session time with server */
function apiSetTime() {
    return apiGet('Index.aspx/settime');
}

/** Fetch user notifications */
function apiGetNotifications() {
    return apiPost('Index.aspx/get_notif', {});
}

/** Logout the current user */
function apiLogout() {
    return apiGet('Index.aspx/logout');
}

/** Set access permissions for default page */
function apiSetAccess() {
    return apiGet('default.aspx/setacess');
}

// ============================================================
// Student Class APIs
// ============================================================

/** Get list of student classes */
function apiGetSTClasses() {
    return apiGet('STClasslist.aspx/GetSTClasses');
}

/** Get the online class link for a given class GUID */
function apiGetClassLink(tcguid) {
    return apiPost('STClasslist.aspx/GetClassLink', { tcguid: tcguid });
}

// ============================================================
// Course Page APIs
// ============================================================

/** Get course information for current context */
function apiGetCourseInfo() {
    return apiPost('STCoursepage.aspx/GetInfo', {});
}

/** Get paginated list of learning files */
function apiGetLearningFiles(startpage, rowcount) {
    return apiPost('STCoursepage.aspx/LearningFileList', {
        startpage: startpage,
        rowcount: rowcount
    });
}

/** Mark a learning file as viewed */
function apiViewLearningFile(leId) {
    return apiPost('STCoursepage.aspx/ViewLearnfile', { leId: leId });
}

/** Download a learning file */
function apiGetLearnFile(leId) {
    return apiPost('STCoursepage.aspx/GetLearnFile', { leId: leId });
}

/** Get course syllabus (sarfasl) */
function apiGetSarfasl() {
    return apiPost('STCoursepage.aspx/GetSarfasl', {});
}

/** Get course plan (tarh) */
function apiGetTarh() {
    return apiPost('STCoursepage.aspx/GetTarh', {});
}

/** Get paginated list of exercise files */
function apiGetExerciseFiles(startpage, rowcount) {
    return apiPost('STCoursepage.aspx/ExerciseFileList', {
        startpage: startpage,
        rowcount: rowcount
    });
}

/** Check validation for an exercise */
function apiCheckValidation(excId) {
    return apiPost('STCoursepage.aspx/CheckValidation', { excId: excId });
}

/** Download an exercise file */
function apiGetExFile(excId) {
    return apiPost('STCoursepage.aspx/GetExFile', { excId: excId });
}

/** Get answer details for an exercise */
function apiGetAnswer(excId) {
    return apiPost('STCoursepage.aspx/GetAnswer', { excId: excId });
}

/** Download an answer file */
function apiGetAnswerFile(exAwGuid) {
    return apiPost('STCoursepage.aspx/GetAnswerFile', { exAwGuid: exAwGuid });
}

/** Delete a submitted answer */
function apiDeleteAnswer(exAwGuid) {
    return apiPost('STCoursepage.aspx/DeleteAnswer', { exAwGuid: exAwGuid });
}

/** Save or edit an answer for an exercise */
function apiSaveAnswer(excId, excDesc, fileName, fileType, fileSize, isEdit) {
    return apiPost('STCoursepage.aspx/SaveAnswer', {
        excId: excId,
        excDesc: excDesc,
        fileName: fileName,
        fileType: fileType,
        fileSize: fileSize,
        isEdit: isEdit
    });
}

/** Send answer for check/grading */
function apiSendCheckAnswer(excId) {
    return apiPost('STCoursepage.aspx/SendCheckAnswer', { excId: excId });
}

/** Mark an exercise as viewed */
function apiViewExercise(excId) {
    return apiPost('STCoursepage.aspx/ViewExercise', { excId: excId });
}

/** Mark a message as viewed */
function apiViewMessage(msgId) {
    return apiPost('STCoursepage.aspx/Viewmessage', { msgId: msgId });
}

/** Get paginated list of course messages */
function apiGetMessageList(startpage, rowcount) {
    return apiPost('STCoursepage.aspx/MessageList', {
        startpage: startpage,
        rowcount: rowcount
    });
}

/** Get attendance list for current course */
function apiGetAttendanceList() {
    return apiPost('STCoursepage.aspx/AttendanceList', {});
}

/** Upload an answer file via multipart form */
function apiUploadAnswerFile(file, guid) {
    var formData = new FormData();
    formData.append('file', file);
    formData.append('guid', guid);
    return fetch(API_BASE + 'UploadHandler.ashx', {
        method: 'POST',
        body: formData,
        credentials: 'include'
    }).then(function (r) {
        if (!r.ok) throw new Error('Upload failed');
        return r.text();
    });
}

// ============================================================
// Class Details APIs
// ============================================================

/** Get record list (DataTable format) */
function apiGetRecordList() {
    return apiGet('STClassDetails.aspx/recordlist');
}

/** Get upload list filtered by type */
function apiGetUploadList(type) {
    return apiGet('STClassDetails.aspx/Uploadlist', { type: type });
}

/** Create a new meeting */
function apiCreateMeeting(classname, startdate, starttime, duration) {
    return apiPost('STClassDetails.aspx/creatmeeting', {
        classname: classname,
        startdate: startdate,
        starttime: starttime,
        duration: duration
    });
}

/** Get user information */
function apiGetUser(user) {
    return apiPost('STClassDetails.aspx/getuser', { user: user });
}

/** Add a user to a meeting */
function apiAddUserMeeting(user, scoid) {
    return apiPost('STClassDetails.aspx/addusermeeting', {
        user: user,
        scoid: scoid
    });
}

/** Remove a user from a meeting */
function apiDelUserMeeting(user, scoid) {
    return apiPost('STClassDetails.aspx/delusermeeting', {
        user: user,
        scoid: scoid
    });
}

/** Get list of users in a meeting */
function apiGetMeetingUsers(user, scoid) {
    return apiPost('STClassDetails.aspx/getmeetingusers', {
        user: user,
        scoid: scoid
    });
}

/** Set user role in a meeting */
function apiUserRoles(user, scoid, role) {
    return apiPost('STClassDetails.aspx/userroles', {
        user: user,
        scoid: scoid,
        role: role
    });
}

/** Save a link resource */
function apiSaveLink(title, link, desc) {
    return apiPost('STClassDetails.aspx/savelink', {
        title: title,
        link: link,
        desc: desc
    });
}

// ============================================================
// Chat APIs
// ============================================================

/** Get chat info for current user */
function apiChatGetInfo() {
    return apiPost('chat.aspx/GetInfo', {});
}

/** Get messages for a conversation */
function apiGetMessage(mainid) {
    return apiPost('chat.aspx/getmessage', { mainid: mainid });
}

/** Get main/top-level messages */
function apiGetMainMessage() {
    return apiPost('chat.aspx/getmainmessage', {});
}

/** Search contacts by value */
function apiSearchContacts(val) {
    return apiPost('chat.aspx/search_usercontacts', { val: val });
}

/** Forward a message to another user */
function apiForwardMessage(message, receiver, cdid) {
    return apiPost('chat.aspx/forwardmessage', {
        message: message,
        receiver: receiver,
        cdid: cdid
    });
}

/** Send a message in a conversation */
function apiSendMessage(message, chmainid, type) {
    return apiPost('chat.aspx/sendmessage', {
        message: message,
        chmainid: chmainid,
        type: type
    });
}

/** Send a message to all users */
function apiSendAll(message) {
    return apiPost('chat.aspx/sendall', { message: message });
}

/** Return to admin panel */
function apiAdminReturn() {
    return apiPost('UsrPanel.aspx/adminreturn', {});
}

// ============================================================
// Meeting APIs
// ============================================================

/** Get meeting list for the student */
function apiGetMeetingList(iParticipant, iDisplayStart, iDisplayLength) {
    return apiGet('STMeetingList.aspx/GetMeetingList', {
        iParticipant: iParticipant || '1',
        iDisplayStart: iDisplayStart || '0',
        iDisplayLength: iDisplayLength || '-1'
    });
}
