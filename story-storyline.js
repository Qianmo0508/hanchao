/* ================================================================
   story-storyline.js  v2.0
   剧情线管理 / 快照系统（修复回档串剧情 + 快照重复问题）

   v2.0 修复：
   1. 回档后旧异步剧情继续跑 → 用"代际标记"：
      · 回档时更新 window.__storylineGeneration
      · 完全接管 themSay / meSay / sysNote / ensureMsgP，
        在 await sleep 后检查代际，不一致就放弃
      · 这样即使旧剧情还在 sleep 中，醒来也不会污染回档后的状态
   2. 回档时未完整清理 → 清所有 _playingLock、全局定时器、
      DOM 残留、光标、夜间 flag 等
   3. 快照重复 → 按 label 去重：
      · capture 时若已有相同 label 直接返回旧的，不新增
      · 定时扫描 localStorage 清重复 label
   4. 时间不同步 → snapshotState 里增加 clockBase / clockStartReal，
      restore 时恢复，回档后手机时间回到当时
   5. 回档后再延迟 600ms / 1200ms 各恢复一次关键状态，
     覆盖旧异步函数可能产生的"残影"（不 render，避免闪烁）

   保留 v1.0 全部内容（自动快照、手动快照、设置入口、恢复导航）
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
        typeof CHOICES !== 'undefined' &&
        typeof window.StorySnapshots === 'object') {
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
          —— 回档后代际改变，旧 sleep 醒来的消息推送全部放弃
       ============================================================ */
    function wrapMessageFunctions() {
      /* themSay */
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

      /* meSay */
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

      /* sysNote */
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

      /* ensureMsgP */
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
       二、包装 window.StorySnapshots 的 3 个方法
       ============================================================ */
    var SS = window.StorySnapshots;

    /* 2.1 capture —— 按 label 去重 */
    var oldCapture = SS.capture.bind(SS);
    SS.capture = function (label, opts) {
      try {
        var list = this.list();
        for (var i = 0; i < list.length; i++) {
          if (list[i].label === label) return list[i];
        }
      } catch (e) {}
      return oldCapture(label, opts);
    };

    /* 2.2 snapshotState —— 加入时间戳 */
    var oldSnapshotState = SS.snapshotState.bind(SS);
    SS.snapshotState = function () {
      var s = oldSnapshotState();
      s.clockBase = state.clockBase;
      s.clockStartReal = state.clockStartReal;
      return s;
    };

    /* 2.3 restore —— 完整清理 + 代际 + 延迟二次恢复 */
    var oldRestore = SS.restore.bind(SS);
    SS.restore = function (id) {
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

      /* 6) 调原 restore（会完整恢复所有 state 字段） */
      var cp = oldRestore(id);
      if (!cp) return null;

      /* 7) 额外恢复 clockBase（原 restore 不处理这个） */
      try {
        if (cp.snapshot && typeof cp.snapshot.clockBase === 'number') {
          state.clockBase = cp.snapshot.clockBase;
          state.clockStartReal = Date.now();
          save();
        }
      } catch (e) {}

      /* 8) 确保互助板块存在 */
      try {
        if (!state.db) state.db = {};
        if (!state.db.forum) state.db.forum = { boards: [], posts: [] };
        if (!Array.isArray(state.db.forum.boards)) state.db.forum.boards = [];
        if (!state.db.forum.boards.some(function (b) { return b.id === 'help'; })) {
          state.db.forum.boards.push({ id: 'help', name: '互助板块', hot: true });
          save();
        }
      } catch (e) {}

      /* 9) 延迟二次、三次恢复（只覆盖关键字段，不 render，避免闪烁）
            覆盖旧异步函数在回档后 0~1.2 秒内可能产生的"残影" */
      var snapshotData = cp.snapshot;
      function silentReapply() {
        if (!snapshotData) return;
        try {
          if (snapshotData.flags) state.flags = JSON.parse(JSON.stringify(snapshotData.flags));
          if (snapshotData.trust) state.trust = JSON.parse(JSON.stringify(snapshotData.trust));
          if (snapshotData.choice !== undefined) {
            state.choice = snapshotData.choice ? JSON.parse(JSON.stringify(snapshotData.choice)) : null;
          }
          if (snapshotData.questionnaireAnswers) {
            state.questionnaireAnswers = JSON.parse(JSON.stringify(snapshotData.questionnaireAnswers));
          }
          if (snapshotData.notifications) state.notifications = JSON.parse(JSON.stringify(snapshotData.notifications));
          if (snapshotData.readNotifs) state.readNotifs = JSON.parse(JSON.stringify(snapshotData.readNotifs));
          if (snapshotData.unread) state.unread = JSON.parse(JSON.stringify(snapshotData.unread));
          if (snapshotData.db && snapshotData.db.chats) {
            state.db.chats = JSON.parse(JSON.stringify(snapshotData.db.chats));
          }
          if (snapshotData.db && snapshotData.db.friendRequests) {
            state.db.friendRequests = JSON.parse(JSON.stringify(snapshotData.db.friendRequests));
          }
          if (snapshotData.db && snapshotData.db.memos) {
            state.db.memos = JSON.parse(JSON.stringify(snapshotData.db.memos));
          }
          save();
        } catch (e) {}
      }
      setTimeout(silentReapply, 600);
      setTimeout(silentReapply, 1200);

      return cp;
    };

    /* ============================================================
       三、定时去重 localStorage 中的快照（按 label 保留最早一条）
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
       四、其余 v1.0 逻辑原样保留：
          · 自动包装 CHOICES（用 SS.capture 新版本，自动按 label 去重）
          · 问卷 / 好友申请 / 互助群 的手动快照
          · 设置入口 / 剧情线管理页面 / 导航 / 清空
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
              SS.capture(label, { id: 'node_' + nodeId, page: page });
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
              SS.capture('问卷填写前（尚未提交）', { id: 'q_form_open', page: 'questionnaire' });
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
          SS.capture('问卷重置后（第16题已变为"是/不是"）', { id: 'q16_reset', page: 'questionnaire' });
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
        SS.capture('通过周学姐好友申请前', { id: 'before_accept_zxj', page: 'friendRequests' });
      } catch (err) {}
    }, true);

    /* 加入互助群前快照 */
    window.addEventListener('click', function (e) {
      var el = e.target && e.target.closest && e.target.closest('[data-action="join-group"]');
      if (!el) return;
      if (el.dataset.group !== 'huzhu') return;
      try {
        SS.capture('加入互助群前', { id: 'before_join_huzhu', page: 'forumPost:p_help' });
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
      var list = SS.list();
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
        var list = SS.list();
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

        var restored = SS.restore(id);
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
        SS.clear();
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

    console.log('[story-storyline v2.0] 已加载，代际=' + window.__storylineGeneration + '，快照 ' + SS.list().length + ' 个');
  });
})();
