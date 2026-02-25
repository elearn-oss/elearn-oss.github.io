/**
 * api.js - API client for the elearn platform
 * Wraps all AJAX calls to the elearn.uk.ac.ir backend using fetch API.
 * ASP.NET returns data in result.d - all functions unwrap this automatically.
 */

/**
 * Base URL for API calls.
 *
 * Always points directly at the university backend.
 * In demo/mock mode this value is irrelevant because mock.js overrides
 * apiPost() and apiGet() completely.
 */
var API_BASE = 'https://elearn.uk.ac.ir/';

/**
 * Initialize default mode and proxy URL if not already set.
 * This must happen BEFORE mock.js loads so it can check the mode correctly.
 */
if (!localStorage.getItem('elearn_mode')) {
    localStorage.setItem('elearn_mode', 'real');
    console.log('[api.js] Set mode to "real"');
}
if (!localStorage.getItem('elearn_proxy_url')) {
    localStorage.setItem('elearn_proxy_url', 'https://elearn-cors-proxy.elearn-oss.workers.dev');
    console.log('[api.js] Set default proxy URL');
}
console.log('[api.js] Mode:', localStorage.getItem('elearn_mode'), 'Proxy:', localStorage.getItem('elearn_proxy_url'));

/**
 * Maximum time (ms) to wait for the course-context priming GET before
 * proceeding with course API calls anyway (best-effort).
 */
var COURSE_CONTEXT_TIMEOUT_MS = 10000;

/**
 * Stores the Referer path that the CORS proxy should send to the real
 * server. For example 'STCoursepage.aspx?CLid=abc' means the proxy
 * sets Referer: https://elearn.uk.ac.ir/STCoursepage.aspx?CLid=abc.
 *
 * This is necessary because the browser's automatic Referer points to
 * our GitHub Pages origin, but ASP.NET Page Methods validate that the
 * Referer comes from the same domain.
 */
var _currentPageReferer = '';

/** Set the page referer path for subsequent API calls. */
function setPageReferer(path) {
    _currentPageReferer = path || '';
    console.log('[api.js] Page referer set to:', _currentPageReferer);
}

/**
 * Returns the effective API base URL.
 *
 * When a CORS proxy URL is stored in localStorage under 'elearn_proxy_url',
 * all requests are routed through it instead of calling elearn.uk.ac.ir
 * directly. This is required in real mode because the university server does
 * not send Access-Control-Allow-Origin headers and the browser blocks
 * cross-origin requests from the GitHub Pages origin.
 *
 * @returns {string} The base URL (with trailing slash) to use for API calls.
 */
