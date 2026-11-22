/* ================================================================
   story-storyline.js  v1.0
   剧情线管理 / 快照系统
   加载顺序：story-patch.js → story-extension.js → story-speed.js
            → story-fix.js → story-storyline.js

   v1.0 功能：
   1. 自动快照：所有 CHOICES 选项前自动记录快照（含临爽、群聊、
      s10、互助群等每一个选项节点）
   2. 手动快照：问卷填写前、问卷重置后、通过周学姐好友前、
      加入互助群前
   3. 设置 → 剧情线管理：列出所有快照，点击回退
   4. 回退时完整恢复：
      flags / trust / choice / questionnaireAnswers / forumLikes /
      forumReplies / profile / notifications / readNotifs / unread /
      markedRules / db.chats / db.friendRequests / db.memos /
      db.forum.posts / db.forum.boards / db.contacts
   5. 回退后自动导航：
      · 有 state.choice → 跳到对应聊天页（选项自动重现）
      · 问卷快照 → 跳到问卷页
      · 好友申请快照 → 跳到新的朋友页
      · 互助群快照 → 跳到互助板块帖子
   6. 安全清理：
      · 清理所有 _playingLock 防止残留
      · 隐藏光标指引、移除黑屏 overlay
      · 确保互助板块存在
   7. 快照独立存储（localStorage 独立 key），不影响主存档
   8. 最多保留 30 个快照（超出自动丢弃最旧）
   9. 快照标签人性化（"北苑群：自我介绍"等）
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

    /* ============================================================
       一、快照核心
       ============================================================ */
    var Snapshots = {
      /* 读取快照列表 */
      list: function () {
        try {
          var raw = localStorage.getItem(STORAGE_KEY);
          return raw ? JSON.parse(raw) : [];
        } catch (e) {
          return [];
        }
      },

      /* 保存快照列表（自动处理存储上限） */
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

      /* 深度快照当前 state（只取剧情相关字段） */
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

      /* 捕获快照 */
      capture: function (label, opts) {
        opts = opts || {};
        var list = this.list();
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
        for (var i = 0; i < list.length; i++) {
          if (list[i].id === id) { existing = i; break; }
        }
        if (existing >= 0) list[existing] = snap;
        else list.push(snap);

        while (list.length > MAX_SNAPSHOTS) list.shift();
        this.saveList(list);
        return snap;
      },

      /* 恢复快照 */
      restore: function (id) {
        var list = this.list();
        var cp = null;
        for (var i = 0; i < list.length; i++) {
          if (list[i].id === id) { cp = list[i]; break; }
        }
        if (!cp || !cp.snapshot) return null;
        var snap = cp.snapshot;

        function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }

        /* 恢复剧情字段 */
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

        /* 恢复 db */
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

        /* 确保互助板块存在 */
        if (state.db.forum && state.db.forum.boards) {
          if (!state.db.forum.boards.some(function (b) { return b.id === 'help'; })) {
            state.db.forum.boards.push({ id: 'help', name: '互助板块', hot: true });
          }
        }

        /* 清理所有播放锁 */
        if (window.StoryExtension && window.StoryExtension._playingLock) {
          Object.keys(window.StoryExtension._playingLock).forEach(function (k) {
            window.StoryExtension._playingLock[k] = false;
          });
        }

        /* 清理 UI 残留 */
        if (window.CursorGuide && CursorGuide.hide) {
          try { CursorGuide.hide(); } catch (e) {}
        }
        var ov = document.getElementById('wxg-warning-overlay');
        if (ov) ov.remove();

        save();
        return cp;
      },

      /* 删除单条快照 */
      delete: function (id) {
        var list = this.list().filter(function (c) { return c.id !== id; });
        this.saveList(list);
      },

      /* 清空所有快照 */
      clear: function () {
        this.saveList([]);
      }
    };

    window.StorySnapshots = Snapshots;

    /* ============================================================
       二、节点标签（自动快照时用）
       ============================================================ */
    var NODE_LABELS = {
      'grp1': '北苑群：自我介绍（陈默 / 阴魂不散）',
      'grp2': '北苑群：物资致谢（大义）',
      'grp3': '北苑群：对规则的看法（冷 / 不对劲）',
      'grp_s9': '北苑群：对寒潮预警的想法（张夏夏 / 规则）',
      'grp_s10': '北苑群：第16题的异常（我也发现 / 太敏感）',
      'ls_opening': '临爽私聊：寒潮 / 寝室邀请',
      'huzhu_1': '互助群：回应钱逸时',
      'huzhu_2': '互助群：荞麦面老师'
    };

    /* ============================================================
       三、自动包装所有 CHOICES 函数
       ============================================================ */
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

    /* 初次包装 */
    wrapAllChoices();
    /* 延时再包装一次，确保 story-speed.js 重写的也在 */
    setTimeout(wrapAllChoices, 500);
    setTimeout(wrapAllChoices, 2000);

    /* ============================================================
       四、问卷：打开时拍快照
       ============================================================ */
    if (PAGES.questionnaire) {
      var prevQuestionnaire = PAGES.questionnaire;
      PAGES.questionnaire = function (params) {
        var def = prevQuestionnaire(params);
        var origMount = def.mount;
        def.mount = function (root) {
          if (origMount) origMount(root);
          /* 只在初次填写前拍（Q16 未重置、还没提交） */
          if (!flag('q16_overridden') && !flag('s9_questionnaire_done')) {
            try {
              Snapshots.capture('问卷填写前（尚未提交）', {
                id: 'q_form_open',
                page: 'questionnaire'
              });
            } catch (e) { console.error(e); }
          }
        };
        return def;
      };
    }

    /* ============================================================
       五、问卷重置后：轮询检测，拍快照
       ============================================================ */
    setInterval(function () {
      if (flag('q16_overridden') &&
          !flag('q16_reset_snapped') &&
          !flag('s9_questionnaire_done')) {
        try {
          Snapshots.capture('问卷重置后（第16题已变为"是/不是"）', {
            id: 'q16_reset',
            page: 'questionnaire'
          });
          flag('q16_reset_snapped', true);
          save();
        } catch (e) { console.error(e); }
      }
    }, 800);

    /* ============================================================
       六、周学姐好友通过前：window capture 拍快照
       ============================================================ */
    window.addEventListener('click', function (e) {
      var el = e.target && e.target.closest && e.target.closest('[data-action="fr-accept-zxj"]');
      if (!el) return;
      try {
        Snapshots.capture('通过周学姐好友申请前', {
          id: 'before_accept_zxj',
          page: 'friendRequests'
        });
      } catch (err) { console.error(err); }
    }, true);

    /* ============================================================
       七、加入互助群前：window capture 拍快照
       ============================================================ */
    window.addEventListener('click', function (e) {
      var el = e.target && e.target.closest && e.target.closest('[data-action="join-group"]');
      if (!el) return;
      if (el.dataset.group !== 'huzhu') return;
      try {
        Snapshots.capture('加入互助群前', {
          id: 'before_join_huzhu',
          page: 'forumPost:p_help'
        });
      } catch (err) { console.error(err); }
    }, true);

    /* ============================================================
       八、导航：根据快照决定跳转目标
       ============================================================ */
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

    /* ============================================================
       九、剧情线管理页面
       ============================================================ */
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
          html += '<div class="memo-item" data-action="storyline-restore" data-id="' + esc(cp.id) + '">';
          html += '<div class="memo-title">' + esc(cp.label) + '</div>';
          html += '<div class="memo-meta"><span>' + fmtYMD(d) + ' ' + fmtHM(d) + '</span></div>';
          html += '</div>';
        });
      }

      html += '<div class="px4" style="padding-top:var(--sp-4);padding-bottom:var(--sp-6);">';
      html += '<button class="btn block danger" data-action="storyline-clear">清空所有快照</button>';
      html += '<div class="txt-xs txt-3 center mt3">快照仅保存关键剧情状态，不会影响其它数据。</div>';
      html += '</div>';

      html += '</div></div>';
      return { html: html };
    };

    /* ============================================================
       十、设置页入口
       ============================================================ */
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

    /* ============================================================
       十一、事件处理
       ============================================================ */
    document.addEventListener('click', async function (e) {
      var el = e.target.closest('[data-action]');
      if (!el) return;
      var a = el.dataset.action;

      /* 打开剧情线管理 */
      if (a === 'open-storyline') {
        e.stopPropagation();
        Router.push('storyLine');
        return;
      }

      /* 回退到某个快照 */
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

      /* 清空所有快照 */
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

    /* ============================================================
       十二、PAGES.forum 包装：确保互助板块存在
       ============================================================ */
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

    console.log('[story-storyline v1.0] 已加载，当前快照 ' + Snapshots.list().length + ' 个');
  });
})();
