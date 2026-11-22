/* ================================================================
   story-patch.js  v1.7
   v1.7 新增 / 修复（在 v1.6 基础上）：
   1. 【锁屏解锁兼容性】重写 PAGES.lock 的 mount：
      - 同时绑定 touchstart/touchmove/touchend 与 pointerdown/pointerup
      - 滑动阈值降到 30px，横向容差 100px
      - 点击兜底：点底部"上滑解锁"提示 / 手写区 / 顶部时间区 也能进密码
      - 桌面端点击任意空白处直接进密码
   2. 【头像颜色】avatarColor 改用 Array.from + codePointAt，
      彻底修复不同 emoji 落到同一紫色的问题；
      个人资料页新增"头像底色"选择器（12 色 + 默认），
      自己发的消息头像 / 设置页头像使用自定义色。
   3. 【消息频率】新增 themSayP 包装，所有剧情对话延迟 ×1.3，
      稍微放慢节奏，方便看清。
   4. 保留 v1.6 全部修复（forumLikes 崩溃兜底、每页 12 App、
      好友申请时序、预推消息、论坛互动、个人资料、默认关通知抖动）。
   放置位置：主 HTML </body> 之前，独立文件 story-patch.js
   ================================================================ */
(function () {
  'use strict';

  function ready(fn) {
    if (typeof PAGES !== 'undefined' &&
        typeof STORY !== 'undefined' &&
        typeof Router !== 'undefined' &&
        typeof CursorGuide !== 'undefined' &&
        typeof NotifService !== 'undefined' &&
        typeof Typewriter !== 'undefined' &&
        typeof themSay !== 'undefined' &&
        typeof refreshChat !== 'undefined' &&
        typeof CHOICES !== 'undefined' &&
        typeof APP_LIST !== 'undefined' &&
        typeof DOCK_APPS !== 'undefined' &&
        typeof state !== 'undefined') {
      fn();
    } else {
      setTimeout(function () { ready(fn); }, 80);
    }
  }

  ready(function () {

    /* ============================================================
       0. 注入补丁专用样式
       ============================================================ */
    var st = document.createElement('style');
    st.textContent =
      '.home-grid{padding-bottom:20px;align-content:start;gap:14px 4px}' +
      '.app-name{min-height:14px;display:block;line-height:1.2}' +
      '.floor-actions{display:flex;gap:6px;margin-top:6px;align-items:center;flex-wrap:wrap}' +
      '.floor-btn{background:none;border:none;font-size:var(--fs-xs);color:var(--c-text-2);padding:4px 8px;border-radius:6px;cursor:pointer;min-height:28px;display:inline-flex;align-items:center;gap:2px}' +
      '.floor-btn:active{background:var(--c-card-2)}' +
      '.floor-btn.liked{color:var(--c-accent)}' +
      '.floor-reply{margin-top:6px;padding:8px 10px;background:var(--c-card-2);border-radius:8px;font-size:var(--fs-s);line-height:1.5;overflow-wrap:anywhere}' +
      '.post-like-btn{background:none;border:none;font-size:var(--fs-xs);color:var(--c-text-3);padding:2px 8px;border-radius:6px;cursor:pointer;display:inline-flex;align-items:center;gap:3px}' +
      '.post-like-btn.liked{color:var(--c-accent)}' +
      '.profile-avatar-grid{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}' +
      '.profile-avatar-opt{width:52px;height:52px;border-radius:14px;border:2px solid transparent;background:var(--c-card-2);font-size:26px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.3)}' +
      '.profile-avatar-opt.on{border-color:var(--c-accent);box-shadow:0 0 0 2px var(--c-accent-soft)}' +
      '.profile-color-grid{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}' +
      '.profile-color-opt{width:40px;height:40px;border-radius:12px;border:2px solid transparent;cursor:pointer;padding:0;font-size:10px;font-weight:600;color:#fff;display:flex;align-items:center;justify-content:center;text-shadow:0 1px 2px rgba(0,0,0,.4)}' +
      '.profile-color-opt.on{border-color:var(--c-accent);box-shadow:0 0 0 2px var(--c-accent-soft)}';
    document.head.appendChild(st);

    /* ============================================================
       1. 头像颜色工具（v1.7：用 Array.from + codePointAt 支持 emoji）
       ============================================================ */
    var PALETTE = [
      '#5B8FF9', '#F6903D', '#F6BD16', '#7262FD',
      '#78D3F8', '#9661BC', '#F08BB4', '#3FB37F',
      '#E8684A', '#9270CA', '#5AD8A6', '#E8A585'
    ];
    function avatarColor(name) {
      if (!name) return PALETTE[0];
      var h = 5381;
      var chars = Array.from(String(name));
      for (var i = 0; i < chars.length; i++) {
        h = ((h << 5) + h) + chars[i].codePointAt(0);
      }
      h = h >>> 0;
      return PALETTE[h % PALETTE.length];
    }
    function avatarStyle(name) { return 'background:' + avatarColor(name) + ';'; }
    function profileAvatar() {
      ensureStateFields();
      return (state.profile && state.profile.avatar) || '🫥';
    }
    function profileName() {
      ensureStateFields();
      return (state.profile && state.profile.name) || '陈默';
    }
    // v1.7：自己的头像优先使用自定义底色
    function myAvatarStyle() {
      ensureStateFields();
      var c = state.profile && state.profile.color;
      if (c && c !== 'default') return 'background:' + c + ';';
      return avatarStyle(profileAvatar());
    }

    /* ============================================================
       2. 状态字段兜底
       ============================================================ */
    function ensureStateFields() {
      if (!state) return;
      if (!state.profile) state.profile = { name: '陈默', avatar: '🫥', color: 'default' };
      if (state.profile.color === undefined) state.profile.color = 'default';
      if (!state.forumLikes) state.forumLikes = {};
      if (!state.forumReplies) state.forumReplies = {};
      if (!state.flags) state.flags = {};
      if (!state.db) state.db = {};
      if (!state.settings) state.settings = {};
    }
    ensureStateFields();

    /* ============================================================
       2.1 默认关闭"通知抖动"伪 bug（一次性）
       ============================================================ */
    if (!state.patchDefaults) state.patchDefaults = {};
    if (!state.patchDefaults.bugNotifyOff) {
      state.settings.bugNotify = false;
      state.patchDefaults.bugNotifyOff = true;
      save();
    }

    /* ============================================================
       2.2 v1.7：消息延迟工具（×1.3）
       ============================================================ */
    var MSG_SPEED = 1.3;
    async function themSayP(cid, name, text, delay) {
      return themSay(cid, name, text, Math.round((delay || 1500) * MSG_SPEED));
    }

    /* ============================================================
       3. 数据初始化 / 旧存档兼容
       ============================================================ */
    if (!state.flags.grp3done) {
      state.db.friendRequests = (state.db.friendRequests || []).filter(function (f) {
        return !(f.from === '临爽' && f.status === 'pending');
      });
    }
    if (state.flags.readPost1 && state.db.chats.by &&
        !state.db.chats.by.messages.some(function (m) { return m.text === '我靠别搞啊，有点吓人了'; })) {
      state.db.chats.by.messages.push({
        id: uid('m'), from: '临爽',
        text: '我靠别搞啊，有点吓人了',
        time: '2025-05-08 18:16'
      });
    }
    if (state.flags.readNotice && state.db.chats.by &&
        !state.db.chats.by.messages.some(function (m) { return m.text === '你们看新的通知了没？'; })) {
      state.db.chats.by.messages.push({
        id: uid('m'), from: '张夏夏',
        text: '你们看新的通知了没？',
        time: '2025-05-08 18:30'
      });
    }

    var MORE_POSTS = [
      { id: 'p5', board: 'gossip', author: '路过的风', title: '寒潮封校，宿舍暖气为什么是凉的？',
        time: '2025-05-07 22:15', hot: false, pinned: false, locked: false,
        floors: [
          { n: 2, user: '冬眠中', text: '同感，我穿了两件外套还是冷' },
          { n: 3, user: '路过的风', quote: '冬眠中', text: '后勤说管道检修，不知道要修多久' },
          { n: 4, user: '雪上加霜', text: '这波寒潮来得很突然啊' }
        ] },
      { id: 'p6', board: 'gossip', author: '不吃香菜', title: '7号楼最近晚上总有人在楼道里走',
        time: '2025-05-05 23:48', hot: true, pinned: false, locked: false,
        floors: [
          { n: 2, user: '不吃香菜', text: '昨晚 11 点多我出去接水，听见楼上一直有脚步声' },
          { n: 3, user: '夜猫子', text: '四楼？我也听到过' },
          { n: 4, user: '纯情蟑螂火辣辣', text: '别吓人啊，说不定是宿管巡楼' },
          { n: 5, user: '冬眠中', quote: '纯情蟑螂火辣辣', text: '宿管巡楼穿拖鞋？' }
        ] },
      { id: 'p7', board: 'study', author: '学霸本霸', title: '期中物理复习资料整理（可自取）',
        time: '2025-05-04 19:30', hot: false, pinned: false, locked: false,
        floors: [
          { n: 2, user: '学霸本霸', text: '整理了一份电磁学+光学的重点，有需要的同学看置顶链接' },
          { n: 3, user: '学渣在线', text: '大佬！' }
        ] },
      { id: 'p8', board: 'lost', author: '失物招领处', title: '7号楼二层的吹风机是谁的？',
        time: '2025-05-03 20:00', hot: false, pinned: false, locked: false,
        floors: [
          { n: 2, user: '失物招领处', text: '挂在洗漱间三天了，失主来宿管处认领' }
        ] },
      { id: 'p9', board: 'gossip', author: '韦二敏', title: '有没有人觉得最近小渠越来越像个人了',
        time: '2025-05-02 21:11', hot: false, pinned: false, locked: false,
        floors: [
          { n: 2, user: '韦二敏', text: '问它什么问题都能答上来，语气还很自然' },
          { n: 3, user: '404NotFound', text: 'AI 升级了吧，正常' },
          { n: 4, user: '早八人', text: '别瞎想，写作业去吧' }
        ] },
      { id: 'p10', board: 'gossip', author: '固执的鱼', title: '5月1日的校园落日真的绝了',
        time: '2025-05-01 18:42', hot: false, pinned: false, locked: false,
        floors: [
          { n: 2, user: '固执的鱼', text: '操场边拍了张照，天色太美了' },
          { n: 3, user: '好想刻薄地活一次', text: '那天我也在' }
        ] }
    ];
    MORE_POSTS.forEach(function (p) {
      if (!state.db.forum.posts.some(function (x) { return x.id === p.id; })) {
        state.db.forum.posts.push(p);
      }
    });
    save();

    function baseLikes(key) {
      var h = 5381;
      for (var i = 0; i < key.length; i++) h = ((h << 5) + h) + key.charCodeAt(i);
      h = h >>> 0;
      return (h % 20) + 1;
    }

    /* ============================================================
       4. PAGES.home —— 每页 12 个
       ============================================================ */
    PAGES.home = function () {
      ensureStateFields();
      var perPage = 12;
      var pages = [];
      for (var i = 0; i < APP_LIST.length; i += perPage) pages.push(APP_LIST.slice(i, i + perPage));
      var unreadMsgs = Object.keys(state.unread || {}).reduce(function (s, k) { return s + (state.unread[k] || 0); }, 0);

      var gridHtml = pages.map(function (pg) {
        return '<div class="home-grid">' + pg.map(function (a) {
          var badge = '';
          if (a.id === 'messages' && unreadMsgs > 0) badge = unreadMsgs > 99 ? '99+' : String(unreadMsgs);
          return '<button class="app-item" data-action="open-app" data-app="' + esc(a.id) + '" aria-label="' + esc(a.name) + '">' +
            '<div class="app-icon">' + a.icon + (badge ? '<span class="badge">' + badge + '</span>' : '') + '</div>' +
            '<div class="app-name">' + esc(a.name) + '</div>' +
          '</button>';
        }).join('') + '</div>';
      }).join('');

      var now = sysNow();
      var w = state.db.weather;

      return {
        html: '<div class="page home-page">' +
          '<div class="home-widget">' +
            '<div>' +
              '<div class="w-time">' + fmtHM(now) + '</div>' +
              '<div class="w-date">' + (now.getMonth() + 1) + '月' + now.getDate() + '日 ' + WEEK_CN[now.getDay()] + '</div>' +
            '</div>' +
            '<div class="w-right">' +
              '<div class="w-temp">' + w.now.temp + '°</div>' +
              '<div class="w-desc">' + esc(w.now.desc) + ' · 寒潮红色预警</div>' +
            '</div>' +
          '</div>' +
          '<div class="home-search" data-action="open-search"><span>🔍</span><span>搜索 App、联系人、设置</span></div>' +
          '<div class="home-pages" id="home-pages">' + gridHtml + '</div>' +
          '<div class="page-dots" id="home-dots">' + pages.map(function (_, i) { return '<i class="' + (i === 0 ? 'on' : '') + '"></i>'; }).join('') + '</div>' +
          '<div class="dock">' + DOCK_APPS.map(function (id) {
            var a = APP_LIST.find(function (x) { return x.id === id; });
            if (!a) return '';
            return '<button class="app-item" data-action="open-app" data-app="' + esc(a.id) + '" aria-label="' + esc(a.name) + '">' +
              '<div class="app-icon">' + a.icon + '</div>' +
              '<div class="app-name">' + esc(a.name) + '</div>' +
            '</button>';
          }).join('') + '</div>' +
        '</div>',
        mount: function (root) {
          var hp = root.querySelector('#home-pages');
          var dots = Array.prototype.slice.call(root.querySelectorAll('#home-dots i'));
          if (hp) {
            hp.addEventListener('scroll', function () {
              var idx = Math.round(hp.scrollLeft / hp.clientWidth);
              dots.forEach(function (d, i) { d.classList.toggle('on', i === idx); });
            }, { passive: true });
          }
          var pressTimer = null;
          root.addEventListener('pointerdown', function (e) {
            if (!e.target.closest('.app-item')) return;
            pressTimer = setTimeout(function () {
              document.body.classList.add('jiggle');
              vibrate(20);
              setTimeout(function () { document.body.classList.remove('jiggle'); }, 1200);
            }, 650);
          });
          ['pointerup', 'pointercancel', 'pointermove'].forEach(function (ev) {
            root.addEventListener(ev, function () { clearTimeout(pressTimer); });
          });

          if (flag('needMsgGuide') && !flag('msgGuideDone')) {
            setTimeout(function () { CursorGuide.show('[data-app="messages"]', '去看看消息吧'); }, 900);
          }
          if (flag('forumGuided') && !flag('forumVisited')) {
            setTimeout(function () { CursorGuide.show('[data-app="forum"]', '去看看渠中校园论坛'); }, 900);
          }
        }
      };
    };

    /* ============================================================
       5. PAGES.lock —— v1.7 重写 mount：滑动/点击 双兜底
       ============================================================ */
    var origLock = PAGES.lock;
    PAGES.lock = function () {
      var def = origLock();
      def.mount = function (root) {
        var page = root.querySelector('#lock-page');
        if (!page) return;

        var unlocked = false;
        var openPin = function () {
          if (unlocked) return;
          unlocked = true;
          if (typeof showPin === 'function') {
            try { showPin(root); } catch (e) { console.error(e); }
          }
        };

        var startX = 0, startY = 0, tracking = false;
        var lastTouchEnd = 0;

        var onStart = function (x, y, target) {
          if (target && target.closest && target.closest('.lock-notif')) return;
          startX = x; startY = y; tracking = true;
        };
        var onMove = function (x, y, evt) {
          if (!tracking) return;
          var dy = startY - y;
          if (dy > 10 && evt && evt.cancelable) {
            try { evt.preventDefault(); } catch (e) {}
          }
        };
        var onEnd = function (x, y) {
          if (!tracking) return;
          tracking = false;
          var dy = startY - y;
          var dx = Math.abs(x - startX);
          // v1.7：阈值降低到 30px，横向容差 100px
          if (dy > 30 && dx < 100) openPin();
        };

        // ---- 触摸事件（移动端优先） ----
        page.addEventListener('touchstart', function (e) {
          if (e.touches.length !== 1) return;
          onStart(e.touches[0].clientX, e.touches[0].clientY, e.target);
        }, { passive: true });

        page.addEventListener('touchmove', function (e) {
          if (e.touches.length !== 1) return;
          onMove(e.touches[0].clientX, e.touches[0].clientY, e);
        }, { passive: false });

        page.addEventListener('touchend', function (e) {
          if (e.changedTouches.length !== 1) return;
          lastTouchEnd = Date.now();
          onEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
        }, { passive: true });

        page.addEventListener('touchcancel', function () {
          tracking = false;
        }, { passive: true });

        // ---- 指针事件（桌面 / 非触摸） ----
        page.addEventListener('pointerdown', function (e) {
          if (e.pointerType === 'touch') return;
          if (Date.now() - lastTouchEnd < 500) return;
          onStart(e.clientX, e.clientY, e.target);
        });
        page.addEventListener('pointerup', function (e) {
          if (e.pointerType === 'touch') return;
          if (Date.now() - lastTouchEnd < 500) return;
          onEnd(e.clientX, e.clientY);
        });
        page.addEventListener('pointercancel', function () {
          tracking = false;
        });

        // ---- 点击兜底 ----
        page.addEventListener('click', function (e) {
          if (e.target.closest('.lock-notif')) return;
          // 桌面端：点任意空白处直接进密码
          if (window.matchMedia('(pointer:fine)').matches) {
            openPin();
            return;
          }
          // 移动端：点底部提示 / 手写区 / 顶部时间区 也能进密码
          if (e.target.closest('.lock-bottom') ||
              e.target.closest('.lock-handwrite') ||
              e.target.closest('.lock-top')) {
            openPin();
          }
        });
      };
      return def;
    };

    /* ============================================================
       6. PAGES.chat
       ============================================================ */
    PAGES.chat = function (params) {
      ensureStateFields();
      var cid = params.id;
      var chat = state.db.chats[cid];
      if (!chat) return simplePage('会话不存在', '<div class="empty">该会话不存在或已被删除。</div>');
      state.unread[cid] = 0;
      save();

      var msgsHtml = '';
      (chat.messages || []).forEach(function (m) {
        if (m.type === 'system') {
          msgsHtml += '<div class="msg-sys">' + esc(m.text) + '</div>';
          return;
        }
        if (m.type === 'card') {
          msgsHtml += '<div class="msg">' +
            '<div class="msg-av" style="' + avatarStyle(chat.name) + '">' + esc(chat.avatar) + '</div>' +
            '<div class="msg-wrap">' +
              '<div class="msg-name">' + esc(m.title) + '</div>' +
              '<div class="gzh-card" data-action="gzh-card">' +
                '<div class="g-title">' + esc(m.title) + '</div>' +
                '<div class="g-desc">' + esc(m.desc) + '</div>' +
                '<div class="g-time">' + esc(m.time) + '</div>' +
              '</div>' +
            '</div>' +
          '</div>';
          return;
        }
        var isMe = m.from === 'me';
        var showName = chat.type === 'group' && !isMe;
        var textHtml = esc(m.text || '');
        if (m.link) {
          textHtml = textHtml.replace(esc(m.link.text),
            '<span class="link" data-action="jump" data-page="' + esc(m.link.page) +
            '" data-params="' + esc(JSON.stringify(m.link.params || {})) + '">' +
            esc(m.link.text) + '</span>');
        }
        var avKey = isMe ? profileName() : (chat.type === 'group' ? (m.from || '?') : chat.name);
        var avEmoji = isMe ? profileAvatar() : (chat.type === 'group' ? (m.from || '?').slice(0, 1) : chat.avatar);
        // v1.7：自己发的消息头像使用自定义底色
        var avStyle = isMe ? myAvatarStyle() : avatarStyle(avKey);
        msgsHtml += '<div class="msg ' + (isMe ? 'me' : '') + '">' +
          '<div class="msg-av" style="' + avStyle + '">' + avEmoji + '</div>' +
          '<div class="msg-wrap">' +
            (showName ? '<div class="msg-name">' + esc(m.from) + '</div>' : '') +
            '<div class="bubble">' + textHtml + '</div>' +
            '<div class="msg-time">' + esc(m.time || '') + '</div>' +
          '</div>' +
        '</div>';
      });

      var inputArea;
      if (state.choice && state.choice.chatId === cid) {
        inputArea = '<div class="choice-bar" id="choice-bar">' +
          state.choice.options.map(function (o) {
            return '<button class="choice-btn" data-action="choose" data-key="' + esc(o.k) + '">' + esc(o.label) + '</button>';
          }).join('') +
        '</div>';
      } else if (chat.type === 'self' || chat.silent) {
        inputArea = '<div class="chat-input"><div class="input-fake dead">发送消息</div></div>';
      } else if (cid === 'mom') {
        inputArea = '<div class="chat-input"><div class="input-fake" data-action="send-blocked" data-chat="mom">发送消息…</div></div>';
      } else {
        inputArea = '<div class="chat-input"><div class="input-fake dead">发送消息…</div></div>';
      }

      return {
        html: '<div class="page">' +
          navBar(chat.name, {
            back: true,
            right: chat.type === 'group'
              ? '<button class="nav-btn" data-action="chat-info" data-id="' + esc(cid) + '">···</button>'
              : ''
          }) +
          '<div class="page-body chat-body" id="chat-body">' +
            (msgsHtml || '<div class="empty">暂无消息</div>') +
          '</div>' +
          inputArea +
        '</div>',
        mount: function (root) {
          var body = root.querySelector('#chat-body');
          if (body) body.scrollTop = body.scrollHeight;
          onOpenChatPatch(cid);
        }
      };
    };

    /* ============================================================
       7. onOpenChatPatch + 剧情续播
       ============================================================ */
    function onOpenChatPatch(cid) {
      if (cid !== 'by') return;
      var chat = state.db.chats.by;

      if (chat.joined === false) {
        chat.joined = true;
        if (!chat.messages.length) {
          chat.messages.push({
            id: uid('m'), type: 'system',
            text: '“王晓歌”被拉入群聊', time: '2025-05-08 18:02'
          });
        }
        save();
        setTimeout(function () { render(); }, 40);
      }

      if (flag('invited') && !flag('grp1msgs')) {
        flag('grp1msgs', true);
        setTimeout(function () { runGroup1Patch(); }, 1000);
        return;
      }
      if (flag('readPost1') && !flag('grp2msgs') &&
          !(state.choice && state.choice.chatId === 'by')) {
        flag('grp2msgs', true);
        setTimeout(function () { runGroup2Patch(); }, 1000);
        return;
      }
      if (flag('pending_s8') && !flag('s8msgs')) {
        flag('pending_s8', false);
        flag('s8msgs', true);
        setTimeout(function () { runScene8MsgsPatch(); }, 1000);
        return;
      }
    }

    async function runGroup1Patch() {
      var cid = 'by';
      await themSayP(cid, '沈敏', '这不是412的？王晓歌？', 1400);
      await themSayP(cid, '沈敏', '卧槽你们拉她干嘛啊！？', 1700);
      await themSayP(cid, '临爽', '？什么，详细说来👂🏻', 1700);
      await themSayP(cid, '沈敏', '也没什么…就，你自己看看论坛', 1700);
      await sleep(1800);
      if (!flag('forumGuided')) {
        flag('forumGuided', true);
        Router.root('home');
        setTimeout(function () { CursorGuide.show('[data-app="forum"]', '去看看渠中校园论坛'); }, 900);
      }
    }

    async function runGroup2Patch() {
      var cid = 'by';
      await themSayP(cid, '许双荞', '群主是周学姐吗？', 1600);
      await themSayP(cid, '沈敏', '@周学姐 学姐拉她干嘛啊啊别来索我命我什么都没干', 1600);
      await sleep(900);
      state.choice = {
        chatId: cid, nodeId: 'grp1',
        options: [
          { k: 'a', label: '①我是她室友陈默' },
          { k: 'b', label: '②其实我一直阴魂不散哦' }
        ]
      };
      save();
      refreshChat(cid);
    }

    async function runScene8MsgsPatch() {
      var cid = 'by';
      await themSayP(cid, '沈敏', '看到了，这也太苛刻了吧？！', 1400);
      await themSayP(cid, '临爽', '才特么6点就不让出楼…是人吗…', 1600);
      await themSayP(cid, '许双荞', '现在貌似已经六点了', 1600);
      await themSayP(cid, '周学姐', '@所有人 现在开始所有人不要出楼！', 1600);
      await themSayP(cid, '邓许', '我倒是有个疑问啊……', 1600);
      await themSayP(cid, '邓许', '寒潮是寒潮，出个宿舍楼和“人身安全”有什么关系？', 1600);
      await themSayP(cid, '邓许', '又和固定的时间有什么关系？', 1600);
      await themSayP(cid, '沈敏', '说的对啊……顶多被冻着，可这应该算健康问题，怎么能算人身安全', 1600);
      state.choice = {
        chatId: cid, nodeId: 'grp3',
        options: [
          { k: 'a', label: '①也许是现在很冷呢？' },
          { k: 'b', label: '②这很不对劲' }
        ]
      };
      save();
      refreshChat(cid);
    }

    /* ============================================================
       8. PAGES.memoDetail —— 打字完成后触发消息引导
       ============================================================ */
    var origMemoDetail = PAGES.memoDetail;
    PAGES.memoDetail = function (params) {
      var def = origMemoDetail(params);
      if (params.id !== 'memo_open') return def;
      var origMount = def.mount;
      def.mount = function (root) {
        if (origMount) origMount(root);
        var check = setInterval(function () {
          if (flag('memoRead')) {
            clearInterval(check);
            if (!flag('memoGuideShown')) {
              flag('memoGuideShown', true);
              flag('needMsgGuide', true);
              var backBtn = root.querySelector('[data-action="back"]');
              if (backBtn) CursorGuide.show('[data-action="back"]', '返回桌面，去看看消息');
              else Toast.show('返回桌面，去看看消息吧', 3200);
            }
          }
        }, 400);
        setTimeout(function () { clearInterval(check); }, 40000);
      };
      return def;
    };

    /* ============================================================
       9. PAGES.forumPost —— 楼层点赞/回复 + 滚动触发通知
       ============================================================ */
    PAGES.forumPost = function (params) {
      ensureStateFields();
      var p = state.db.forum.posts.find(function (x) { return x.id === params.id; });
      if (!p) return simplePage('帖子', '<div class="empty">帖子已被删除</div>');

      var floors = p.floors.map(function (f) {
        var key = p.id + '_' + f.n;
        var likeKey = 'floor_' + key;
        var mine = state.forumLikes[likeKey] || 0;
        var total = baseLikes(likeKey) + mine;
        var replies = state.forumReplies[key] || [];
        var replyHtml = replies.map(function (r) {
          return '<div class="floor-reply">我（' + esc(profileName()) + '）：' + esc(r.text) + '</div>';
        }).join('');
        return '<div class="floor">' +
          '<div class="floor-head">' +
            '<span class="floor-user">' + esc(f.user) + '</span>' +
            '<span class="floor-num">' + f.n + '楼</span>' +
          '</div>' +
          '<div class="floor-body">' +
            (f.quote ? '<span class="quote">回复 @' + esc(f.quote) + '：</span>' : '') +
            esc(f.text) +
          '</div>' +
          '<div class="floor-actions">' +
            '<button class="floor-btn ' + (mine ? 'liked' : '') + '" data-action="forum-like" data-key="' + esc(likeKey) + '">' +
              '<span class="like-cnt">' + (mine ? '已赞' : '赞') + '</span> ' + total +
            '</button>' +
            (p.locked ? '' : '<button class="floor-btn" data-action="forum-reply" data-key="' + esc(key) + '">回复</button>') +
          '</div>' +
          replyHtml +
        '</div>';
      }).join('');

      return {
        html: '<div class="page">' +
          navBar('帖子详情') +
          '<div class="page-body" id="post-body">' +
            '<div class="notice-doc" style="padding:var(--sp-4);">' +
              '<div class="post-head" style="margin-bottom:var(--sp-2);">' +
                (p.hot ? '<span class="tag hot">热度飙升</span>' : '') +
                (p.pinned ? '<span class="tag">置顶</span>' : '') +
                '<span class="post-author">楼主：' + esc(p.author) + '</span>' +
              '</div>' +
              '<div style="font-size:16px;font-weight:700;line-height:1.5;overflow-wrap:anywhere;">' + esc(p.title) + '</div>' +
              '<div class="post-meta" style="margin-top:var(--sp-2);"><span>' + esc(p.time) + '</span></div>' +
            '</div>' +
            '<div class="card" style="padding:0;">' + floors + '</div>' +
            (p.locked ? '<div class="locked-tip">本帖已被管理员“' + esc(p.lockedBy || 'zhou') + '”设置为“禁止回复”</div>' : '') +
          '</div>' +
        '</div>',
        mount: function (root) {
          if (p.id !== 'p1' || flag('readPost1')) return;
          var triggered = false;
          var trigger = function () {
            if (triggered || flag('readPost1')) return;
            triggered = true;
            flag('readPost1', true);
            if (!state.db.chats.by.messages.some(function (m) { return m.text === '我靠别搞啊，有点吓人了'; })) {
              state.db.chats.by.messages.push({
                id: uid('m'), from: '临爽',
                text: '我靠别搞啊，有点吓人了',
                time: '2025-05-08 18:16'
              });
            }
            save();
            NotifService.push({
              id: 'n_forum_msg',
              title: '北苑留校女生群有新消息',
              detail: '临爽：我靠别搞啊，有点吓人了',
              target: { page: 'chat', params: { id: 'by' } }
            });
          };
          var body = root.querySelector('#post-body');
          if (body) {
            body.addEventListener('scroll', function () {
              if (body.scrollTop + body.clientHeight >= body.scrollHeight - 60) {
                setTimeout(trigger, 1500);
              }
            }, { passive: true });
          }
          setTimeout(trigger, 12000);
        }
      };
    };

    /* ============================================================
       10. PAGES.forum —— 更多帖子 + 帖子级点赞
       ============================================================ */
    PAGES.forum = function () {
      ensureStateFields();
      var board = forumBoard;
      var boards = state.db.forum.boards;
      var curBoard = boards.find(function (b) { return b.id === board; }) || boards[0];
      var posts = state.db.forum.posts.filter(function (p) { return p.board === board; });
      posts.sort(function (a, b) {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return (b.time || '').localeCompare(a.time || '');
      });
      var tabs = boards.map(function (b) {
        return '<button class="ftab ' + (b.id === board ? 'on' : '') + '" data-action="forum-board" data-id="' + esc(b.id) + '">' + esc(b.name) + (b.hot ? ' 🔥' : '') + '</button>';
      }).join('');
      var postHtml = posts.map(function (p) {
        var likeKey = 'post_' + p.id;
        var mine = state.forumLikes[likeKey] || 0;
        var total = baseLikes(likeKey) + mine;
        return '<div class="post-item">' +
          '<div class="post-head" data-action="open-post" data-id="' + esc(p.id) + '">' +
            (p.pinned ? '<span class="tag">置顶</span>' : '') +
            (p.hot ? '<span class="tag hot">热度飙升</span>' : '') +
            (p.locked ? '<span class="tag gray">禁止回复</span>' : '') +
            '<span class="post-author">' + esc(p.author) + '</span>' +
          '</div>' +
          '<div class="post-title" data-action="open-post" data-id="' + esc(p.id) + '">' + esc(p.title) + '</div>' +
          '<div class="post-meta">' +
            '<span>' + esc(p.time) + '</span>' +
            '<span>' + p.floors.length + ' 楼</span>' +
            '<button class="post-like-btn ' + (mine ? 'liked' : '') + '" data-action="forum-like" data-key="' + esc(likeKey) + '">' +
              '<span class="like-cnt">' + (mine ? '已赞' : '赞') + '</span> ' + total +
            '</button>' +
          '</div>' +
        '</div>';
      }).join('');
      return {
        html: '<div class="page">' +
          navBar('校园论坛', { right: '<button class="nav-btn" data-action="forum-post-tip">发帖</button>' }) +
          '<div class="forum-tabs">' + tabs + '</div>' +
          '<div class="page-body">' +
            (curBoard.hot ? '<div style="padding:0 var(--sp-4) var(--sp-2);"><span class="tag hot">热度飙升</span></div>' : '') +
            (postHtml || '<div class="empty">本版块暂无帖子</div>') +
            '<div class="empty txt-xs">校园论坛 · 请文明发言</div>' +
          '</div>' +
        '</div>'
      };
    };

    /* ============================================================
       11. PAGES.notice —— 滚动触发 + 预推张夏夏消息
       ============================================================ */
    PAGES.notice = function () {
      var n = state.db.notice;
      var secs = n.sections.map(function (s) {
        return '<div class="notice-sec ' + (s.red ? 'red' : '') + '">' +
          '<b>' + esc(s.no) + '</b>　' + esc(s.text) +
        '</div>';
      }).join('');
      return {
        html: '<div class="page">' +
          navBar('系统公告') +
          '<div class="page-body" id="notice-body">' +
            '<div class="notice-doc">' +
              '<h2>' + esc(n.title) + '</h2>' +
              '<div class="notice-meta">' +
                esc(n.meta.pub) + '<br>' +
                '发布单位：' + esc(n.meta.unit) + '<br>' +
                '文号：' + esc(n.meta.doc) + '<br>' +
                '发布日期：' + esc(n.meta.date) +
              '</div>' +
              secs +
              '<div class="notice-sign">' + esc(n.sign).replace(/\n/g, '<br>') + '</div>' +
            '</div>' +
            '<div class="px4 txt-xs txt-3 center" style="padding-bottom:var(--sp-6);">本公告由小渠自动发布 · 请勿转发</div>' +
          '</div>' +
        '</div>',
        mount: function (root) {
          if (flag('readNotice')) return;
          var triggered = false;
          var trigger = function () {
            if (triggered || flag('readNotice')) return;
            triggered = true;
            flag('readNotice', true);
            flag('s8Notified', true);
            flag('pending_s8', true);
            if (!state.db.chats.by.messages.some(function (m) { return m.text === '你们看新的通知了没？'; })) {
              state.db.chats.by.messages.push({
                id: uid('m'), from: '张夏夏',
                text: '你们看新的通知了没？',
                time: '2025-05-08 18:30'
              });
            }
            save();
            NotifService.push({
              id: 'n_s8',
              title: '北苑留校女生群有新消息',
              detail: '张夏夏：你们看新的通知了没？',
              target: { page: 'chat', params: { id: 'by' } }
            });
          };
          var body = root.querySelector('#notice-body');
          if (body) {
            body.addEventListener('scroll', function () {
              if (body.scrollTop + body.clientHeight >= body.scrollHeight - 60) {
                setTimeout(trigger, 1200);
              }
            }, { passive: true });
          }
          setTimeout(trigger, 10000);
        }
      };
    };

    /* ============================================================
       12. PAGES.messages / contacts / friendRequests
       ============================================================ */
    PAGES.messages = function () {
      ensureStateFields();
      if (flag('grp3done') && !state.db.friendRequests.some(function (f) { return f.from === '临爽'; })) {
        state.db.friendRequests.push({
          id: 'fr_ls', from: '临爽', avatar: '😆',
          text: '加一下加一下！', time: '2025-05-08 18:20', status: 'pending'
        });
        save();
      }
      var chats = Object.values(state.db.chats)
        .filter(function (c) { return c.type !== 'self' || c.id === 'wxg'; })
        .filter(function (c) { return c.joined !== false; });
      chats.sort(function (a, b) { return lastMsgTime(b).localeCompare(lastMsgTime(a)); });

      var pendingFR = (state.db.friendRequests || []).filter(function (f) { return f.status === 'pending'; });

      var rows = chats.map(function (c) {
        var last = c.messages[c.messages.length - 1];
        var preview = last ? (last.type === 'card' ? '[卡片] ' + last.desc : (last.text || '')) : '';
        var unread = state.unread[c.id] || 0;
        return '<div class="row" data-action="open-chat" data-id="' + esc(c.id) + '">' +
          '<div class="avatar ' + (c.type === 'group' ? '' : 'round') + '" style="' + avatarStyle(c.name) + '">' + esc(c.avatar) + '</div>' +
          '<div class="r-main">' +
            '<div class="r-title">' + esc(c.name) + '</div>' +
            '<div class="r-sub">' + esc(preview) + '</div>' +
          '</div>' +
          '<div class="r-right">' +
            (unread ? '<span class="badge">' + (unread > 99 ? '99+' : unread) + '</span>' : '<span class="txt-3 txt-xs">' + esc(shortTime(last ? last.time : '')) + '</span>') +
          '</div>' +
        '</div>';
      }).join('');

      var frRow = pendingFR.length ? '<div class="row" data-action="open-friend-requests">' +
        '<div class="avatar round" style="background:var(--c-card-2);">➕</div>' +
        '<div class="r-main"><div class="r-title">新的朋友</div><div class="r-sub">' + pendingFR.length + ' 条待处理</div></div>' +
        '<div class="r-right"><span class="badge">' + pendingFR.length + '</span></div>' +
      '</div>' : '';

      return {
        html: '<div class="page">' +
          navBar('消息', {
            back: true,
            right: '<button class="nav-btn" data-action="open-contacts" aria-label="通讯录">通讯录</button>'
          }) +
          '<div class="page-body">' +
            '<div class="card" style="margin-top:var(--sp-3)">' + frRow + rows + '</div>' +
            '<div class="empty txt-xs">寒潮期间，校外通讯已被限制</div>' +
          '</div>' +
        '</div>'
      };
    };

    PAGES.contacts = function () {
      ensureStateFields();
      var contacts = state.db.contacts.filter(function (c) { return !c.hidden; });
      var listHtml = contacts.map(function (c) {
        return '<div class="row" data-action="open-contact" data-id="' + esc(c.id) + '">' +
          '<div class="avatar round" style="' + avatarStyle(c.name) + '">' + esc(c.avatar) + '</div>' +
          '<div class="r-main"><div class="r-title">' + esc(c.name) + '</div><div class="r-sub">' + esc(c.note || '') + '</div></div>' +
          '<span class="chev-r">›</span>' +
        '</div>';
      }).join('');
      return {
        html: '<div class="page">' +
          navBar('通讯录', { right: '<button class="nav-btn" data-action="open-friend-requests">新的朋友</button>' }) +
          '<div class="page-body"><div class="card" style="margin-top:var(--sp-3)">' + listHtml + '</div></div>' +
        '</div>'
      };
    };

    PAGES.friendRequests = function () {
      ensureStateFields();
      if (flag('grp3done') && !state.db.friendRequests.some(function (f) { return f.from === '临爽'; })) {
        state.db.friendRequests.push({
          id: 'fr_ls', from: '临爽', avatar: '😆',
          text: '加一下加一下！', time: '2025-05-08 18:20', status: 'pending'
        });
        save();
      }
      var list = state.db.friendRequests || [];
      var items = list.map(function (f) {
        return '<div class="card" style="padding:var(--sp-4);">' +
          '<div class="flex ac gap3" style="min-width:0;">' +
            '<div class="avatar round" style="' + avatarStyle(f.from) + '">' + esc(f.avatar) + '</div>' +
            '<div class="r-main" style="min-width:0;">' +
              '<div class="bold">' + esc(f.from) + '</div>' +
              '<div class="txt-s txt-2 wrap">' + esc(f.text) + '</div>' +
              '<div class="txt-xs txt-3" style="margin-top:2px;">' + esc(f.time) + '</div>' +
            '</div>' +
            '<div class="flex gap2" style="flex:0 0 auto;">' +
              (f.status === 'pending'
                ? '<button class="btn sm" data-action="fr-accept" data-id="' + esc(f.id) + '">通过</button>' +
                  '<button class="btn ghost sm" data-action="fr-ignore" data-id="' + esc(f.id) + '">忽略</button>'
                : '<span class="tag gray">' + (f.status === 'accepted' ? '已通过' : '已忽略') + '</span>') +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');
      return {
        html: '<div class="page">' +
          navBar('新的朋友') +
          '<div class="page-body" style="padding-top:var(--sp-3);">' + (items || '<div class="empty">暂无好友申请</div>') + '</div>' +
        '</div>'
      };
    };

    /* ============================================================
       13. PAGES.settings —— 加入个人资料入口（头像用自定义底色）
       ============================================================ */
    PAGES.settings = function () {
      ensureStateFields();
      return {
        html: '<div class="page">' +
          navBar('设置') +
          '<div class="page-body">' +
            '<div class="card" style="margin-top:var(--sp-3);">' +
              '<div class="row" data-action="open-profile">' +
                '<div class="avatar" style="' + myAvatarStyle() + 'width:44px;height:44px;font-size:22px;">' + esc(profileAvatar()) + '</div>' +
                '<div class="r-main"><div class="r-title">' + esc(profileName()) + '</div><div class="r-sub">个人资料</div></div>' +
                '<span class="chev-r">›</span>' +
              '</div>' +
              '<div class="row" data-action="set-time">' +
                '<div class="r-main"><div class="r-title">日期与时间</div><div class="r-sub">' + esc(sysTimeStr()) + '</div></div>' +
                '<span class="chev-r">›</span>' +
              '</div>' +
              '<div class="row" data-action="toggle-theme">' +
                '<div class="r-main"><div class="r-title">深色模式</div></div>' +
                '<span class="r-right">' + (state.theme === 'dark' ? '已开启' : '已关闭') + '</span>' +
              '</div>' +
              '<div class="row" data-action="toggle-vibrate">' +
                '<div class="r-main"><div class="r-title">触感反馈</div></div>' +
                '<span class="r-right">' + (state.settings.vibrate ? '开' : '关') + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="card">' +
              '<div class="row" data-action="open-dev-gate">' +
                '<div class="r-main"><div class="r-title">关于本机</div><div class="r-sub">QuOS 3.2.1 · 点击查看</div></div>' +
                '<span class="chev-r">›</span>' +
              '</div>' +
            '</div>' +
            '<div class="card">' +
              '<div class="row" data-action="factory-reset">' +
                '<div class="r-main"><div class="r-title txt-danger">恢复出厂设置</div><div class="r-sub">高风险操作，将清除本机全部数据</div></div>' +
                '<span class="chev-r">›</span>' +
              '</div>' +
            '</div>' +
            '<div class="px4 txt-xs txt-3 center mt4">本设备属于：' + esc(DATA.device.owner) + '</div>' +
            '<div style="height:var(--sp-6)"></div>' +
          '</div>' +
        '</div>'
      };
    };

    /* ============================================================
       14. PAGES.profile —— 加颜色选择器
       ============================================================ */
    var AVATAR_OPTIONS = ['🫥', '😎', '🐱', '🐼', '🌙', '🍀', '🎧', '🌊', '🔥', '🦊', '🐰', '🦉', '🍎', '🌵', '⭐', '🎈'];
    var COLOR_OPTIONS = [
      { name: '默认', value: 'default' },
      { name: '蓝', value: '#5B8FF9' },
      { name: '橙', value: '#F6903D' },
      { name: '黄', value: '#F6BD16' },
      { name: '紫', value: '#7262FD' },
      { name: '青', value: '#78D3F8' },
      { name: '深紫', value: '#9661BC' },
      { name: '粉', value: '#F08BB4' },
      { name: '绿', value: '#3FB37F' },
      { name: '红', value: '#E8684A' },
      { name: '淡紫', value: '#9270CA' },
      { name: '薄荷', value: '#5AD8A6' },
      { name: '杏', value: '#E8A585' }
    ];

    PAGES.profile = function () {
      ensureStateFields();
      var name = profileName();
      var avatar = profileAvatar();
      var curColor = state.profile.color || 'default';

      // 预览用的头像底色：优先自定义色
      var previewStyle = curColor && curColor !== 'default'
        ? 'background:' + curColor + ';'
        : avatarStyle(avatar);

      var avGrid = AVATAR_OPTIONS.map(function (e) {
        return '<button class="profile-avatar-opt ' + (avatar === e ? 'on' : '') +
          '" data-action="pick-avatar" data-emoji="' + e +
          '" style="' + (curColor && curColor !== 'default' ? 'background:' + curColor + ';' : avatarStyle(e)) +
          '">' + e + '</button>';
      }).join('');

      var colorGrid = COLOR_OPTIONS.map(function (c) {
        var isDefault = c.value === 'default';
        var bg = isDefault ? 'background:linear-gradient(135deg,#d0d3da,#8b909b);' : 'background:' + c.value + ';';
        return '<button class="profile-color-opt ' + (curColor === c.value ? 'on' : '') +
          '" data-action="pick-color" data-color="' + c.value +
          '" style="' + bg + '" aria-label="' + esc(c.name) + '">' + (isDefault ? '默认' : '') + '</button>';
      }).join('');

      return {
        html: '<div class="page">' +
          navBar('个人资料') +
          '<div class="page-body" style="padding:var(--sp-3);">' +
            '<div class="card" style="padding:var(--sp-4);">' +
              '<div class="flex ac gap3" style="min-width:0;">' +
                '<div class="avatar" style="' + previewStyle + 'width:64px;height:64px;font-size:32px;">' + esc(avatar) + '</div>' +
                '<div class="r-main" style="min-width:0;">' +
                  '<div class="bold" style="font-size:var(--fs-l);">' + esc(name) + '</div>' +
                  '<div class="txt-s txt-2">当前昵称 / 头像 / 底色</div>' +
                '</div>' +
              '</div>' +
              '<div class="dev-label">昵称</div>' +
              '<input class="dev-input" id="profile-name" value="' + esc(name) + '" maxlength="16">' +
              '<div class="dev-label">头像</div>' +
              '<div class="profile-avatar-grid">' + avGrid + '</div>' +
              '<div class="dev-label">头像底色</div>' +
              '<div class="profile-color-grid">' + colorGrid + '</div>' +
              '<button class="btn block mt4" data-action="save-profile">保存</button>' +
            '</div>' +
            '<div class="px4 txt-xs txt-3 center">头像、昵称与底色仅在本机生效</div>' +
          '</div>' +
        '</div>'
      };
    };

    /* ============================================================
       15. 新增 action 的捕获阶段拦截
       ============================================================ */
    function handlePatchAction(action, el) {
      if (action === 'open-profile') { Router.push('profile'); return; }
      if (action === 'save-profile') {
        ensureStateFields();
        var inp = document.getElementById('profile-name');
        if (inp) {
          state.profile.name = (inp.value || '陈默').slice(0, 16).trim() || '陈默';
          save();
          Toast.show('个人资料已保存');
          render();
        }
        return;
      }
      if (action === 'pick-avatar') {
        ensureStateFields();
        var inp2 = document.getElementById('profile-name');
        if (inp2) {
          state.profile.name = (inp2.value || '陈默').slice(0, 16).trim() || '陈默';
        }
        state.profile.avatar = el.dataset.emoji;
        save();
        render();
        return;
      }
      if (action === 'pick-color') {
        ensureStateFields();
        var inp3 = document.getElementById('profile-name');
        if (inp3) {
          state.profile.name = (inp3.value || '陈默').slice(0, 16).trim() || '陈默';
        }
        state.profile.color = el.dataset.color || 'default';
        save();
        render();
        return;
      }
      if (action === 'forum-like') {
        ensureStateFields();
        var key = el.dataset.key;
        state.forumLikes[key] = state.forumLikes[key] ? 0 : 1;
        save();
        render();
        return;
      }
      if (action === 'forum-reply') {
        openReplySheet(el.dataset.key);
        return;
      }
    }

    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-action]');
      if (!el) return;
      var a = el.dataset.action;
      if (a === 'open-profile' || a === 'save-profile' || a === 'pick-avatar' ||
          a === 'pick-color' || a === 'forum-like' || a === 'forum-reply') {
        e.stopPropagation();
        handlePatchAction(a, el);
      }
    }, true);

    function openReplySheet(key) {
      var layers = document.getElementById('layers');
      if (!layers) return;
      var opts = ['同问', '理性讨论', '别乱说了', '蹲一个后续'];
      var scrim = document.createElement('div');
      scrim.className = 'sheet-scrim';
      scrim.innerHTML = '<div class="sheet">' +
        '<div class="sheet-title">选择回复内容</div>' +
        opts.map(function (o, i) {
          return '<button class="choice-btn" data-reply="' + esc(o) + '" style="margin-bottom:8px;">' + (i + 1) + '. ' + esc(o) + '</button>';
        }).join('') +
        '<button class="btn ghost block sm" data-reply-cancel="1" style="margin-top:8px;">取消</button>' +
      '</div>';
      layers.appendChild(scrim);
      scrim.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-reply]');
        if (btn) {
          ensureStateFields();
          var text = btn.dataset.reply;
          if (!state.forumReplies[key]) state.forumReplies[key] = [];
          state.forumReplies[key].push({ text: text, time: fmtFull(sysNow()) });
          save();
          scrim.remove();
          render();
          Toast.show('已回复');
          return;
        }
        if (e.target.closest('[data-reply-cancel]') || e.target === scrim) scrim.remove();
      });
    }

    /* ============================================================
       16. Router.push 钩子
       ============================================================ */
    var origPush = Router.push.bind(Router);
    Router.push = function (page, params) {
      ensureStateFields();
      if (page === 'forum' || page === 'forumPost') {
        flag('forumVisited', true);
        CursorGuide.hide();
      }
      if (page === 'messages' || page === 'chat' || page === 'contacts' || page === 'contact') {
        flag('msgGuideDone', true);
      }
      origPush(page, params);
    };

    /* ============================================================
       17. 群邀请触发器
       ============================================================ */
    var msgAreaTime = 0;
    var lastTick = Date.now();
    var inviteTriggered = false;

    setInterval(function () {
      ensureStateFields();
      var now = Date.now();
      var dt = now - lastTick;
      lastTick = now;
      if (inviteTriggered || flag('invited') || !flag('memoRead')) { msgAreaTime = 0; return; }
      var cur = Router.current();
      var inMsgArea =
        cur.page === 'messages' || cur.page === 'chat' ||
        cur.page === 'contacts' || cur.page === 'contact' ||
        cur.page === 'friendRequests';
      if (inMsgArea) msgAreaTime += dt;
      else msgAreaTime = Math.max(0, msgAreaTime - dt * 0.6);
      if (msgAreaTime > 8000) {
        inviteTriggered = true;
        flag('invited', true);
        NotifService.push({
          id: 'n_invite',
          title: '您已被邀请进入“北苑留校女生群”',
          detail: '点击加入群聊',
          target: { page: 'chat', params: { id: 'by' } }
        });
      }
    }, 500);

    /* ============================================================
       18. 补触发
       ============================================================ */
    setTimeout(function () {
      ensureStateFields();
      var cur = Router.current();
      if (cur.page === 'chat' && cur.params.id === 'by') onOpenChatPatch('by');
    }, 800);

    console.log('[story-patch v1.7] 已加载：锁屏兼容 / 头像底色可选 / 消息延迟 ×1.3');
  });
})();