function getApiBase() {
    var proxy = localStorage.getItem('elearn_proxy_url');
    if (proxy) {
        return proxy.replace(/\/$/, '') + '/';
    }
    return API_BASE;
}

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
    // credentials: 'include' is required so the browser sends and stores the
    // ASP.NET session cookie for the CORS proxy domain. The Cloudflare Worker
    // must respond with Access-Control-Allow-Credentials: true for this to work.
    var fullUrl = getApiBase() + url;
    console.log('[apiPost] Requesting:', fullUrl);
    var headers = {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest'
    };
    // Pass page referer so the CORS proxy can set the correct Referer header
    if (_currentPageReferer) {
        headers['X-ELearn-Referer'] = _currentPageReferer;
    }
    return fetch(fullUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data || {}),
        mode: 'cors',
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

    var headers = {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest'
    };
    if (_currentPageReferer) {
        headers['X-ELearn-Referer'] = _currentPageReferer;
    }
    return fetch(getApiBase() + url + queryString, {
        method: 'GET',
        headers: headers,
        mode: 'cors',
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

/**
 * Prime the server-side ASP.NET session with the given course CLid.
 *
 * The university backend stores the active course in its session the first
 * time a browser GETs STCoursepage.aspx?CLid=<guid>. Every subsequent AJAX
 * call (GetInfo, LearningFileList, …) then reads the CLid from that session.
 * Since our SPA never navigates to that URL, we must fire this synthetic GET
 * before calling any STCoursepage endpoint.
 *
 * This function is a no-op in demo/mock mode (elearn_mode !== 'real').
 *
 * A hard timeout of 10 seconds is applied so that a slow or unresponsive
 * server never prevents the course page from loading entirely.
 *
 * @param {string} clid - The CLid GUID for the course (TCInfoGuiID)
 * @returns {Promise<void>}
 */
function apiInitCourseContext(clid) {
    if (!clid || localStorage.getItem('elearn_mode') !== 'real') {
        return Promise.resolve();
    }
    // Set the page referer for all subsequent STCoursepage calls
    setPageReferer('STCoursepage.aspx?CLid=' + clid);
    var primingHeaders = {
        'X-ELearn-Referer': 'STCoursepage.aspx?CLid=' + clid
    };
    var fetchPromise = fetch(getApiBase() + 'STCoursepage.aspx?CLid=' + encodeURIComponent(clid), {
        method: 'GET',
        headers: primingHeaders,
        mode: 'cors',
        credentials: 'include'
    }).then(
        function () { /* discard the HTML body; session cookie side-effect is all we need */ },
        function (err) { console.warn('[elearn] Course context init failed:', err); }
    );
    // Resolve after COURSE_CONTEXT_TIMEOUT_MS at the latest so a hanging request never blocks the page.
    var timeoutPromise = new Promise(function (resolve) { setTimeout(resolve, COURSE_CONTEXT_TIMEOUT_MS); });
    return Promise.race([fetchPromise, timeoutPromise]);
}

/**
 * Prime the server-side ASP.NET session for STClassDetails.aspx.
 *
 * Same principle as apiInitCourseContext – the backend stores the active
 * class in its session when the page is first loaded with CLid/TeCoInD.
 *
 * @param {string} clid - The CLid/TeCoInD identifier for the class
 * @returns {Promise<void>}
 */
function apiInitClassDetailContext(clid) {
    if (!clid || localStorage.getItem('elearn_mode') !== 'real') {
        return Promise.resolve();
    }
    setPageReferer('STClassDetails.aspx?CLid=' + clid);
    var primingHeaders = {
        'X-ELearn-Referer': 'STClassDetails.aspx?CLid=' + clid
    };
    var fetchPromise = fetch(getApiBase() + 'STClassDetails.aspx?CLid=' + encodeURIComponent(clid), {
        method: 'GET',
        headers: primingHeaders,
        mode: 'cors',
        credentials: 'include'
    }).then(
        function () {},
        function (err) { console.warn('[elearn] ClassDetail context init failed:', err); }
    );
    var timeoutPromise = new Promise(function (resolve) { setTimeout(resolve, COURSE_CONTEXT_TIMEOUT_MS); });
    return Promise.race([fetchPromise, timeoutPromise]);
}

/**
 * Prime the server-side ASP.NET session for STMeetingList.aspx.
 *
 * @returns {Promise<void>}
 */
function apiInitMeetingContext() {
    if (localStorage.getItem('elearn_mode') !== 'real') {
        return Promise.resolve();
    }
    setPageReferer('STMeetingList.aspx');
    var primingHeaders = {
        'X-ELearn-Referer': 'STMeetingList.aspx'
    };
    var fetchPromise = fetch(getApiBase() + 'STMeetingList.aspx', {
        method: 'GET',
        headers: primingHeaders,
        mode: 'cors',
        credentials: 'include'
    }).then(
        function () {},
        function (err) { console.warn('[elearn] Meeting context init failed:', err); }
    );
    var timeoutPromise = new Promise(function (resolve) { setTimeout(resolve, COURSE_CONTEXT_TIMEOUT_MS); });
    return Promise.race([fetchPromise, timeoutPromise]);
}

/**
 * Prime the server-side ASP.NET session for chat.aspx.
 *
 * @returns {Promise<void>}
 */
function apiInitChatContext() {
    if (localStorage.getItem('elearn_mode') !== 'real') {
        return Promise.resolve();
    }
    setPageReferer('chat.aspx');
    var primingHeaders = {
        'X-ELearn-Referer': 'chat.aspx'
    };
    var fetchPromise = fetch(getApiBase() + 'chat.aspx', {
        method: 'GET',
        headers: primingHeaders,
        mode: 'cors',
        credentials: 'include'
    }).then(
        function () {},
        function (err) { console.warn('[elearn] Chat context init failed:', err); }
    );
    var timeoutPromise = new Promise(function (resolve) { setTimeout(resolve, COURSE_CONTEXT_TIMEOUT_MS); });
    return Promise.race([fetchPromise, timeoutPromise]);
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
        startpage: String(startpage),
        rowcount: String(rowcount)
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
        startpage: String(startpage),
        rowcount: String(rowcount)
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

/** Get attendance list for current course (DataTable GET format) */
function apiGetAttendanceList() {
    // These are jQuery DataTables v1 server-side processing parameters, matching
    // the exact request the real university browser sends (captured via browser
    // devtools). mDataProp_1='function' is the DataTables v1 convention meaning
    // the client renders column 1 via a custom function rather than a raw value.
    return apiGet('STCoursepage.aspx/GetAttendanceList', {
        sEcho: '1',
        iColumns: '5',
        sColumns: ',,,,',
        iDisplayStart: '0',
        iDisplayLength: '100',
        mDataProp_0: '0',
        sSearch_0: '', bRegex_0: 'false', bSearchable_0: 'true', bSortable_0: 'false',
        mDataProp_1: 'function', // client-rendered column
        sSearch_1: '', bRegex_1: 'false', bSearchable_1: 'true', bSortable_1: 'true',
        mDataProp_2: '2',
        sSearch_2: '', bRegex_2: 'false', bSearchable_2: 'true', bSortable_2: 'true',
        mDataProp_3: '3',
        sSearch_3: '', bRegex_3: 'false', bSearchable_3: 'true', bSortable_3: 'false',
        mDataProp_4: '4',
        sSearch_4: '', bRegex_4: 'false', bSearchable_4: 'true', bSortable_4: 'false',
        sSearch: '', bRegex: 'false',
        iSortCol_0: '2', sSortDir_0: 'desc', iSortingCols: '1'
    });
}

/** Get paginated list of course messages (DataTable GET format) */
function apiGetMessageList(page, rowcount) {
    var iDisplayStart = ((page || 1) - 1) * (rowcount || 10);
    var iDisplayLength = rowcount || 10;
    // 'TeCoInId' is the localStorage key set by course.html from the ?id= query
    // parameter; it corresponds to the TCInfoID required by GetMessageList.
    var tcInfoId = localStorage.getItem('TeCoInId') || '';
    return apiGet('STCoursepage.aspx/GetMessageList', {
        sEcho: '1',
        iColumns: '4',
        sColumns: ',,,',
        iDisplayStart: String(iDisplayStart),
        iDisplayLength: String(iDisplayLength),
        mDataProp_0: '0',
        sSearch_0: '', bRegex_0: 'false', bSearchable_0: 'true', bSortable_0: 'false',
        mDataProp_1: 'function', // client-rendered column (title)
        sSearch_1: '', bRegex_1: 'false', bSearchable_1: 'true', bSortable_1: 'true',
        mDataProp_2: 'function', // client-rendered column (date)
        sSearch_2: '', bRegex_2: 'false', bSearchable_2: 'true', bSortable_2: 'true',
        mDataProp_3: '3',
        sSearch_3: '', bRegex_3: 'false', bSearchable_3: 'true', bSortable_3: 'false',
        sSearch: '', bRegex: 'false',
        iSortCol_0: '2', sSortDir_0: 'desc', iSortingCols: '1',
        TCInfoID: tcInfoId
    });
}

/** Upload an answer file via multipart form */
function apiUploadAnswerFile(file, guid) {
    var formData = new FormData();
    formData.append('file', file);
    formData.append('guid', guid);
    return fetch(getApiBase() + 'UploadHandler.ashx', {
        method: 'POST',
        body: formData,
        mode: 'cors',
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
    return apiGet('STClassDetails.aspx/recordlist', {
        sEcho: '1',
        iColumns: '5',
        sColumns: ',,,,',
        iDisplayStart: '0',
        iDisplayLength: '-1',
        mDataProp_0: '0',
        sSearch_0: '', bRegex_0: 'false', bSearchable_0: 'true', bSortable_0: 'false',
        mDataProp_1: 'function',
        sSearch_1: '', bRegex_1: 'false', bSearchable_1: 'true', bSortable_1: 'true',
        mDataProp_2: '2',
        sSearch_2: '', bRegex_2: 'false', bSearchable_2: 'true', bSortable_2: 'true',
        mDataProp_3: '3',
        sSearch_3: '', bRegex_3: 'false', bSearchable_3: 'true', bSortable_3: 'false',
        mDataProp_4: '4',
        sSearch_4: '', bRegex_4: 'false', bSearchable_4: 'true', bSortable_4: 'false',
        sSearch: '', bRegex: 'false',
        iSortCol_0: '2', sSortDir_0: 'desc', iSortingCols: '1'
    });
}

/** Get upload list filtered by type */
function apiGetUploadList(type) {
    return apiGet('STClassDetails.aspx/Uploadlist', {
        type: String(type),
        sEcho: '1',
        iColumns: '4',
        sColumns: ',,,',
        iDisplayStart: '0',
        iDisplayLength: '-1',
        mDataProp_0: '0',
        sSearch_0: '', bRegex_0: 'false', bSearchable_0: 'true', bSortable_0: 'false',
        mDataProp_1: 'function',
        sSearch_1: '', bRegex_1: 'false', bSearchable_1: 'true', bSortable_1: 'true',
        mDataProp_2: '2',
        sSearch_2: '', bRegex_2: 'false', bSearchable_2: 'true', bSortable_2: 'true',
        mDataProp_3: '3',
        sSearch_3: '', bRegex_3: 'false', bSearchable_3: 'true', bSortable_3: 'false',
        sSearch: '', bRegex: 'false',
        iSortCol_0: '2', sSortDir_0: 'desc', iSortingCols: '1'
    });
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
        sEcho: '1',
        iColumns: '5',
        sColumns: ',,,,',
        iDisplayStart: iDisplayStart || '0',
        iDisplayLength: iDisplayLength || '-1',
        mDataProp_0: '0',
        sSearch_0: '', bRegex_0: 'false', bSearchable_0: 'true', bSortable_0: 'false',
        mDataProp_1: 'function',
        sSearch_1: '', bRegex_1: 'false', bSearchable_1: 'true', bSortable_1: 'true',
        mDataProp_2: '2',
        sSearch_2: '', bRegex_2: 'false', bSearchable_2: 'true', bSortable_2: 'true',
        mDataProp_3: '3',
        sSearch_3: '', bRegex_3: 'false', bSearchable_3: 'true', bSortable_3: 'false',
        mDataProp_4: '4',
        sSearch_4: '', bRegex_4: 'false', bSearchable_4: 'true', bSortable_4: 'false',
        sSearch: '', bRegex: 'false',
        iSortCol_0: '2', sSortDir_0: 'desc', iSortingCols: '1',
        iParticipant: iParticipant || '1'
    });
}
