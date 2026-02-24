/**
 * mock.js – Client-side mock backend for the elearn_oss_main static frontend.
 *
 * Overrides apiPost() and apiGet() (defined in api.js) with in-memory
 * implementations so the site works as a pure static frontend with no
 * network connection needed.
 *
 * Real-API mode (connect directly to elearn.uk.ac.ir):
 *   Set  localStorage.setItem('elearn_mode', 'real')
 *   or click the mode toggle on the login page.
 *
 * Demo mode (default, no internet needed):
 *   student1 / student1  (دانشجو)
 *   teacher1 / teacher1  (استاد)
 *   admin    / admin     (مدیر)
 */

(function () {
    'use strict';

    // ── Real-API mode: skip all overrides ────────────────────
    if (localStorage.getItem('elearn_mode') === 'real') {
        console.info('[elearn] حالت اتصال به سایت دانشگاه فعال است.');
        return;
    }

    // ── Helpers ──────────────────────────────────────────────
    function uid() {
        var arr = new Uint8Array(8);
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            crypto.getRandomValues(arr);
        } else {
            for (var i = 0; i < 8; i++) arr[i] = Math.floor(Math.random() * 256);
        }
        return Array.from(arr).map(function (b) {
            return ('0' + b.toString(16)).slice(-2);
        }).join('');
    }

    function ok(data) { return Promise.resolve(data); }
    function fail(msg) { return Promise.reject(new Error(msg)); }

    // ── Demo Data ────────────────────────────────────────────
    var USERS = [
        { username: 'student1', password: 'student1', utype: '1', name: 'دانشجوی نمونه' },
        { username: 'teacher1', password: 'teacher1', utype: '2', name: 'استاد نمونه' },
        { username: 'admin',    password: 'admin',    utype: '3', name: 'مدیر سیستم' }
    ];

    var CLASSES = [
        {
            TCInfoID: '1001', TCInfoGuiID: uid(),
            classname: 'برنامه‌نویسی وب', CourseImage: '',
            messagecount: '3', learncount: '5', Exercisecount: '2',
            PresentDesc: 'شنبه ۱۰:۰۰ - ۱۲:۰۰', BuildName: 'دانشکده فنی', OnTime: true
        },
        {
            TCInfoID: '1002', TCInfoGuiID: uid(),
            classname: 'پایگاه داده پیشرفته', CourseImage: '',
            messagecount: '1', learncount: '8', Exercisecount: '4',
            PresentDesc: 'یکشنبه ۱۴:۰۰ - ۱۶:۰۰', BuildName: 'دانشکده علوم', OnTime: false
        },
        {
            TCInfoID: '1003', TCInfoGuiID: uid(),
            classname: 'هوش مصنوعی', CourseImage: '',
            messagecount: '0', learncount: '3', Exercisecount: '1',
            PresentDesc: 'دوشنبه ۰۸:۰۰ - ۱۰:۰۰', BuildName: 'دانشکده فنی', OnTime: true
        }
    ];

    var NOTIFICATIONS = [
        { title: 'تمرین جدید درس برنامه‌نویسی وب منتشر شد' },
        { title: 'جلسه آنلاین درس پایگاه داده فردا ساعت ۱۴:۰۰' }
    ];

    var TERM = {
        TermName: 'نیم‌سال دوم ۱۴۰۴-۱۴۰۵',
        TermStart: '2026-01-21',
        TermEnd: '2026-06-21',
        reregsdate: '2026-01-01',
        reregedate: '2026-01-15'
    };

    var LEARNING_FILES = [
        { LeId: 'L1', LeTitle: 'جلسه اول – مقدمه',    LeDesc: 'معرفی مفاهیم پایه و اهداف درس', UploaderName: 'دکتر محمدی', LeDate: '2026-02-01T10:00:00', LeLink: '' },
        { LeId: 'L2', LeTitle: 'جلسه دوم – مبانی',    LeDesc: 'بررسی مبانی تئوری',              UploaderName: 'دکتر محمدی', LeDate: '2026-02-08T10:00:00', LeLink: '' },
        { LeId: 'L3', LeTitle: 'جلسه سوم – پیشرفته',  LeDesc: 'مباحث پیشرفته و کاربردی',        UploaderName: 'دکتر محمدی', LeDate: '2026-02-15T10:00:00', LeLink: '' }
    ];

    var EXERCISES = [
        { ExcId: 'E1', ExTitle: 'تمرین اول', ExDesc: 'حل مسائل فصل اول',      ExStartDate: '2026-02-01T00:00:00', ExEndDate: '2026-02-15T23:59:00', Grade: '—', IsExpired: false },
        { ExcId: 'E2', ExTitle: 'تمرین دوم', ExDesc: 'پروژه عملی فصل دوم',   ExStartDate: '2026-02-10T00:00:00', ExEndDate: '2026-03-01T23:59:00', Grade: '—', IsExpired: false }
    ];

    var MESSAGES = [
        { MsgId: 'M1', MsgTitle: 'اطلاعیه مهم',        MsgBody: 'امتحان میان‌ترم هفته آینده برگزار خواهد شد.',  MsgDate: '2026-02-20T09:00:00' },
        { MsgId: 'M2', MsgTitle: 'تغییر ساعت کلاس',    MsgBody: 'کلاس این هفته ساعت ۱۲ برگزار می‌شود.',        MsgDate: '2026-02-18T14:00:00' }
    ];

    var MEETINGS = [
        { classname: 'برنامه‌نویسی وب',    MeetingNumber: '1', PresentDesc: 'حاضر',  UrlPath: '',                              ScoId: '',   DateCreated: '2026-02-10T10:00:00' },
        { classname: 'برنامه‌نویسی وب',    MeetingNumber: '2', PresentDesc: 'حاضر',  UrlPath: '',                              ScoId: '',   DateCreated: '2026-02-17T10:00:00' },
        { classname: 'پایگاه داده پیشرفته', MeetingNumber: '1', PresentDesc: 'غایب',  UrlPath: '',                              ScoId: '',   DateCreated: '2026-02-11T14:00:00' },
        { classname: 'برنامه‌نویسی وب',    MeetingNumber: '3', PresentDesc: '',       UrlPath: 'https://meet.example.com/s3',   ScoId: 'S3', DateCreated: '2026-02-24T10:00:00' }
    ];

    var ATTENDANCE = [
        { AttDate: '2026-02-01T10:00:00', IsPresent: true  },
        { AttDate: '2026-02-08T10:00:00', IsPresent: true  },
        { AttDate: '2026-02-15T10:00:00', IsPresent: false }
    ];

    var CHAT_CONTACTS = [
        { id: 'U1', name: 'دکتر محمدی', lastmsg: 'سلام، تمرین را فرستادید؟', unread: 1, lasttime: '2026-02-22T10:30:00' },
        { id: 'U2', name: 'علی احمدی',  lastmsg: 'ممنون',                       unread: 0, lasttime: '2026-02-21T16:00:00' }
    ];

    var CHAT_MESSAGES = {
        'U1': [
            { cdid: 'C1', sender: 'U1', senderName: 'دکتر محمدی', message: 'سلام، تمرین را فرستادید؟', date: '2026-02-22T10:30:00', type: 'text' },
            { cdid: 'C2', sender: 'me', senderName: 'شما',        message: 'سلام استاد، بله فرستادم.', date: '2026-02-22T10:35:00', type: 'text' }
        ],
        'U2': [
            { cdid: 'C3', sender: 'me', senderName: 'شما',        message: 'جزوه جلسه سوم رو داری؟', date: '2026-02-21T15:50:00', type: 'text' },
            { cdid: 'C4', sender: 'U2', senderName: 'علی احمدی',  message: 'ممنون',                    date: '2026-02-21T16:00:00', type: 'text' }
        ]
    };

    function courseInfo(id) {
        var cls = CLASSES.find(function (c) { return c.TCInfoID === id; }) || CLASSES[0];
        return {
            classname: cls.classname,
            teachername: 'دکتر محمدی',
            StudentCount: '35',
            TermName: TERM.TermName,
            GroupNo: '1',
            PresentDesc: cls.PresentDesc,
            BuildName: cls.BuildName,
            ExamDate: '2026-03-15',
            ExamTime: '10:00',
            TeacherMessage: 'به درس خوش آمدید. لطفاً تمرین‌ها را به موقع ارسال کنید.'
        };
    }

    // ── Mock API Router ──────────────────────────────────────
    var ROUTES = {
        // Auth
        'POST:Index.aspx/get_login': function (d) {
            var u = d.valuser || d.username || '';
            var p = d.valpass || d.password || '';
            var user = USERS.find(function (x) { return x.username === u && x.password === p; });
            if (!user) {
                if (USERS.some(function (x) { return x.username === u; })) {
                    return { Item1: 'adcerror', Item2: '', Item3: '' };
                }
                return { Item1: 'notexists', Item2: '', Item3: '' };
            }
            localStorage.setItem('_mock_user', JSON.stringify(user));
            return { Item1: 'ok', Item2: user.utype, Item3: '1' };
        },
        'GET:Index.aspx/settime': function () { return 'ok'; },
        'POST:Index.aspx/get_notif': function () {
            var raw = localStorage.getItem('_mock_user');
            var user = raw ? JSON.parse(raw) : { name: '' };
            return {
                Item1: JSON.stringify(NOTIFICATIONS),
                Item2: String(NOTIFICATIONS.length),
                Item3: JSON.stringify(TERM),
                Item4: user.name
            };
        },
        'GET:Index.aspx/logout': function () {
            localStorage.removeItem('_mock_user');
            return 'ok';
        },
        'GET:default.aspx/setacess': function () { return 'ok'; },

        // Student Classes
        'GET:STClasslist.aspx/GetSTClasses': function () {
            return JSON.stringify(CLASSES);
        },
        'POST:STClasslist.aspx/GetClassLink': function (d) {
            return 'https://meet.example.com/class/' + (d.tcguid || 'demo');
        },

        // Course Page
        'POST:STCoursepage.aspx/GetInfo': function () {
            var id = localStorage.getItem('TeCoInId') || '1001';
            return JSON.stringify(courseInfo(id));
        },
        'POST:STCoursepage.aspx/LearningFileList': function () {
            return JSON.stringify(LEARNING_FILES);
        },
        'POST:STCoursepage.aspx/ViewLearnfile': function () { return 'ok'; },
        'POST:STCoursepage.aspx/GetLearnFile': function () {
            return { FileName: 'session.pdf', FileUrl: '#' };
        },
        'POST:STCoursepage.aspx/GetSarfasl': function () {
            return JSON.stringify([
                { Title: 'فصل ۱ – مقدمه',  Desc: 'آشنایی با مفاهیم پایه' },
                { Title: 'فصل ۲ – مبانی',  Desc: 'مبانی تئوری و عملی'    },
                { Title: 'فصل ۳ – پیشرفته', Desc: 'مباحث پیشرفته'         }
            ]);
        },
        'POST:STCoursepage.aspx/GetTarh': function () {
            return JSON.stringify({
                CourseName: 'برنامه‌نویسی وب',
                Teacher: 'دکتر محمدی',
                Objective: 'آشنایی با توسعه وب',
                Reference: 'کتاب توسعه وب مدرن'
            });
        },
        'POST:STCoursepage.aspx/ExerciseFileList': function () {
            return JSON.stringify(EXERCISES);
        },
        'POST:STCoursepage.aspx/CheckValidation': function () { return 'ok'; },
        'POST:STCoursepage.aspx/GetExFile': function () {
            return { FileName: 'exercise.pdf', FileUrl: '#' };
        },
        'POST:STCoursepage.aspx/GetAnswer': function (d) {
            return JSON.stringify({ excId: d.excId || '', AnswerDesc: '', AnswerFile: '', AnswerDate: '', Score: '', exAwGuid: '' });
        },
        'POST:STCoursepage.aspx/GetAnswerFile': function () {
            return { FileName: '', FileUrl: '#' };
        },
        'POST:STCoursepage.aspx/DeleteAnswer': function () { return 'ok'; },
        'POST:STCoursepage.aspx/SaveAnswer': function () { return uid(); },
        'POST:STCoursepage.aspx/SendCheckAnswer': function () { return 'ok'; },
        'POST:STCoursepage.aspx/ViewExercise': function () { return 'ok'; },
        'POST:STCoursepage.aspx/Viewmessage': function () { return 'ok'; },
        'GET:STCoursepage.aspx/GetMessageList': function (d) {
            var start = parseInt(d.iDisplayStart, 10) || 0;
            var length = parseInt(d.iDisplayLength, 10) || 10;
            var total = MESSAGES.length;
            var page_items = length < 0 ? MESSAGES : MESSAGES.slice(start, start + length);
            return { sEcho: d.sEcho || '1', iTotalRecords: total, iTotalDisplayRecords: total, aaData: page_items };
        },
        'GET:STCoursepage.aspx/GetAttendanceList': function () {
            return { sEcho: '1', iTotalRecords: ATTENDANCE.length, iTotalDisplayRecords: ATTENDANCE.length, aaData: ATTENDANCE };
        },
        'POST:UploadHandler.ashx': function () { return 'ok'; },

        // Class Details
        'GET:STClassDetails.aspx/recordlist': function () { return JSON.stringify([]); },
        'GET:STClassDetails.aspx/Uploadlist': function () { return JSON.stringify([]); },
        'POST:STClassDetails.aspx/creatmeeting': function () { return 'ok'; },
        'POST:STClassDetails.aspx/getuser': function (d) {
            return JSON.stringify({ username: d.user || '', fullname: 'کاربر نمونه' });
        },
        'POST:STClassDetails.aspx/addusermeeting': function () { return 'ok'; },
        'POST:STClassDetails.aspx/delusermeeting': function () { return 'ok'; },
        'POST:STClassDetails.aspx/getmeetingusers': function () { return JSON.stringify([]); },
        'POST:STClassDetails.aspx/userroles': function () { return 'ok'; },
        'POST:STClassDetails.aspx/savelink': function () { return 'ok'; },

        // Meetings
        'GET:STMeetingList.aspx/GetMeetingList': function () {
            return JSON.stringify(MEETINGS);
        },

        // Chat
        'POST:chat.aspx/GetInfo': function () {
            var raw = localStorage.getItem('_mock_user');
            var user = raw ? JSON.parse(raw) : { username: '', name: '' };
            return JSON.stringify({ username: user.username, fullname: user.name });
        },
        'POST:chat.aspx/getmainmessage': function () {
            return JSON.stringify(CHAT_CONTACTS);
        },
        'POST:chat.aspx/getmessage': function (d) {
            return JSON.stringify(CHAT_MESSAGES[d.mainid] || []);
        },
        'POST:chat.aspx/search_usercontacts': function (d) {
            var v = (d.val || '').toLowerCase();
            return JSON.stringify(CHAT_CONTACTS.filter(function (c) {
                return c.name.toLowerCase().indexOf(v) !== -1;
            }));
        },
        'POST:chat.aspx/forwardmessage': function () { return 'ok'; },
        'POST:chat.aspx/sendmessage': function () { return 'ok'; },
        'POST:chat.aspx/sendall': function () { return 'ok'; },

        // Admin
        'POST:UsrPanel.aspx/adminreturn': function () { return 'ok'; }
    };

    // ── Override apiPost ─────────────────────────────────────
    window.apiPost = function (url, data) {
        var key = 'POST:' + url;
        var handler = ROUTES[key];
        if (!handler) {
            console.warn('[mock] Unknown POST endpoint:', url);
            return ok(null);
        }
        return ok(handler(data || {}));
    };

    // ── Override apiGet ──────────────────────────────────────
    window.apiGet = function (url, data) {
        var key = 'GET:' + url;
        var handler = ROUTES[key];
        if (!handler) {
            console.warn('[mock] Unknown GET endpoint:', url);
            return ok(null);
        }
        return ok(handler(data || {}));
    };

    // ── Override apiUploadAnswerFile ─────────────────────────
    window.apiUploadAnswerFile = function () {
        return ok('ok');
    };

})();
