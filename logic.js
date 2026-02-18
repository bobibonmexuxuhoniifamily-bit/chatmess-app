/* ============================================
   💬 ChatMess V2.1 - FIXED & UPGRADED
   Auth + Friends + DM + Private Rooms + Censor
   🔧 Fix: Registration saving
   🆕 New: Delete room, Private rooms, Unfriend
   ============================================ */

const firebaseConfig = {
    apiKey: "AIzaSyCHYmpGbgCza8pQvxL2I_vIR6SEXhlXdPQ",
    authDomain: "chatmess-39524.firebaseapp.com",
    databaseURL: "https://chatmess-39524-default-rtdb.firebaseio.com",
    projectId: "chatmess-39524",
    storageBucket: "chatmess-39524.firebasestorage.app",
    messagingSenderId: "141942890460",
    appId: "1:141942890460:web:cfefd251ea6aa8b148b919",
    measurementId: "G-D22TFRXVL2"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ============================================
// 🔐 SHA-256 Hash Function
// ============================================
async function sha256(message) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================
// 🚫 Bad Words + NSFW Filter
// ============================================
const BAD_WORDS = [
    'đm','dm','dcm','đcm','vl','vkl','cc','clm','cl','cmm','đĩ','cave',
    'ngu','đần','khốn','chó','lồn','lon','buồi','cặc','cac','dit','địt',
    'fuck','shit','bitch','ass','damn','dick','pussy','wtf','stfu',
    'đụ','du','duma','con mẹ','thằng chó','con chó','đồ chó',
    'vcl','vãi','đéo','deo','đệch','dech','mẹ mày','me may',
    'thằng ngu','đồ ngu','con ngu','óc chó','oc cho',
];

const NSFW_KEYWORDS = ['nsfw','nude','naked','porn','sex','xxx','adult','hentai','18+'];

function censorText(text, isRoom) {
    if (!isRoom) return { clean: text, censored: false };
    let censored = false;
    let clean = text;
    BAD_WORDS.forEach(word => {
        const re = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        if (re.test(clean)) {
            censored = true;
            clean = clean.replace(re, m => '*'.repeat(m.length));
        }
    });
    return { clean, censored };
}

function isNSFW(fileName) {
    if (!fileName) return false;
    const lower = fileName.toLowerCase();
    return NSFW_KEYWORDS.some(kw => lower.includes(kw));
}

// ============================================
// 💬 MAIN APP CLASS
// ============================================
class ChatMess {
    constructor() {
        this.user = null;
        this.currentRoom = null;
        this.currentDM = null;
        this.chatMode = 'room';
        this.friends = {};
        this.friendRequests = {};
        this.sentRequests = {};
        this.allUsers = {};
        this.allRooms = {};
        this.replyingTo = null;
        this.isDark = false;
        this.soundOn = true;
        this.enterSend = true;
        this.typingTimeout = null;
        this.msgRef = null;
        this.typingRef = null;
        this.isAdmin = false;
        this.reportTarget = null; // { uid, name }

        this.COLORS = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#DDA0DD',
                        '#F7DC6F','#BB8FCE','#85C1E9','#F8C471','#82E0AA',
                        '#E74C3C','#3498DB','#2ECC71','#9B59B6','#1ABC9C','#F39C12'];

        this.ROOM_ICONS = ['💬','🎮','💻','🎵','📚','🎨','⚽','🍕','🌍','❤️','🔥','⭐'];

        this.EMOJIS = {
            smileys: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','😍','🥰','😘','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','😐','😏','😒','🙄','😬','😮','😲','😳','🥺','😢','😭','😱','😤','😡','🤬','😈','💀','💩','🤡','👻','👽','🤖'],
            gestures: ['👋','🤚','✋','👌','🤌','✌️','🤞','🤟','🤘','🤙','👍','👎','✊','👊','👏','🙌','🤝','🙏','💪','🫶'],
            hearts: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','❣️','💕','💞','💓','💗','💖','💘','💝'],
            animals: ['🐱','🐶','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🦋','🦄','🐝'],
            food: ['🍕','🍔','🍟','🌮','🍜','🍣','🍦','🍩','🍪','🎂','🍰','☕','🍵','🍺','🥤'],
            symbols: ['✅','❌','⭕','❗','❓','💯','🔥','⚡','💫','⭐','✨','💥','💢','💤','💬','♻️','⚠️','🚫']
        };

        this.initAuth();
        this.createParticles();
        this.initAdminAccount();
    }

    // ============================================
    // 🔐 AUTH - FIX KỸ LƯỠNG
    // ============================================
    initAuth() {
        const saved = localStorage.getItem('chatmess_session');
        if (saved) {
            try {
                this.autoLogin(JSON.parse(saved));
            } catch (e) {
                console.error('❌ Auto login failed:', e);
                localStorage.removeItem('chatmess_session');
            }
        }

        // Color picks
        const picks = document.getElementById('regColorPicks');
        this.COLORS.forEach((c, i) => {
            const el = document.createElement('div');
            el.className = 'color-pick' + (i === 0 ? ' active' : '');
            el.style.background = c;
            el.dataset.color = c;
            el.addEventListener('click', () => {
                picks.querySelectorAll('.color-pick').forEach(p => p.classList.remove('active'));
                el.classList.add('active');
                document.getElementById('regPreviewAvatar').style.background = c;
            });
            picks.appendChild(el);
        });

        // Room icon picks
        const iconPicks = document.getElementById('roomIconPicks');
        this.ROOM_ICONS.forEach((ic, i) => {
            const el = document.createElement('span');
            el.className = 'icon-pick' + (i === 0 ? ' active' : '');
            el.dataset.icon = ic;
            el.textContent = ic;
            el.addEventListener('click', () => {
                iconPicks.querySelectorAll('.icon-pick').forEach(p => p.classList.remove('active'));
                el.classList.add('active');
            });
            iconPicks.appendChild(el);
        });

        // Toggle pw
        document.getElementById('toggleLoginPw').addEventListener('click', () => {
            const pw = document.getElementById('loginPassword');
            const ic = document.querySelector('#toggleLoginPw i');
            pw.type = pw.type === 'password' ? 'text' : 'password';
            ic.className = pw.type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
        });

        // Switch forms
        document.getElementById('showRegister').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('loginForm').classList.add('hidden');
            document.getElementById('registerForm').classList.remove('hidden');
        });
        document.getElementById('showLogin').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('registerForm').classList.add('hidden');
            document.getElementById('loginForm').classList.remove('hidden');
        });

        // Username check
        let checkTimeout;
        document.getElementById('regUsername').addEventListener('input', (e) => {
            const v = e.target.value.trim();
            document.getElementById('regPreviewAvatar').textContent = v ? v.charAt(0).toUpperCase() : '?';
            if (!document.getElementById('regDisplayName').value) {
                document.getElementById('regPreviewName').textContent = v || 'Tên của bạn';
            }
            clearTimeout(checkTimeout);
            checkTimeout = setTimeout(() => this.checkUsername(v), 500);
        });

        document.getElementById('regDisplayName').addEventListener('input', (e) => {
            document.getElementById('regPreviewName').textContent = e.target.value.trim() || document.getElementById('regUsername').value.trim() || 'Tên của bạn';
        });

        // PW strength
        document.getElementById('regPassword').addEventListener('input', (e) => {
            const pw = e.target.value;
            const fill = document.getElementById('pwFill');
            const label = document.getElementById('pwLabel');
            if (!pw) { fill.className = 'pw-fill'; label.textContent = ''; return; }
            let score = 0;
            if (pw.length >= 6) score++;
            if (pw.length >= 10) score++;
            if (/[A-Z]/.test(pw)) score++;
            if (/[0-9]/.test(pw)) score++;
            if (/[^A-Za-z0-9]/.test(pw)) score++;
            if (score <= 2) { fill.className = 'pw-fill weak'; label.textContent = 'Yếu'; }
            else if (score <= 3) { fill.className = 'pw-fill medium'; label.textContent = 'Trung bình'; }
            else { fill.className = 'pw-fill strong'; label.textContent = 'Mạnh 💪'; }
        });

        // Login
        document.getElementById('loginBtn').addEventListener('click', () => this.login());
        document.getElementById('loginPassword').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.login(); });
        document.getElementById('loginUsername').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('loginPassword').focus(); });

        // Register
        document.getElementById('registerBtn').addEventListener('click', () => this.register());
        document.getElementById('regPasswordConfirm').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.register(); });
    }

    async checkUsername(name) {
        const el = document.getElementById('nameCheck');
        if (!name || name.length < 3) { el.classList.add('hidden'); return; }
        if (!/^[a-z0-9_]+$/.test(name.toLowerCase())) {
            el.classList.remove('hidden');
            el.className = 'name-check taken';
            el.innerHTML = '<i class="fas fa-times-circle"></i> Chỉ dùng a-z, 0-9, _';
            return;
        }
        el.classList.remove('hidden');
        el.className = 'name-check checking';
        el.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang kiểm tra...';

        try {
            const snap = await db.ref('accounts/' + name.toLowerCase()).once('value');
            if (snap.exists()) {
                el.className = 'name-check taken';
                el.innerHTML = '<i class="fas fa-times-circle"></i> Tên đã được sử dụng!';
            } else {
                el.className = 'name-check available';
                el.innerHTML = '<i class="fas fa-check-circle"></i> Tên khả dụng!';
            }
        } catch (err) {
            console.error('Check username error:', err);
            el.className = 'name-check taken';
            el.innerHTML = '<i class="fas fa-exclamation-circle"></i> Lỗi kiểm tra!';
        }
    }

    // 🔧 ĐĂNG KÝ - FIX THẬT KỸ
    async register() {
        const btn = document.getElementById('registerBtn');
        const errEl = document.getElementById('regError');
        const successEl = document.getElementById('regSuccess');
        errEl.classList.add('hidden');
        successEl.classList.add('hidden');

        const username = document.getElementById('regUsername').value.trim().toLowerCase();
        const displayName = document.getElementById('regDisplayName').value.trim() || username;
        const pw = document.getElementById('regPassword').value;
        const pw2 = document.getElementById('regPasswordConfirm').value;
        const color = document.querySelector('#regColorPicks .color-pick.active')?.dataset.color || '#5865F2';

        // === VALIDATION ===
        if (!username) { this.showErr(errEl, '⚠️ Nhập tên đăng nhập!'); return; }
        if (username.length < 3) { this.showErr(errEl, '⚠️ Tên tối thiểu 3 ký tự!'); return; }
        if (!/^[a-z0-9_]+$/.test(username)) { this.showErr(errEl, '⚠️ Tên chỉ chứa a-z, 0-9, _!'); return; }
        if (!pw) { this.showErr(errEl, '⚠️ Nhập mật khẩu!'); return; }
        if (pw.length < 6) { this.showErr(errEl, '⚠️ Mật khẩu tối thiểu 6 ký tự!'); return; }
        if (pw !== pw2) { this.showErr(errEl, '⚠️ Mật khẩu không khớp!'); return; }

        // Disable button
        btn.classList.add('loading');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang đăng ký...';

        try {
            // === CHECK DUPLICATE ===
            console.log('📝 Checking username:', username);
            const existSnap = await db.ref('accounts/' + username).once('value');

            if (existSnap.exists()) {
                this.showErr(errEl, '❌ Tên đã tồn tại! Chọn tên khác.');
                btn.classList.remove('loading');
                btn.innerHTML = '<i class="fas fa-user-plus"></i> Đăng ký';
                return;
            }

            // === HASH PASSWORD ===
            console.log('🔐 Hashing password...');
            const hashedPw = await sha256(pw + '_chatmess_salt_2024');
            console.log('✅ Hash done');

            // === GENERATE UID ===
            const uid = 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
            console.log('🆔 UID:', uid);

            // === SAVE ACCOUNT (bảng accounts - để login) ===
            const accountData = {
                uid: uid,
                username: username,
                displayName: displayName,
                password: hashedPw,
                color: color,
                createdAt: Date.now()
            };

            console.log('💾 Saving account to accounts/' + username);
            await db.ref('accounts/' + username).set(accountData);
            console.log('✅ Account saved!');

            // === SAVE USER PROFILE (bảng users - để hiển thị) ===
            const userData = {
                username: username,
                displayName: displayName,
                color: color,
                online: false,
                lastSeen: Date.now(),
                createdAt: Date.now()
            };

            console.log('💾 Saving user profile to users/' + uid);
            await db.ref('users/' + uid).set(userData);
            console.log('✅ User profile saved!');

            // === VERIFY SAVE ===
            console.log('🔍 Verifying save...');
            const verifySnap = await db.ref('accounts/' + username).once('value');
            if (!verifySnap.exists()) {
                throw new Error('Verification failed - data not saved!');
            }
            console.log('✅ Verified! Account exists in database.');

            // === SUCCESS ===
            successEl.classList.remove('hidden');
            successEl.textContent = '🎉 Đăng ký thành công! Chuyển sang đăng nhập...';

            this.toast('🎉 Đăng ký thành công!', 'success');

            // Chuyển sang login sau 1.5s
            setTimeout(() => {
                document.getElementById('registerForm').classList.add('hidden');
                document.getElementById('loginForm').classList.remove('hidden');
                document.getElementById('loginUsername').value = username;
                document.getElementById('loginPassword').value = '';
                document.getElementById('loginPassword').focus();

                // Clear form
                document.getElementById('regUsername').value = '';
                document.getElementById('regDisplayName').value = '';
                document.getElementById('regPassword').value = '';
                document.getElementById('regPasswordConfirm').value = '';
                document.getElementById('nameCheck').classList.add('hidden');
                successEl.classList.add('hidden');
            }, 1500);

        } catch (err) {
            console.error('❌ Registration error:', err);
            this.showErr(errEl, '❌ Lỗi đăng ký: ' + err.message);
        }

        btn.classList.remove('loading');
        btn.innerHTML = '<i class="fas fa-user-plus"></i> Đăng ký <div class="btn-shine"></div>';
    }

    // 🔧 ĐĂNG NHẬP - FIX KỸ
    async login() {
        const btn = document.getElementById('loginBtn');
        const errEl = document.getElementById('loginError');
        errEl.classList.add('hidden');

        const username = document.getElementById('loginUsername').value.trim().toLowerCase();
        const pw = document.getElementById('loginPassword').value;

        if (!username) { this.showErr(errEl, '⚠️ Nhập tên đăng nhập!'); return; }
        if (!pw) { this.showErr(errEl, '⚠️ Nhập mật khẩu!'); return; }

        btn.classList.add('loading');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang đăng nhập...';

        try {
            console.log('🔑 Logging in:', username);
            const snap = await db.ref('accounts/' + username).once('value');

            if (!snap.exists()) {
                this.showErr(errEl, '❌ Tài khoản không tồn tại!');
                btn.classList.remove('loading');
                btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Đăng nhập <div class="btn-shine"></div>';
                return;
            }

            const account = snap.val();
            console.log('📦 Account found:', account.username);

            // Check banned
            if (account.banned) {
                this.showErr(errEl, '🚫 Tài khoản bị banned: ' + (account.banReason || 'Vi phạm quy định'));
                btn.classList.remove('loading');
                btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Đăng nhập <div class="btn-shine"></div>';
                return;
            }

            const hashedPw = await sha256(pw + '_chatmess_salt_2024');

            if (account.password !== hashedPw) {
                this.showErr(errEl, '❌ Sai mật khẩu!');
                btn.classList.remove('loading');
                btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Đăng nhập <div class="btn-shine"></div>';
                return;
            }

            // Success
            this.user = {
                uid: account.uid,
                username: account.username,
                displayName: account.displayName,
                color: account.color,
                avatarData: account.avatarData || null
            };

            localStorage.setItem('chatmess_session', JSON.stringify(this.user));
            console.log('✅ Login success!', this.user);
            this.enterApp();

        } catch (err) {
            console.error('❌ Login error:', err);
            this.showErr(errEl, '❌ Lỗi: ' + err.message);
        }

        btn.classList.remove('loading');
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Đăng nhập <div class="btn-shine"></div>';
    }

    async autoLogin(session) {
        try {
            const snap = await db.ref('accounts/' + session.username).once('value');
            if (!snap.exists()) { localStorage.removeItem('chatmess_session'); return; }
            const account = snap.val();
            if (account.banned) { localStorage.removeItem('chatmess_session'); return; }
            this.user = { ...session, avatarData: account.avatarData || null };
            this.enterApp();
        } catch (e) {
            console.error('Auto login failed:', e);
            localStorage.removeItem('chatmess_session');
        }
    }

    showErr(el, msg) {
        el.classList.remove('hidden');
        el.textContent = msg;
    }

    enterApp() {
        document.getElementById('authOverlay').style.display = 'none';
        document.getElementById('appContainer').classList.remove('hidden');

        const av = document.getElementById('myAvatar');
        if (this.user.avatarData) {
            av.style.backgroundImage = `url(${this.user.avatarData})`;
            av.style.backgroundSize = 'cover';
            av.textContent = '';
        } else {
            av.textContent = this.user.displayName.charAt(0).toUpperCase();
            av.style.background = this.user.color;
        }
        document.getElementById('myName').textContent = this.user.displayName;

        // Admin check
        this.isAdmin = (this.user.username === 'admin');
        document.getElementById('adminBtn').style.display = this.isAdmin ? '' : 'none';

        this.goOnline();
        this.initDefaultRooms();
        this.listenRooms();
        this.listenFriends();
        this.listenFriendRequests();
        this.listenAllUsers();
        this.switchRoom('general');
        this.setupEmoji();
        this.bindEvents();
        this.toast('🎉 Chào ' + this.user.displayName + '!', 'success');

        if (this.isAdmin) this.listenReports();
    }

    logout() {
        db.ref('users/' + this.user.uid).update({ online: false });
        localStorage.removeItem('chatmess_session');
        location.reload();
    }

    // ============================================
    // 🟢 ONLINE
    // ============================================
    goOnline() {
        const ref = db.ref('users/' + this.user.uid);
        ref.update({ online: true, lastSeen: firebase.database.ServerValue.TIMESTAMP });
        ref.onDisconnect().update({ online: false, lastSeen: firebase.database.ServerValue.TIMESTAMP });
    }

    listenAllUsers() {
        db.ref('users').on('value', snap => {
            this.allUsers = snap.val() || {};
            this.renderOnlineFriends();
            this.renderDMList();
        });
    }

    renderOnlineFriends() {
        const list = document.getElementById('onlineList');
        let html = '';
        let count = 0;
        Object.keys(this.friends).forEach(uid => {
            const u = this.allUsers[uid];
            if (!u || !u.online) return;
            count++;
            html += `<div class="online-user" data-uid="${uid}">
                <div class="online-av" style="background:${u.color||'#5865F2'}">${(u.displayName||'?').charAt(0).toUpperCase()}</div>
                <span class="online-name">${u.displayName||'?'}</span></div>`;
        });
        list.innerHTML = html || '<p style="text-align:center;color:var(--text-muted);font-size:12px;padding:8px">Chưa có bạn online</p>';
        document.getElementById('onlineCount').textContent = count;
        list.querySelectorAll('.online-user').forEach(el => el.addEventListener('click', () => this.openDM(el.dataset.uid)));
    }

    // ============================================
    // 👥 FRIENDS
    // ============================================
    listenFriends() {
        db.ref('users/' + this.user.uid + '/friends').on('value', snap => {
            this.friends = snap.val() || {};
            this.renderOnlineFriends();
            this.renderDMList();
            this.renderFriendsList();
            this.renderRoomsList();
        });
    }

    listenFriendRequests() {
        db.ref('users/' + this.user.uid + '/friendRequests').on('value', snap => {
            this.friendRequests = snap.val() || {};
            const c = Object.keys(this.friendRequests).length;
            document.getElementById('friendReqDot').classList.toggle('hidden', c === 0);
            document.getElementById('reqCount').classList.toggle('hidden', c === 0);
            document.getElementById('reqCount').textContent = c;
            this.renderFriendReqs();
        });
        db.ref('users/' + this.user.uid + '/sentRequests').on('value', snap => {
            this.sentRequests = snap.val() || {};
        });
    }

    searchUsers(q) {
        const el = document.getElementById('searchUserResults');
        if (!q || q.length < 2) { el.innerHTML = '<div class="empty-state small"><p>Nhập ít nhất 2 ký tự 🔍</p></div>'; return; }
        const lower = q.toLowerCase();
        let html = '';
        Object.entries(this.allUsers).forEach(([uid, u]) => {
            if (uid === this.user.uid) return;
            if (!(u.username||'').toLowerCase().includes(lower) && !(u.displayName||'').toLowerCase().includes(lower)) return;
            const isFriend = !!this.friends[uid];
            const isSent = !!this.sentRequests[uid];
            const isReq = !!this.friendRequests[uid];
            let btn = '';
            if (isFriend) btn = '<button class="action-btn pending" disabled><i class="fas fa-check"></i> Bạn bè</button>';
            else if (isSent) btn = '<button class="action-btn pending" disabled><i class="fas fa-clock"></i> Đã gửi</button>';
            else if (isReq) btn = `<button class="action-btn success" onclick="app.acceptFriend('${uid}')"><i class="fas fa-check"></i></button>`;
            else btn = `<button class="action-btn primary" onclick="app.sendFriendReq('${uid}')"><i class="fas fa-user-plus"></i> Kết bạn</button>`;
            html += `<div class="user-result-card">
                <div class="ur-avatar" style="background:${u.color||'#5865F2'}">${(u.displayName||'?').charAt(0).toUpperCase()}</div>
                <div class="ur-info"><span class="ur-name">${u.displayName||u.username||'?'}</span><span class="ur-username">@${u.username||'?'}</span></div>
                <div class="ur-actions">${btn}</div></div>`;
        });
        el.innerHTML = html || '<div class="empty-state small"><p>Không tìm thấy 😅</p></div>';
    }

    async sendFriendReq(uid) {
        try {
            await db.ref('users/' + uid + '/friendRequests/' + this.user.uid).set({
                from: this.user.uid, name: this.user.displayName, color: this.user.color, time: Date.now()
            });
            await db.ref('users/' + this.user.uid + '/sentRequests/' + uid).set(true);
            this.toast('📩 Đã gửi lời mời!', 'success');
            const q = document.getElementById('searchUserInput').value;
            if (q) this.searchUsers(q);
        } catch (e) { this.toast('❌ Lỗi: ' + e.message, 'error'); }
    }

    async acceptFriend(uid) {
        try {
            await db.ref('users/' + this.user.uid + '/friends/' + uid).set({ since: Date.now() });
            await db.ref('users/' + uid + '/friends/' + this.user.uid).set({ since: Date.now() });
            await db.ref('users/' + this.user.uid + '/friendRequests/' + uid).remove();
            await db.ref('users/' + uid + '/sentRequests/' + this.user.uid).remove();
            const u = this.allUsers[uid];
            this.toast('🎉 Đã kết bạn với ' + (u?.displayName || 'user') + '!', 'success');
        } catch (e) { this.toast('❌ Lỗi: ' + e.message, 'error'); }
    }

    async rejectFriend(uid) {
        await db.ref('users/' + this.user.uid + '/friendRequests/' + uid).remove();
        await db.ref('users/' + uid + '/sentRequests/' + this.user.uid).remove();
        this.toast('❌ Đã từ chối', 'info');
    }

    // 🆕 XOÁ BẠN BÈ
    async unfriend(uid) {
        if (!confirm('Huỷ kết bạn với người này?')) return;
        try {
            await db.ref('users/' + this.user.uid + '/friends/' + uid).remove();
            await db.ref('users/' + uid + '/friends/' + this.user.uid).remove();
            this.toast('👋 Đã huỷ kết bạn', 'info');
            // Nếu đang DM thì quay lại phòng
            if (this.chatMode === 'dm' && this.currentDM === uid) {
                this.switchRoom('general');
            }
        } catch (e) { this.toast('❌ Lỗi: ' + e.message, 'error'); }
    }

    renderFriendReqs() {
        const list = document.getElementById('friendReqList');
        const reqs = Object.entries(this.friendRequests);
        if (!reqs.length) { list.innerHTML = '<div class="empty-state small"><p>Chưa có lời mời 📭</p></div>'; return; }
        list.innerHTML = reqs.map(([uid, r]) => `<div class="user-result-card">
            <div class="ur-avatar" style="background:${r.color||'#5865F2'}">${(r.name||'?').charAt(0).toUpperCase()}</div>
            <div class="ur-info"><span class="ur-name">${r.name||'?'}</span><span class="ur-username">Muốn kết bạn</span></div>
            <div class="ur-actions">
                <button class="action-btn success" onclick="app.acceptFriend('${uid}')"><i class="fas fa-check"></i></button>
                <button class="action-btn danger" onclick="app.rejectFriend('${uid}')"><i class="fas fa-times"></i></button>
            </div></div>`).join('');
    }

    renderFriendsList() {
        const list = document.getElementById('friendsList');
        const fl = Object.keys(this.friends);
        if (!fl.length) { list.innerHTML = '<div class="empty-state small"><p>Chưa có bạn bè 😢</p></div>'; return; }
        list.innerHTML = fl.map(uid => {
            const u = this.allUsers[uid] || {};
            return `<div class="user-result-card">
                <div class="ur-avatar" style="background:${u.color||'#5865F2'}">${(u.displayName||'?').charAt(0).toUpperCase()}</div>
                <div class="ur-info"><span class="ur-name">${u.displayName||'?'}</span><span class="ur-username">${u.online?'🟢 Online':'⚫ Offline'}</span></div>
                <div class="ur-actions">
                    <button class="action-btn primary" onclick="app.openDM('${uid}')"><i class="fas fa-comment"></i></button>
                    <button class="action-btn danger" onclick="app.unfriend('${uid}')" title="Huỷ kết bạn"><i class="fas fa-user-minus"></i></button>
                </div></div>`;
        }).join('');
    }

    // ============================================
    // 💬 DM
    // ============================================
    renderDMList() {
        const list = document.getElementById('dmList');
        const fl = Object.keys(this.friends);
        if (!fl.length) { list.innerHTML = '<div class="empty-state"><i class="fas fa-user-friends"></i><p>Kết bạn để nhắn tin!</p></div>'; return; }
        list.innerHTML = fl.map(uid => {
            const u = this.allUsers[uid] || {};
            const isActive = this.currentDM === uid && this.chatMode === 'dm';
            return `<div class="dm-item ${isActive?'active':''}" data-uid="${uid}">
                <div class="dm-avatar-box" style="background:${u.color||'#5865F2'}">${(u.displayName||'?').charAt(0).toUpperCase()}
                    <span class="${u.online?'online-badge':'offline-badge'}"></span></div>
                <div class="room-details"><div class="room-name">${u.displayName||'?'}</div>
                <div class="room-last-msg">${u.online?'🟢 Online':'⚫ Offline'}</div></div></div>`;
        }).join('');
        list.querySelectorAll('.dm-item').forEach(el => el.addEventListener('click', () => this.openDM(el.dataset.uid)));
    }

    openDM(uid) {
        if (!this.friends[uid]) { this.toast('⚠️ Cần kết bạn trước!', 'warning'); return; }
        this.chatMode = 'dm';
        this.currentDM = uid;
        document.getElementById('chatHeader').classList.add('hidden');
        document.getElementById('dmHeader').classList.remove('hidden');
        document.getElementById('accessDenied').classList.add('hidden');
        document.getElementById('messagesContainer').classList.remove('hidden');
        document.getElementById('inputArea').classList.remove('hidden');

        const u = this.allUsers[uid] || {};
        document.getElementById('dmAvatar').textContent = (u.displayName||'?').charAt(0).toUpperCase();
        document.getElementById('dmAvatar').style.background = u.color || '#5865F2';
        document.getElementById('dmName').textContent = u.displayName || '?';
        document.getElementById('dmStatus').textContent = u.online ? '🟢 Online' : '⚫ Offline';

        document.getElementById('friendsDialog').classList.add('hidden');
        document.getElementById('sidebar').classList.remove('open');
        this.loadMessages();
        this.renderDMList();
    }

    getDMKey(a, b) { return [a, b].sort().join('_'); }

    // ============================================
    // 🏠 ROOMS (Public + Private)
    // ============================================
    initDefaultRooms() {
        const defaults = {
            general: { name: 'General', icon: '💬', desc: 'Phòng chat chung', isPrivate: false },
            random: { name: 'Random', icon: '🎲', desc: 'Nói gì cũng được!', isPrivate: false },
            coding: { name: 'Coding', icon: '💻', desc: 'Lập trình', isPrivate: false },
        };
        Object.entries(defaults).forEach(([id, d]) => {
            db.ref('rooms/' + id + '/info').once('value', s => {
                if (!s.exists()) db.ref('rooms/' + id + '/info').set({ ...d, owner: 'system', created: Date.now() });
            });
        });
    }

    // ============================================
    // 🛡️ ADMIN ACCOUNT INIT
    // ============================================
    async initAdminAccount() {
        try {
            const snap = await db.ref('accounts/admin').once('value');
            if (!snap.exists()) {
                const hashedPw = await sha256('taolabibobon_chatmess_salt_2024');
                const uid = 'admin_uid_fixed';
                await db.ref('accounts/admin').set({
                    uid, username: 'admin', displayName: '👑 Admin',
                    password: hashedPw, color: '#e74c3c',
                    createdAt: Date.now(), isAdmin: true
                });
                await db.ref('users/' + uid).set({
                    username: 'admin', displayName: '👑 Admin',
                    color: '#e74c3c', online: false, lastSeen: Date.now(), isAdmin: true
                });
                console.log('✅ Admin account initialized');
            }
        } catch (e) { console.error('Admin init error:', e); }
    }

    // ============================================
    // 📢 ADMIN FUNCTIONS
    // ============================================
    async sendBroadcast() {
        const msg = document.getElementById('broadcastMsg').value.trim();
        if (!msg) { this.toast('⚠️ Nhập nội dung!', 'warning'); return; }
        let room = document.getElementById('broadcastRoom').value.trim() || 'general';
        // Normalize room id
        const roomId = Object.keys(this.allRooms).find(id => {
            const info = this.allRooms[id]?.info;
            return id === room || (info?.name||'').toLowerCase() === room.toLowerCase();
        }) || 'general';

        const sysMsg = {
            type: 'system',
            text: '📢 [ADMIN] ' + msg,
            time: firebase.database.ServerValue.TIMESTAMP
        };
        await db.ref('rooms/' + roomId + '/messages').push(sysMsg);

        // Also push to notifications node
        await db.ref('notifications').push({ msg, time: Date.now(), from: 'admin' });

        document.getElementById('broadcastMsg').value = '';
        document.getElementById('broadcastRoom').value = '';
        this.toast('📢 Đã gửi thông báo!', 'success');
    }

    async banUser(unban = false) {
        const username = document.getElementById('banUsername').value.trim().toLowerCase();
        const reason = document.getElementById('banReason').value.trim() || 'Vi phạm quy định';
        if (!username) { this.toast('⚠️ Nhập tên user!', 'warning'); return; }
        if (username === 'admin') { this.toast('⚠️ Không thể ban admin!', 'warning'); return; }

        const msgEl = document.getElementById('banResultMsg');
        try {
            const snap = await db.ref('accounts/' + username).once('value');
            if (!snap.exists()) { msgEl.style.color = 'var(--danger)'; msgEl.textContent = '❌ Không tìm thấy user: ' + username; return; }

            if (unban) {
                await db.ref('accounts/' + username).update({ banned: false, banReason: null });
                msgEl.style.color = 'var(--success)'; msgEl.textContent = '✅ Đã unban: ' + username;
                this.toast('✅ Đã unban!', 'success');
            } else {
                await db.ref('accounts/' + username).update({ banned: true, banReason: reason, bannedAt: Date.now() });
                // Push system msg to general
                await db.ref('rooms/general/messages').push({ type: 'system', text: '🔨 ' + username + ' đã bị ban khỏi ChatMess.', time: firebase.database.ServerValue.TIMESTAMP });
                msgEl.style.color = 'var(--danger)'; msgEl.textContent = '🔨 Đã ban: ' + username;
                this.toast('🔨 Đã ban user!', 'success');
            }
        } catch (e) { msgEl.style.color = 'var(--danger)'; msgEl.textContent = '❌ Lỗi: ' + e.message; }
    }

    listenReports() {
        db.ref('reports').orderByChild('time').limitToLast(50).on('value', snap => {
            const reports = [];
            snap.forEach(c => reports.unshift({ id: c.key, ...c.val() }));
            const count = reports.length;
            document.getElementById('reportCount').textContent = count;
            document.getElementById('reportCount').classList.toggle('hidden', count === 0);
            this.renderReports(reports);
        });
    }

    renderReports(reports) {
        const el = document.getElementById('reportsList');
        if (!reports.length) { el.innerHTML = '<div class="empty-state small"><p>Chưa có báo cáo nào 📭</p></div>'; return; }
        el.innerHTML = reports.map(r => `
            <div class="report-card">
                <div class="report-header">
                    <span class="report-from">👤 <strong>${this.esc(r.reporterName||'?')}</strong> báo cáo <strong style="color:var(--danger)">${this.esc(r.targetName||'?')}</strong></span>
                    <span class="report-time">${new Date(r.time).toLocaleString()}</span>
                </div>
                <div class="report-reason">🏷️ ${this.esc(r.reason||'?')} ${r.detail ? '— ' + this.esc(r.detail) : ''}</div>
                <div class="report-actions">
                    <button class="action-btn danger" onclick="document.getElementById('banUsername').value='${this.esc(r.targetUsername||'')}';app.openAdminTab('ban')">🔨 Ban</button>
                    <button class="action-btn" onclick="db.ref('reports/${r.id}').remove()">🗑️ Xoá</button>
                </div>
            </div>`).join('');
    }

    renderAdminUsers() {
        const el = document.getElementById('adminUsersList');
        const users = Object.entries(this.allUsers).filter(([uid]) => uid !== 'admin_uid_fixed');
        if (!users.length) { el.innerHTML = '<div class="empty-state small"><p>Chưa có user</p></div>'; return; }
        el.innerHTML = users.map(([uid, u]) => `
            <div class="user-result-card">
                ${this.makeAvatarEl(u, 'ur-avatar')}
                <div class="ur-info">
                    <span class="ur-name">${this.esc(u.displayName||'?')}</span>
                    <span class="ur-username">@${this.esc(u.username||'?')} ${u.online?'🟢':'⚫'}</span>
                </div>
                <div class="ur-actions">
                    <button class="action-btn danger" onclick="document.getElementById('banUsername').value='${this.esc(u.username||'')}';app.openAdminTab('ban')" title="Ban">🔨</button>
                </div>
            </div>`).join('');
    }

    openAdminTab(tab) {
        document.getElementById('adminDialog').classList.remove('hidden');
        document.querySelectorAll('.atab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.atab-content').forEach(c => c.classList.add('hidden'));
        document.querySelector(`.atab[data-atab="${tab}"]`).classList.add('active');
        document.getElementById('atab-' + tab).classList.remove('hidden');
    }

    // ============================================
    // 🚩 REPORT USER
    // ============================================
    openReportDialog(uid, name, username) {
        this.reportTarget = { uid, name, username };
        document.getElementById('reportTargetInfo').textContent = `Báo cáo: ${name} (@${username})`;
        document.querySelectorAll('input[name="reportReason"]').forEach(r => r.checked = false);
        document.getElementById('reportDetail').value = '';
        document.getElementById('reportDialog').classList.remove('hidden');
    }

    async submitReport() {
        if (!this.reportTarget) return;
        const reason = document.querySelector('input[name="reportReason"]:checked')?.value;
        if (!reason) { this.toast('⚠️ Chọn lý do báo cáo!', 'warning'); return; }
        const detail = document.getElementById('reportDetail').value.trim();
        try {
            await db.ref('reports').push({
                reporterId: this.user.uid,
                reporterName: this.user.displayName,
                targetId: this.reportTarget.uid,
                targetName: this.reportTarget.name,
                targetUsername: this.reportTarget.username,
                reason, detail, time: Date.now()
            });
            document.getElementById('reportDialog').classList.add('hidden');
            this.reportTarget = null;
            this.toast('🚩 Đã gửi báo cáo!', 'success');
        } catch (e) { this.toast('❌ Lỗi: ' + e.message, 'error'); }
    }

    // ============================================
    // 👤 PROFILE: CHANGE NAME & AVATAR
    // ============================================
    async saveProfile() {
        const newName = document.getElementById('editDisplayName').value.trim();
        if (!newName) { this.toast('⚠️ Nhập tên hiển thị!', 'warning'); return; }
        if (newName.length < 2) { this.toast('⚠️ Tên quá ngắn!', 'warning'); return; }

        try {
            await db.ref('accounts/' + this.user.username).update({ displayName: newName });
            await db.ref('users/' + this.user.uid).update({ displayName: newName });
            this.user.displayName = newName;
            localStorage.setItem('chatmess_session', JSON.stringify(this.user));
            document.getElementById('myName').textContent = newName;
            this.toast('✅ Đã đổi tên!', 'success');
        } catch (e) { this.toast('❌ Lỗi: ' + e.message, 'error'); }
    }

    async saveAvatar(dataUrl) {
        if (dataUrl.length > 200000) { this.toast('⚠️ Ảnh quá lớn! Chọn ảnh nhỏ hơn.', 'warning'); return; }
        try {
            await db.ref('accounts/' + this.user.username).update({ avatarData: dataUrl });
            await db.ref('users/' + this.user.uid).update({ avatarData: dataUrl });
            this.user.avatarData = dataUrl;
            localStorage.setItem('chatmess_session', JSON.stringify(this.user));
            // Update sidebar avatar
            const av = document.getElementById('myAvatar');
            av.style.backgroundImage = `url(${dataUrl})`;
            av.style.backgroundSize = 'cover';
            av.textContent = '';
            // Update profile preview
            const prev = document.getElementById('profileAvPreview');
            prev.style.backgroundImage = `url(${dataUrl})`;
            prev.style.backgroundSize = 'cover';
            prev.textContent = '';
            this.toast('✅ Đã đổi avatar!', 'success');
        } catch (e) { this.toast('❌ Lỗi: ' + e.message, 'error'); }
    }

    // Helper: render avatar element HTML
    makeAvatarEl(u, cls) {
        if (u && u.avatarData) {
            return `<div class="${cls}" style="background-image:url(${u.avatarData});background-size:cover;background-color:transparent"></div>`;
        }
        return `<div class="${cls}" style="background:${u?.color||'#5865F2'}">${(u?.displayName||'?').charAt(0).toUpperCase()}</div>`;
    }

    listenRooms() {
        db.ref('rooms').on('value', snap => {
            this.allRooms = snap.val() || {};
            this.renderRoomsList();
        });
    }

    renderRoomsList() {
        const search = document.getElementById('searchInput').value.toLowerCase();
        let publicHTML = '';
        let myPrivateHTML = '';
        let friendRoomHTML = '';

        Object.entries(this.allRooms).forEach(([id, room]) => {
            const info = room.info || {};
            if (search && !(info.name || '').toLowerCase().includes(search)) return;

            const isActive = id === this.currentRoom && this.chatMode === 'room';
            const isOwner = info.owner === this.user.uid;
            const isFriendRoom = info.isPrivate && info.owner !== this.user.uid && this.friends[info.owner];

            let badges = '';
            if (isOwner) badges += '<span class="room-owner-badge">👑 Bạn</span>';
            if (info.isPrivate) badges += '<span class="room-private-badge">🔒</span>';

            const html = `<div class="room-item ${isActive?'active':''}" data-room="${id}">
                <div class="room-icon-box">${info.icon||'#'}</div>
                <div class="room-details"><div class="room-name">${info.name||id} ${badges}</div>
                <div class="room-last-msg">${info.desc||''}</div></div></div>`;

            if (info.isPrivate) {
                if (isOwner) myPrivateHTML += html;
                else if (isFriendRoom) friendRoomHTML += html;
                // Không hiện phòng private của người lạ
            } else {
                publicHTML += html;
            }
        });

        document.getElementById('publicRoomList').innerHTML = publicHTML || '<p style="padding:8px 14px;color:var(--text-muted);font-size:12px">Chưa có phòng</p>';
        document.getElementById('myPrivateRoom').innerHTML = myPrivateHTML || '<p style="padding:8px 14px;color:var(--text-muted);font-size:12px">Chưa tạo phòng riêng</p>';
        document.getElementById('friendRoomList').innerHTML = friendRoomHTML || '<p style="padding:8px 14px;color:var(--text-muted);font-size:12px">Chưa có</p>';

        // Click events
        document.querySelectorAll('.room-item').forEach(el => {
            el.addEventListener('click', () => this.switchRoom(el.dataset.room));
        });
    }

    switchRoom(roomId) {
        const room = this.allRooms[roomId];
        const info = room?.info || {};

        // 🔒 Kiểm tra quyền truy cập phòng riêng
        if (info.isPrivate && info.owner !== this.user.uid && !this.friends[info.owner]) {
            this.chatMode = 'room';
            this.currentRoom = roomId;
            document.getElementById('chatHeader').classList.remove('hidden');
            document.getElementById('dmHeader').classList.add('hidden');
            document.getElementById('roomName').textContent = info.name || roomId;
            document.getElementById('roomDesc').textContent = '🔒 Phòng riêng';
            document.getElementById('roomIcon').textContent = info.icon || '🔒';

            document.getElementById('accessDenied').classList.remove('hidden');
            document.getElementById('messagesContainer').classList.add('hidden');
            document.getElementById('inputArea').classList.add('hidden');
            document.getElementById('deleteRoomBtn').style.display = 'none';
            return;
        }

        this.chatMode = 'room';
        this.currentRoom = roomId;
        this.currentDM = null;

        document.getElementById('chatHeader').classList.remove('hidden');
        document.getElementById('dmHeader').classList.add('hidden');
        document.getElementById('accessDenied').classList.add('hidden');
        document.getElementById('messagesContainer').classList.remove('hidden');
        document.getElementById('inputArea').classList.remove('hidden');

        document.getElementById('roomName').textContent = info.name || roomId;
        document.getElementById('roomDesc').textContent = info.desc || '';
        document.getElementById('roomIcon').textContent = info.icon || '#';

        // Show delete button nếu là owner
        const isOwner = info.owner === this.user.uid;
        document.getElementById('deleteRoomBtn').style.display = isOwner ? '' : 'none';

        this.loadMessages();
        document.getElementById('sidebar').classList.remove('open');
        this.renderRoomsList();
    }

    // 🆕 TẠO PHÒNG (public/private)
    createRoom() {
        const name = document.getElementById('newRoomName').value.trim();
        if (!name) { this.toast('⚠️ Nhập tên phòng!', 'warning'); return; }
        const desc = document.getElementById('newRoomDesc').value.trim();
        const icon = document.querySelector('.icon-pick.active')?.dataset.icon || '💬';
        const type = document.querySelector('input[name="roomType"]:checked')?.value || 'public';
        const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-') + '_' + Date.now().toString(36);

        db.ref('rooms/' + id + '/info').set({
            name, icon, desc: desc || name,
            isPrivate: type === 'private',
            owner: this.user.uid,
            ownerName: this.user.displayName,
            created: Date.now()
        });

        document.getElementById('newRoomDialog').classList.add('hidden');
        document.getElementById('newRoomName').value = '';
        document.getElementById('newRoomDesc').value = '';
        this.switchRoom(id);
        this.toast('🎉 Phòng "' + name + '" đã tạo!', 'success');
    }

    // 🆕 XOÁ PHÒNG
    deleteRoom() {
        const roomId = this.currentRoom;
        const info = this.allRooms[roomId]?.info;
        if (!info || info.owner !== this.user.uid) { this.toast('⚠️ Chỉ chủ phòng mới xoá được!', 'warning'); return; }

        document.getElementById('deleteRoomDialog').classList.remove('hidden');
    }

    confirmDeleteRoom() {
        const roomId = this.currentRoom;
        db.ref('rooms/' + roomId).remove();
        document.getElementById('deleteRoomDialog').classList.add('hidden');
        this.switchRoom('general');
        this.toast('🗑️ Đã xoá phòng!', 'success');
    }

    // ============================================
    // 💬 MESSAGES
    // ============================================
    loadMessages() {
        if (this.msgRef) this.msgRef.off();
        if (this.typingRef) this.typingRef.off();

        document.getElementById('messagesWrapper').innerHTML = '';

        const path = this.chatMode === 'dm'
            ? 'dms/' + this.getDMKey(this.user.uid, this.currentDM) + '/messages'
            : 'rooms/' + this.currentRoom + '/messages';

        this.msgRef = db.ref(path).orderByChild('time').limitToLast(100);
        this.msgRef.on('child_added', snap => {
            const msg = snap.val(); msg.id = snap.key;
            this.renderMsg(msg);
            this.scrollBottom();
        });

        // Typing
        const tPath = this.chatMode === 'dm'
            ? 'dms/' + this.getDMKey(this.user.uid, this.currentDM) + '/typing'
            : 'rooms/' + this.currentRoom + '/typing';

        this.typingRef = db.ref(tPath);
        this.typingRef.on('value', snap => {
            const t = snap.val() || {};
            const names = Object.entries(t)
                .filter(([id, v]) => id !== this.user.uid && v.active && Date.now() - v.time < 5000)
                .map(([, v]) => v.name);
            const ind = document.getElementById('typingIndicator');
            if (names.length) { ind.classList.remove('hidden'); document.getElementById('typingText').textContent = names.join(', ') + ' đang gõ...'; }
            else ind.classList.add('hidden');
        });
    }

    renderMsg(msg) {
        const w = document.getElementById('messagesWrapper');
        if (msg.type === 'system') { w.innerHTML += `<div class="system-msg"><span>${msg.text}</span></div>`; return; }

        const mine = msg.userId === this.user.uid;
        const time = new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        let content = '';

        if (msg.replyTo) content += `<div class="msg-reply-box"><div class="msg-reply-name">${this.esc(msg.replyTo.name)}</div>${this.esc(this.trunc(msg.replyTo.text, 50))}</div>`;

        if (msg.censored) {
            content += '<div class="msg-censored">⚠️ Tin nhắn bị lọc</div>';
        } else {
            if (msg.type === 'image' && msg.imageData) content += `<img class="msg-image" src="${msg.imageData}" onclick="document.getElementById('viewerImage').src=this.src;document.getElementById('imageViewer').classList.remove('hidden')">`;
            if (msg.type === 'video' && msg.videoData) content += `<div class="msg-video-wrap" onclick="document.getElementById('viewerVideo').src='${msg.videoData}';document.getElementById('videoViewer').classList.remove('hidden')"><video class="msg-video" src="${msg.videoData}"></video><div class="msg-video-play-hint"><i class="fas fa-play-circle"></i></div></div>`;
            if (msg.text) content += '<div>' + this.fmtText(msg.text) + '</div>';
        }

        const sn = this.esc(msg.name || '?');
        const st = this.esc(this.trunc(msg.text || '', 40)).replace(/'/g, "\\'");

        // Avatar with image support
        const msgUser = Object.values(this.allUsers).find(u => u.username === (msg.name||''));
        const avatarHtml = msgUser?.avatarData
            ? `<div class="msg-avatar" style="background-image:url(${msgUser.avatarData});background-size:cover;background-color:${msg.color||'#5865F2'}"></div>`
            : `<div class="msg-avatar" style="background:${msg.color||'#5865F2'}">${sn.charAt(0).toUpperCase()}</div>`;

        const reportBtn = (!mine && !this.isAdmin && msg.userId)
            ? `<button class="msg-action-btn" onclick="app.openReportDialog('${msg.userId}','${sn}','${sn}')" title="Báo cáo"><i class="fas fa-flag"></i></button>`
            : '';

        w.innerHTML += `<div class="message ${mine?'mine':'other'}" data-mid="${msg.id}">
            ${avatarHtml}
            <div class="msg-content"><div class="msg-name"><span style="color:${mine?'inherit':(msg.color||'#5865F2')}">${sn}</span><span class="msg-time">${time}</span></div>
            <div class="msg-bubble">${content}</div></div>
            <div class="msg-actions">
                <button class="msg-action-btn" onclick="app.replyTo('${msg.id}','${sn}','${st}')"><i class="fas fa-reply"></i></button>
                <button class="msg-action-btn" onclick="navigator.clipboard.writeText('${st}');app.toast('📋 Copied!','info')"><i class="fas fa-copy"></i></button>
                ${reportBtn}
                ${mine?`<button class="msg-action-btn" onclick="app.deleteMsg('${msg.id}')"><i class="fas fa-trash"></i></button>`:''}
            </div></div>`;

        if (!mine && this.soundOn) this.playSound();
    }

    sendMessage() {
        const input = document.getElementById('messageInput');
        const text = input.value.trim();
        if (!text) return;

        const isRoom = this.chatMode === 'room';
        const { clean, censored } = censorText(text, isRoom);

        if (censored && isRoom) {
            document.getElementById('censorWarning').classList.remove('hidden');
            setTimeout(() => document.getElementById('censorWarning').classList.add('hidden'), 4000);
        }

        const msg = {
            text: censored && isRoom ? clean : text,
            censored: censored && isRoom,
            name: this.user.displayName,
            userId: this.user.uid,
            color: this.user.color,
            time: firebase.database.ServerValue.TIMESTAMP,
            type: 'text'
        };

        if (this.replyingTo) { msg.replyTo = this.replyingTo; this.cancelReply(); }

        const path = this.chatMode === 'dm'
            ? 'dms/' + this.getDMKey(this.user.uid, this.currentDM) + '/messages'
            : 'rooms/' + this.currentRoom + '/messages';
        db.ref(path).push(msg);
        input.value = '';
        input.style.height = 'auto';
        this.stopTyping();
    }

    sendImage(dataUrl, fileName) {
        if (isNSFW(fileName)) { this.toast('🚫 Ảnh không phù hợp!', 'error'); return; }
        const msg = { text: '', name: this.user.displayName, userId: this.user.uid, color: this.user.color, time: firebase.database.ServerValue.TIMESTAMP, type: 'image', imageData: dataUrl };
        const path = this.chatMode === 'dm' ? 'dms/' + this.getDMKey(this.user.uid, this.currentDM) + '/messages' : 'rooms/' + this.currentRoom + '/messages';
        db.ref(path).push(msg);
        this.toast('📷 Ảnh đã gửi!', 'success');
    }

    sendVideo(dataUrl, fileName) {
        if (isNSFW(fileName)) { this.toast('🚫 Video không phù hợp!', 'error'); return; }
        const msg = { text: '', name: this.user.displayName, userId: this.user.uid, color: this.user.color, time: firebase.database.ServerValue.TIMESTAMP, type: 'video', videoData: dataUrl };
        const path = this.chatMode === 'dm' ? 'dms/' + this.getDMKey(this.user.uid, this.currentDM) + '/messages' : 'rooms/' + this.currentRoom + '/messages';
        db.ref(path).push(msg);
        this.toast('🎬 Video đã gửi!', 'success');
    }

    replyTo(id, name, text) {
        this.replyingTo = { id, name, text };
        document.getElementById('replyPreview').classList.remove('hidden');
        document.getElementById('replyTo').textContent = '↩️ Trả lời ' + name;
        document.getElementById('replyText').textContent = text;
        document.getElementById('messageInput').focus();
    }

    cancelReply() { this.replyingTo = null; document.getElementById('replyPreview').classList.add('hidden'); }

    deleteMsg(id) {
        if (!confirm('Xoá tin nhắn?')) return;
        const path = this.chatMode === 'dm' ? 'dms/' + this.getDMKey(this.user.uid, this.currentDM) + '/messages/' + id : 'rooms/' + this.currentRoom + '/messages/' + id;
        db.ref(path).remove();
        const el = document.querySelector('[data-mid="' + id + '"]');
        if (el) { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }
        this.toast('🗑️ Xoá rồi!', 'info');
    }

    // Typing
    startTyping() {
        const path = this.chatMode === 'dm' ? 'dms/' + this.getDMKey(this.user.uid, this.currentDM) + '/typing/' + this.user.uid : 'rooms/' + this.currentRoom + '/typing/' + this.user.uid;
        db.ref(path).set({ name: this.user.displayName, active: true, time: Date.now() });
        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => this.stopTyping(), 3000);
    }

    stopTyping() {
        const path = this.chatMode === 'dm' ? 'dms/' + this.getDMKey(this.user.uid, this.currentDM) + '/typing/' + this.user.uid : 'rooms/' + this.currentRoom + '/typing/' + this.user.uid;
        db.ref(path).set({ active: false });
    }

    // Search messages
    searchMsgs(q) {
        if (!q) { document.getElementById('searchResults').innerHTML = '<div class="empty-state small"><p>Nhập từ khoá 🔍</p></div>'; return; }
        const path = this.chatMode === 'dm' ? 'dms/' + this.getDMKey(this.user.uid, this.currentDM) + '/messages' : 'rooms/' + this.currentRoom + '/messages';
        db.ref(path).once('value', snap => {
            const results = [];
            snap.forEach(c => { const m = c.val(); if (m.text && m.text.toLowerCase().includes(q.toLowerCase())) results.push(m); });
            const el = document.getElementById('searchResults');
            if (!results.length) { el.innerHTML = '<div class="empty-state small"><p>Không tìm thấy 😅</p></div>'; return; }
            el.innerHTML = results.slice(-15).map(m => `<div class="search-result-item"><strong style="color:${m.color}">${this.esc(m.name)}</strong>: ${m.text.replace(new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>')}<br><small>${new Date(m.time).toLocaleString()}</small></div>`).join('');
        });
    }

    // ============================================
    // 😀 EMOJI
    // ============================================
    setupEmoji() {
        this.renderEmojis('smileys');
        document.querySelectorAll('.ecat').forEach(b => b.addEventListener('click', () => {
            document.querySelectorAll('.ecat').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
            this.renderEmojis(b.dataset.cat);
        }));
    }

    renderEmojis(cat) {
        const g = document.getElementById('emojiGrid');
        g.innerHTML = (this.EMOJIS[cat] || []).map(e => `<div class="emoji-item" data-e="${e}">${e}</div>`).join('');
        g.querySelectorAll('.emoji-item').forEach(i => i.addEventListener('click', () => {
            document.getElementById('messageInput').value += i.dataset.e;
            document.getElementById('messageInput').focus();
        }));
    }

    // ============================================
    // 🎹 EVENTS
    // ============================================
    bindEvents() {
        document.getElementById('sendBtn').addEventListener('click', () => this.sendMessage());
        const input = document.getElementById('messageInput');
        input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && this.enterSend) { e.preventDefault(); this.sendMessage(); } });
        input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; this.startTyping(); });

        document.getElementById('emojiBtn').addEventListener('click', e => { e.stopPropagation(); document.getElementById('emojiPicker').classList.toggle('hidden'); });
        document.addEventListener('click', e => { if (!e.target.closest('.emoji-picker') && !e.target.closest('.emoji-btn')) document.getElementById('emojiPicker').classList.add('hidden'); });

        // Attach menu toggle
        document.getElementById('attachBtn').addEventListener('click', e => {
            e.stopPropagation();
            document.getElementById('attachMenu').classList.toggle('hidden');
        });
        document.addEventListener('click', e => {
            if (!e.target.closest('.attach-wrap')) document.getElementById('attachMenu').classList.add('hidden');
        });
        document.getElementById('pickImageBtn').addEventListener('click', () => {
            document.getElementById('attachMenu').classList.add('hidden');
            document.getElementById('imageInput').click();
        });
        document.getElementById('imageInput').addEventListener('change', e => {
            const f = e.target.files[0]; if (!f) return;
            if (f.size > 2000000) { this.toast('⚠️ Ảnh tối đa 2MB!', 'warning'); e.target.value=''; return; }
            const r = new FileReader();
            r.onload = ev => this.sendImage(ev.target.result, f.name);
            r.readAsDataURL(f); e.target.value = '';
        });
        document.getElementById('pickVideoBtn').addEventListener('click', () => {
            document.getElementById('attachMenu').classList.add('hidden');
            document.getElementById('videoInput').click();
        });
        document.getElementById('videoInput').addEventListener('change', e => {
            const f = e.target.files[0]; if (!f) return;
            if (f.size > 10000000) { this.toast('⚠️ Video tối đa 10MB!', 'warning'); e.target.value=''; return; }
            this.toast('⏳ Đang xử lý video...', 'info');
            const r = new FileReader();
            r.onload = ev => this.sendVideo(ev.target.result, f.name);
            r.readAsDataURL(f); e.target.value = '';
        });

        document.getElementById('replyClose').addEventListener('click', () => this.cancelReply());

        // Sidebar tabs
        document.querySelectorAll('.sidebar-tab').forEach(t => t.addEventListener('click', () => {
            document.querySelectorAll('.sidebar-tab').forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            document.getElementById('roomsTab').classList.toggle('hidden', t.dataset.tab !== 'rooms');
            document.getElementById('dmsTab').classList.toggle('hidden', t.dataset.tab !== 'dms');
        }));

        // Friends
        document.getElementById('friendsBtn').addEventListener('click', () => document.getElementById('friendsDialog').classList.remove('hidden'));
        document.querySelectorAll('.ftab').forEach(t => t.addEventListener('click', () => {
            document.querySelectorAll('.ftab').forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            document.querySelectorAll('.ftab-content').forEach(c => c.classList.add('hidden'));
            document.getElementById('ftab-' + t.dataset.ftab).classList.remove('hidden');
        }));
        document.getElementById('searchUserInput').addEventListener('input', e => this.searchUsers(e.target.value));

        // Rooms
        document.getElementById('newRoomBtn').addEventListener('click', () => document.getElementById('newRoomDialog').classList.remove('hidden'));
        document.getElementById('createRoomBtn').addEventListener('click', () => this.createRoom());
        document.getElementById('searchInput').addEventListener('input', () => this.renderRoomsList());

        // Delete room
        document.getElementById('deleteRoomBtn').addEventListener('click', () => this.deleteRoom());
        document.getElementById('confirmDeleteRoom').addEventListener('click', () => this.confirmDeleteRoom());

        // DM
        document.getElementById('dmBackBtn').addEventListener('click', () => this.switchRoom(this.currentRoom || 'general'));
        document.getElementById('dmUnfriendBtn').addEventListener('click', () => { if (this.currentDM) this.unfriend(this.currentDM); });

        // Search msgs
        document.getElementById('searchMsgBtn').addEventListener('click', () => document.getElementById('searchMsgDialog').classList.remove('hidden'));
        document.getElementById('searchMsgInput').addEventListener('input', e => this.searchMsgs(e.target.value));

        // Dark mode
        document.getElementById('darkModeBtn').addEventListener('click', () => this.toggleDark());
        document.getElementById('darkToggle').addEventListener('change', () => this.toggleDark());

        // Settings
        document.getElementById('settingsBtn').addEventListener('click', () => {
            // Pre-fill profile fields
            document.getElementById('editDisplayName').value = this.user.displayName;
            const prev = document.getElementById('profileAvPreview');
            if (this.user.avatarData) {
                prev.style.backgroundImage = `url(${this.user.avatarData})`;
                prev.style.backgroundSize = 'cover';
                prev.textContent = '';
            } else {
                prev.style.backgroundImage = '';
                prev.textContent = this.user.displayName.charAt(0).toUpperCase();
                prev.style.background = this.user.color;
            }
            document.getElementById('settingsDialog').classList.remove('hidden');
        });
        document.getElementById('profileAvEdit').addEventListener('click', () => document.getElementById('avatarInput').click());
        document.getElementById('avatarInput').addEventListener('change', e => {
            const f = e.target.files[0]; if (!f) return;
            if (f.size > 150000) { this.toast('⚠️ Ảnh avatar tối đa 150KB!', 'warning'); e.target.value=''; return; }
            const r = new FileReader();
            r.onload = ev => this.saveAvatar(ev.target.result);
            r.readAsDataURL(f); e.target.value = '';
        });
        document.getElementById('saveProfileBtn').addEventListener('click', () => this.saveProfile());
        document.getElementById('soundToggle').addEventListener('change', e => this.soundOn = e.target.checked);
        document.getElementById('enterToggle').addEventListener('change', e => this.enterSend = e.target.checked);

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        document.getElementById('logoutSidebarBtn').addEventListener('click', () => this.logout());

        // Delete account
        document.getElementById('deleteAccountBtn')?.addEventListener('click', async () => {
            if (!confirm('⚠️ XOÁ TÀI KHOẢN VĨNH VIỄN?\nKhông thể hoàn tác!')) return;
            await db.ref('accounts/' + this.user.username).remove();
            await db.ref('users/' + this.user.uid).remove();
            localStorage.removeItem('chatmess_session');
            this.toast('💀 Tài khoản đã xoá!', 'error');
            setTimeout(() => location.reload(), 1500);
        });

        // Scroll
        const mc = document.getElementById('messagesContainer');
        mc.addEventListener('scroll', () => {
            document.getElementById('scrollBottomBtn').classList.toggle('hidden', mc.scrollHeight - mc.scrollTop - mc.clientHeight < 80);
        });
        document.getElementById('scrollBottomBtn').addEventListener('click', () => this.scrollBottom());

        // Mobile
        document.getElementById('mobileMenuBtn').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
        document.getElementById('mobileMenuBtn2')?.addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));

        // Admin panel
        document.getElementById('adminBtn').addEventListener('click', () => {
            this.renderAdminUsers();
            document.getElementById('adminDialog').classList.remove('hidden');
        });
        document.querySelectorAll('.atab').forEach(t => t.addEventListener('click', () => {
            document.querySelectorAll('.atab').forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            document.querySelectorAll('.atab-content').forEach(c => c.classList.add('hidden'));
            document.getElementById('atab-' + t.dataset.atab).classList.remove('hidden');
            if (t.dataset.atab === 'users') this.renderAdminUsers();
        }));
        document.getElementById('sendBroadcastBtn').addEventListener('click', () => this.sendBroadcast());
        document.getElementById('banUserBtn').addEventListener('click', () => this.banUser(false));
        document.getElementById('unbanUserBtn').addEventListener('click', () => this.banUser(true));

        // Report
        document.getElementById('submitReportBtn').addEventListener('click', () => this.submitReport());

        // Close dialogs
        document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => document.getElementById(b.dataset.close).classList.add('hidden')));
        document.querySelectorAll('.dialog-overlay').forEach(o => o.addEventListener('click', e => { if (e.target === o) o.classList.add('hidden'); }));

        // Image viewer
        document.getElementById('imageViewer').addEventListener('click', e => { if (e.target === document.getElementById('imageViewer')) document.getElementById('imageViewer').classList.add('hidden'); });
    }

    // ============================================
    // 🔧 UTILS
    // ============================================
    fmtText(t) {
        let s = this.esc(t);
        s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
        s = s.replace(/`(.+?)`/g, '<code style="background:rgba(0,0,0,0.06);padding:1px 6px;border-radius:4px;font-size:12px">$1</code>');
        // Styled link cards
        s = s.replace(/(https?:\/\/[^\s&lt;&gt;"]+)/g, (url) => {
            let domain = '';
            try { domain = new URL(url).hostname.replace('www.',''); } catch(e) { domain = url; }
            return `<a href="${url}" target="_blank" rel="noopener" class="msg-link-card"><i class="fas fa-link"></i> <span class="link-domain">${domain}</span><span class="link-url">${url}</span></a>`;
        });
        s = s.replace(/\n/g, '<br>');
        return s;
    }
    esc(s) { return s ? s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; }
    trunc(s, l) { return s && s.length > l ? s.substr(0, l) + '...' : (s || ''); }
    scrollBottom() { const c = document.getElementById('messagesContainer'); setTimeout(() => c.scrollTop = c.scrollHeight, 50); }
    toggleDark() {
        this.isDark = !this.isDark;
        document.body.classList.toggle('dark-mode', this.isDark);
        document.querySelector('#darkModeBtn i').className = this.isDark ? 'fas fa-sun' : 'fas fa-moon';
        document.getElementById('darkToggle').checked = this.isDark;
    }
    playSound() {
        try {
            const c = new (window.AudioContext || window.webkitAudioContext)();
            const o = c.createOscillator(); const g = c.createGain();
            o.connect(g); g.connect(c.destination);
            o.frequency.value = 800; o.type = 'sine'; g.gain.value = 0.08;
            o.start(); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
            o.stop(c.currentTime + 0.15);
        } catch (e) {}
    }
    toast(msg, type = 'info') {
        const c = document.getElementById('toastContainer');
        const t = document.createElement('div');
        t.className = 'toast ' + type;
        const ic = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
        t.innerHTML = '<i class="fas ' + (ic[type] || ic.info) + '"></i><span>' + msg + '</span>';
        c.appendChild(t);
        setTimeout(() => { t.style.animation = 'toastOut .3s ease forwards'; setTimeout(() => t.remove(), 300); }, 3000);
    }
    createParticles() {
        const c = document.getElementById('authParticles');
        for (let i = 0; i < 20; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.style.left = Math.random() * 100 + '%';
            p.style.animationDuration = (8 + Math.random() * 12) + 's';
            p.style.animationDelay = Math.random() * 10 + 's';
            p.style.width = p.style.height = (3 + Math.random() * 5) + 'px';
            c.appendChild(p);
        }
    }
}

// 🚀 GO!
let app;
document.addEventListener('DOMContentLoaded', () => { app = new ChatMess(); });