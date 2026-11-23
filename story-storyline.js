/* ================================================================
   story-storyline.js  v2.1
   修复 v2.0 的致命 bug：ready 里错误地检查了 window.StorySnapshots，
   而它在文件加载时还不存在 → 整个文件不执行 → 设置入口消失。

   v2.1 变更：
   · ready 里移除 window.StorySnapshots 检查
   · 其余 v2.0 全部内容原样保留
     （代际检查、消息函数接管、快照按 label 去重、
      回档完整清理、时间戳恢复、延迟二次恢复、定时去重）
   ================================================================ */
(function () {
  'use strict';

  function ready(fn) {
    if (typeof PAGES !== 'undefined' &&
        typeof Router !== 'undefined' &&
        typeof CursorGuide !== 'undefined' &&
        typeof Toast !== 'undefined' &&
        typeof ConfirmBox !== 'undefined' &&
        typeof state !== 'undefined' &&
        typeof save === 'function' &&
        typeof flag === 'function' &&
        typeof render === 'function' &&
        typeof navBar === 'function' &&
        typeof esc === 'function' &&
        typeof sleep === 'function' &&
        typeof uid === 'function' &&
        typeof storyTime === 'function' &&
        typeof fmtYMD === 'function' &&
        typeof fmtHM === 'function' &&
        typeof CHOICES !== 'undefined') {
      fn();
    } else {
      setTimeout(function () { ready(fn); }, 80);
    }
  }

  ready(function () {

    var STORAGE_KEY = 'xiaoqu_story_snapshots';
    var MAX_SNAPSHOTS = 30;

    /* 初始化代际标记 */
    if (typeof window.__storylineGeneration !== 'number') {
      window.__storylineGeneration = Date.now();
    }
    if (typeof window.__storylineFrozen !== 'boolean') {
      window.__storylineFrozen = false;
    }

    /* ============================================================
       一、包装消息函数加"代际检查"
       ============================================================ */
    function wrapMessageFunctions() {
      window.themSay = async function (cid, name, text, delay) {
        var gen = window.__storylineGeneration;
        if (window.__storylineFrozen) return;
        var adjusted = (window.StorySpeed && window.StorySpeed.adjust)
          ? window.StorySpeed.adjust(delay == null ? 900 : delay)
          : (delay == null ? 900 : delay);
        await sleep(adjusted);
        if (window.__storylineGeneration !== gen) return;
        if (window.__storylineFrozen) return;
        var chat = state.db && state.db.chats && state.db.chats[cid];
        if (!chat) return;
        if (!Array.isArray(chat.messages)) chat.messages = [];
        var exists = chat.messages.some(function (m) {
          return m.from === name && m.text === text;
        });
        if (exists) return;
        chat.messages.push({ id: uid('m'), from: name, text: text, time: storyTime() });
        save();
        try { refreshChat(cid); } catch (e) {}
      };

      window.meSay = async function (cid, text, delay) {
        var gen = window.__storylineGeneration;
        if (window.__storylineFrozen) return;
        var adjusted = (window.StorySpeed && window.StorySpeed.adjust)
          ? window.StorySpeed.adjust(delay == null ? 700 : delay)
          : (delay == null ? 700 : delay);
        await sleep(adjusted);
        if (window.__storylineGeneration !== gen) return;
        if (window.__storylineFrozen) return;
        var chat = state.db && state.db.chats && state.db.chats[cid];
        if (!chat) return;
        if (!Array.isArray(chat.messages)) chat.messages = [];
        var exists = chat.messages.some(function (m) {
          return m.from === 'me' && m.text === text;
        });
        if (exists) return;
        chat.messages.push({ id: uid('m'), from: 'me', text: text, time: storyTime() });
        save();
        try { refreshChat(cid); } catch (e) {}
      };

      window.sysNote = async function (cid, text, delay) {
        var gen = window.__storylineGeneration;
        if (window.__storylineFrozen) return;
        var adjusted = (window.StorySpeed && window.StorySpeed.adjust)
          ? window.StorySpeed.adjust(delay == null ? 600 : delay)
          : (delay == null ? 600 : delay);
        await sleep(adjusted);
        if (window.__storylineGeneration !== gen) return;
        if (window.__storylineFrozen) return;
        var chat = state.db && state.db.chats && state.db.chats[cid];
        if (!chat) return;
        if (!Array.isArray(chat.messages)) chat.messages = [];
        var exists = chat.messages.some(function (m) {
          return m.type === 'system' && m.text === text;
        });
        if (exists) return;
        chat.messages.push({ id: uid('m'), type: 'system', text: text, time: storyTime() });
        save();
        try { refreshChat(cid); } catch (e) {}
      };

      if (window.StorySpeed && typeof window.StorySpeed.ensureMsgP === 'function') {
        window.StorySpeed.ensureMsgP = async function (cid, msg, baseDelay) {
          var gen = window.__storylineGeneration;
          if (window.__storylineFrozen) return;
          var chat = state.db && state.db.chats && state.db.chats[cid];
          if (!chat) return;
          if (!Array.isArray(chat.messages)) chat.messages = [];
          var exists = chat.messages.some(function (m) {
            if (msg.type === 'system') return m.type === 'system' && m.text === msg.text;
            if (msg.type === 'card') return m.type === 'card' && m.title === msg.title && m.desc === msg.desc;
            return m.from === msg.from && m.text === msg.text;
          });
          if (exists) return;
          if (baseDelay && baseDelay > 0) {
            var adjusted = (window.StorySpeed.adjust) ? window.StorySpeed.adjust(baseDelay) : baseDelay;
            await sleep(adjusted);
          }
          if (window.__storylineGeneration !== gen) return;
          if (window.__storylineFrozen) return;
          chat.messages.push(Object.assign({ id: uid('m'), time: storyTime() }, msg));
          save();
          try { refreshChat(cid); } catch (e) {}
        };
      }
    }
    wrapMessageFunctions();

    /* ============================================================
       二、Snapshot 存储
       ============================================================ */
    var Snapshots = {
      list: function () {
        try {
          var raw = localStorage.getItem(STORAGE_KEY);
          return raw ? JSON.parse(raw) : [];
        } catch (e) {
          return [];
        }
      },

      saveList: function (list) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
          return true;
        } catch (e) {
          while (list.length > 1) {
            list.shift();
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
              return true;
            } catch (e2) {}
          }
          return false;
        }
      },

      snapshotState: function () {
        function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
        return {
          flags: clone(state.flags || {}),
          trust: clone(state.trust || {}),
          choice: clone(state.choice),
          questionnaireAnswers: clone(state.questionnaireAnswers || {}),
          forumLikes: clone(state.forumLikes || {}),
          forumReplies: clone(state.forumReplies || {}),
          profile: clone(state.profile || {}),
          notifications: clone(state.notifications || []),
          readNotifs: clone(state.readNotifs || {}),
          unread: clone(state.unread || {}),
          markedRules: clone(state.markedRules || {}),
          clockBase: state.clockBase,
          clockStartReal: state.clockStartReal,
          db: {
            chats: clone(state.db.chats || {}),
            friendRequests: clone(state.db.friendRequests || []),
            memos: clone(state.db.memos || []),
            forumPosts: clone((state.db.forum && state.db.forum.posts) || []),
            forumBoards: clone((state.db.forum && state.db.forum.boards) || []),
            contacts: clone(state.db.contacts || [])
          }
        };
      },

      capture: function (label, opts) {
        opts = opts || {};
        var list = this.list();
        /* 按 label 去重：已有相同 label 直接返回旧的，不新增不覆盖 */
        for (var i = 0; i < list.length; i++) {
          if (list[i].label === label) return list[i];
        }
        var id = opts.id || ('cp_' + Date.now().toString(36));
        var page = opts.page || 'home';
        var snap = {
          id: id,
          label: label,
          page: page,
          time: Date.now(),
          snapshot: this.snapshotState()
        };
        var existing = -1;
        for (var j = 0; j < list.length; j++) {
          if (list[j].id === id) { existing = j; break; }
        }
        if (existing >= 0) list[existing] = snap;
        else list.push(snap);

        while (list.length > MAX_SNAPSHOTS) list.shift();
        this.saveList(list);
        return snap;
      },

      restore: function (id) {
        var list = this.list();
        var cp = null;
        for (var i = 0; i < list.length; i++) {
          if (list[i].id === id) { cp = list[i]; break; }
        }
        if (!cp || !cp.snapshot) return null;
        var snap = cp.snapshot;

        function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }

        /* 1) 更新代际：所有旧 sleep 醒来的消息推送全部作废 */
        window.__storylineGeneration = Date.now() + Math.random();

        /* 2) 清所有 lock */
        try {
          if (window.StoryExtension && window.StoryExtension._playingLock) {
            Object.keys(window.StoryExtension._playingLock).forEach(function (k) {
              window.StoryExtension._playingLock[k] = false;
            });
          }
          if (window.StoryExtension2 && window.StoryExtension2._playingLock) {
            Object.keys(window.StoryExtension2._playingLock).forEach(function (k) {
              window.StoryExtension2._playingLock[k] = false;
            });
          }
        } catch (e) {}

        /* 3) 清全局定时器引用 */
        try { if (window.__huzhu_stage9_timer) { clearTimeout(window.__huzhu_stage9_timer); window.__huzhu_stage9_timer = null; } } catch (e) {}
        try { if (window.__nightCountdownTimer) { clearInterval(window.__nightCountdownTimer); window.__nightCountdownTimer = null; } } catch (e) {}
        try { window.__qx_submitting = false; } catch (e) {}

        /* 4) 清 DOM 残留 */
        try {
          var sels = '.screen-fade, #wxg-warning-overlay, #wxg-night-violation, .notif-banner, .toast, .modal-scrim, .sheet-scrim, .panel-scrim, .sleep-btn-top';
          var nodes = document.querySelectorAll(sels);
          Array.prototype.forEach.call(nodes, function (el) {
            try { el.remove(); } catch (e) {}
          });
        } catch (e) {}

        /* 5) 清光标 */
        try { if (window.CursorGuide && CursorGuide.hide) CursorGuide.hide(); } catch (e) {}

        /* 6) 完整恢复 state 字段 */
        if (snap.flags) state.flags = clone(snap.flags);
        if (snap.trust) state.trust = clone(snap.trust);
        state.choice = clone(snap.choice);
        if (snap.questionnaireAnswers) state.questionnaireAnswers = clone(snap.questionnaireAnswers);
        if (snap.forumLikes) state.forumLikes = clone(snap.forumLikes);
        if (snap.forumReplies) state.forumReplies = clone(snap.forumReplies);
        if (snap.profile) state.profile = clone(snap.profile);
        if (snap.notifications) state.notifications = clone(snap.notifications);
        if (snap.readNotifs) state.readNotifs = clone(snap.readNotifs);
        if (snap.unread) state.unread = clone(snap.unread);
        if (snap.markedRules) state.markedRules = clone(snap.markedRules);

        if (!state.db) state.db = {};
        if (snap.db) {
          if (snap.db.chats) state.db.chats = clone(snap.db.chats);
          if (snap.db.friendRequests) state.db.friendRequests = clone(snap.db.friendRequests);
          if (snap.db.memos) state.db.memos = clone(snap.db.memos);
          if (snap.db.forumPosts) {
            if (!state.db.forum) state.db.forum = { boards: [], posts: [] };
            state.db.forum.posts = clone(snap.db.forumPosts);
          }
          if (snap.db.forumBoards) {
            if (!state.db.forum) state.db.forum = { boards: [], posts: [] };
            state.db.forum.boards = clone(snap.db.forumBoards);
          }
          if (snap.db.contacts) state.db.contacts = clone(snap.db.contacts);
        }

        /* 7) 时间恢复 */
        if (typeof snap.clockBase === 'number') {
          state.clockBase = snap.clockBase;
          state.clockStartReal = Date.now();
        }

        /* 8) 互助板块兜底 */
        if (state.db.forum && Array.isArray(state.db.forum.boards)) {
          if (!state.db.forum.boards.some(function (b) { return b.id === 'help'; })) {
            state.db.forum.boards.push({ id: 'help', name: '互助板块', hot: true });
          }
        }

        save();

        /* 9) 延迟二次、三次恢复（只覆盖关键字段，不 render） */
        function silentReapply() {
          try {
            if (snap.flags) state.flags = clone(snap.flags);
            if (snap.trust) state.trust = clone(snap.trust);
            if (snap.choice !== undefined) state.choice = clone(snap.choice);
            if (snap.questionnaireAnswers) state.questionnaireAnswers = clone(snap.questionnaireAnswers);
            if (snap.notifications) state.notifications = clone(snap.notifications);
            if (snap.readNotifs) state.readNotifs = clone(snap.readNotifs);
            if (snap.unread) state.unread = clone(snap.unread);
            if (snap.db && snap.db.chats) state.db.chats = clone(snap.db.chats);
            if (snap.db && snap.db.friendRequests) state.db.friendRequests = clone(snap.db.friendRequests);
            if (snap.db && snap.db.memos) state.db.memos = clone(snap.db.memos);
            save();
          } catch (e) {}
        }
        setTimeout(silentReapply, 600);
        setTimeout(silentReapply, 1200);

        return cp;
      },

      delete: function (id) {
        var list = this.list().filter(function (c) { return c.id !== id; });
        this.saveList(list);
      },

      clear: function () {
        this.saveList([]);
      }
    };

    window.StorySnapshots = Snapshots;

    /* ============================================================
       三、定时去重 localStorage 中的快照
       ============================================================ */
    setInterval(function () {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        var list = JSON.parse(raw);
        if (!Array.isArray(list)) return;
        var seen = {};
        var deduped = [];
        for (var i = 0; i < list.length; i++) {
          if (!list[i] || !list[i].label) continue;
          if (!seen[list[i].label]) {
            seen[list[i].label] = true;
            deduped.push(list[i]);
          }
        }
        if (deduped.length !== list.length) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped));
          var cur = Router.current();
          if (cur && cur.page === 'storyLine') render();
        }
      } catch (e) {}
    }, 1000);

    /* ============================================================
       四、自动包装 CHOICES 拍快照
       ============================================================ */
    var NODE_LABELS = {
      'grp1': '北苑群：自我介绍（陈默 / 阴魂不散）',
      'grp2': '北苑群：物资致谢（大义）',
      'grp3': '北苑群：对规则的看法（冷 / 不对劲）',
      'grp_s9': '北苑群：对寒潮预警的想法',
      'grp_s10': '北苑群：第16题的异常',
      'grp_s12': '北苑群：早上·沈敏出事',
      'ls_opening': '临爽私聊：寒潮 / 寝室邀请',
      'night_ls': '凌晨·临爽求助（限时）',
      'huzhu_1': '互助群：回应钱逸时',
      'huzhu_2': '互助群：荞麦面老师',
      'huzhu_3': '互助群：结伴 / 红包'
    };

    function wrapAllChoices() {
      if (typeof CHOICES === 'undefined') return;
      Object.keys(CHOICES).forEach(function (nodeId) {
        var variants = CHOICES[nodeId];
        if (!variants || typeof variants !== 'object') return;
        Object.keys(variants).forEach(function (key) {
          var orig = variants[key];
          if (typeof orig !== 'function' || orig.__snapWrapped) return;
          variants[key] = async function () {
            try {
              var page = 'home';
              if (state.choice && state.choice.chatId) {
                page = 'chat:' + state.choice.chatId;
              }
              var label = NODE_LABELS[nodeId] || ('节点：' + nodeId);
              Snapshots.capture(label, { id: 'node_' + nodeId, page: page });
            } catch (e) {
              console.error('[snap] capture failed', e);
            }
            return orig.apply(this, arguments);
          };
          variants[key].__snapWrapped = true;
        });
      });
    }
    wrapAllChoices();
    setTimeout(wrapAllChoices, 500);
    setTimeout(wrapAllChoices, 2000);
    setTimeout(wrapAllChoices, 4000);

    /* 问卷填写前快照 */
    if (PAGES.questionnaire) {
      var prevQuestionnaire = PAGES.questionnaire;
      PAGES.questionnaire = function (params) {
        var def = prevQuestionnaire(params);
        var origMount = def.mount;
        def.mount = function (root) {
          if (origMount) origMount(root);
          if (!flag('q16_overridden') && !flag('s9_questionnaire_done')) {
            try {
              Snapshots.capture('问卷填写前（尚未提交）', { id: 'q_form_open', page: 'questionnaire' });
            } catch (e) {}
          }
        };
        return def;
      };
    }

    /* 问卷重置后快照 */
    setInterval(function () {
      if (flag('q16_overridden') && !flag('q16_reset_snapped') && !flag('s9_questionnaire_done')) {
        try {
          Snapshots.capture('问卷重置后（第16题已变为"是/不是"）', { id: 'q16_reset', page: 'questionnaire' });
          flag('q16_reset_snapped', true);
          save();
        } catch (e) {}
      }
    }, 800);

    /* 周学姐好友通过前快照 */
    window.addEventListener('click', function (e) {
      var el = e.target && e.target.closest && e.target.closest('[data-action="fr-accept-zxj"]');
      if (!el) return;
      try {
        Snapshots.capture('通过周学姐好友申请前', { id: 'before_accept_zxj', page: 'friendRequests' });
      } catch (err) {}
    }, true);

    /* 加入互助群前快照 */
    window.addEventListener('click', function (e) {
      var el = e.target && e.target.closest && e.target.closest('[data-action="join-group"]');
      if (!el) return;
      if (el.dataset.group !== 'huzhu') return;
      try {
        Snapshots.capture('加入互助群前', { id: 'before_join_huzhu', page: 'forumPost:p_help' });
      } catch (err) {}
    }, true);

    /* 导航 */
    function navigateTo(cp) {
      if (!cp) {
        state.route = [{ page: 'home', params: {} }];
        save();
        render();
        return;
      }

      var chatId = null;
      if (state.choice && state.choice.chatId) {
        chatId = state.choice.chatId;
      } else if (cp.page && cp.page.indexOf('chat:') === 0) {
        chatId = cp.page.slice(5);
      }

      if (chatId) {
        state.route = [
          { page: 'home', params: {} },
          { page: 'chat', params: { id: chatId } }
        ];
        save();
        render();
        return;
      }

      if (cp.page === 'questionnaire') {
        state.route = [
          { page: 'home', params: {} },
          { page: 'questionnaire', params: {} }
        ];
        save();
        render();
        return;
      }

      if (cp.page === 'friendRequests') {
        state.route = [
          { page: 'home', params: {} },
          { page: 'friendRequests', params: {} }
        ];
        save();
        render();
        return;
      }

      if (cp.page && cp.page.indexOf('forumPost:') === 0) {
        var postId = cp.page.slice(10);
        state.route = [
          { page: 'home', params: {} },
          { page: 'forumPost', params: { id: postId } }
        ];
        save();
        render();
        return;
      }

      state.route = [{ page: 'home', params: {} }];
      save();
      render();
    }

    /* 剧情线管理页面 */
    PAGES.storyLine = function () {
      var list = Snapshots.list();
      var sorted = list.slice().sort(function (a, b) { return b.time - a.time; });

      var html = '<div class="page">' + navBar('剧情线管理') + '<div class="page-body">';

      if (!sorted.length) {
        html += '<div class="empty">还没有剧情快照。<br>游玩过程中会自动记录关键选择点。</div>';
      } else {
        html += '<div class="sec-title">可回退的节点（共 ' + sorted.length + ' 个）</div>';
        sorted.forEach(function (cp) {
          var d = new Date(cp.time);
          html += '<div class="memo-item" data-action="storyline-restore" data-id="' + esc(cp.id) + '">' +
            '<div class="memo-title">' + esc(cp.label) + '</div>' +
            '<div class="memo-meta"><span>' + fmtYMD(d) + ' ' + fmtHM(d) + '</span></div>' +
          '</div>';
        });
      }

      html += '<div class="px4" style="padding-top:var(--sp-4);padding-bottom:var(--sp-6);">' +
        '<button class="btn block danger" data-action="storyline-clear">清空所有快照</button>' +
        '<div class="txt-xs txt-3 center mt3">快照仅保存关键剧情状态，不会影响其它数据。</div>' +
      '</div>';

      html += '</div></div>';
      return { html: html };
    };

    /* 设置入口 */
    var prevSettings = PAGES.settings;
    PAGES.settings = function () {
      var def = prevSettings();
      var origMount = def.mount;
      def.mount = function (root) {
        if (origMount) origMount(root);
        var factoryRow = root.querySelector('[data-action="factory-reset"]');
        if (factoryRow && !root.querySelector('[data-action="open-storyline"]')) {
          factoryRow.insertAdjacentHTML('beforebegin',
            '<div class="row" data-action="open-storyline">' +
              '<div class="r-main"><div class="r-title">剧情线管理</div><div class="r-sub">回退到关键节点重新选择</div></div>' +
              '<span class="chev-r">›</span>' +
            '</div>'
          );
        }
      };
      return def;
    };

    /* 事件处理 */
    document.addEventListener('click', async function (e) {
      var el = e.target.closest('[data-action]');
      if (!el) return;
      var a = el.dataset.action;

      if (a === 'open-storyline') {
        e.stopPropagation();
        Router.push('storyLine');
        return;
      }

      if (a === 'storyline-restore') {
        e.stopPropagation();
        var id = el.dataset.id;
        var list = Snapshots.list();
        var cp = null;
        for (var i = 0; i < list.length; i++) {
          if (list[i].id === id) { cp = list[i]; break; }
        }
        if (!cp) { Toast.show('快照不存在'); return; }

        var ok = await ConfirmBox.open({
          title: '回退剧情',
          body: '将回退到：\n「' + cp.label + '」\n\n当前进度会被覆盖，确定继续吗？',
          okText: '确定回退',
          cancelText: '取消'
        });
        if (!ok) return;

        var restored = Snapshots.restore(id);
        if (restored) {
          Toast.show('已回退：' + restored.label);
          setTimeout(function () { navigateTo(restored); }, 350);
        } else {
          Toast.show('回退失败');
        }
        return;
      }

      if (a === 'storyline-clear') {
        e.stopPropagation();
        var ok2 = await ConfirmBox.open({
          title: '清空快照',
          body: '将删除所有剧情快照，不影响当前游戏进度。确定吗？',
          okText: '确定清空',
          cancelText: '取消',
          danger: true
        });
        if (!ok2) return;
        Snapshots.clear();
        Toast.show('已清空所有快照');
        render();
        return;
      }
    }, true);

    /* 确保互助板块 */
    var prevForum = PAGES.forum;
    PAGES.forum = function (params) {
      if (!state.db.forum) state.db.forum = { boards: [], posts: [] };
      if (!Array.isArray(state.db.forum.boards)) state.db.forum.boards = [];
      if (!state.db.forum.boards.some(function (b) { return b.id === 'help'; })) {
        state.db.forum.boards.push({ id: 'help', name: '互助板块', hot: true });
        save();
      }
      return prevForum(params);
    };

    console.log('[story-storyline v2.1] 已加载，代际=' + window.__storylineGeneration + '，快照 ' + Snapshots.list().length + ' 个');
  });
})();
