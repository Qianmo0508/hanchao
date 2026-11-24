/* ================================================================
   story-speed.js  v4.0
   加载顺序：story-patch.js → story-extension.js → story-speed.js
             → story-storyline.js → story-extension-2.js → story-fix.js

   v4.0 修复（相对 v3.1）：
   【关键】story-storyline v2.2 会重新覆盖 window.themSay / meSay / sysNote，
          导致主代码 CHOICES.grp1/grp2/grp3 走 storyline 的快速版本，
          从而"选项前 520ms、选项后 1950ms"节奏不一致。
   修复方案：
     · themSay / meSay / sysNote 改为【直接实现】，不再委托 _orig
     · 加载时 + setInterval(300ms) 持续 rebind，防止被后续文件覆盖
     · 忽略主代码传入的 delay，固定基准：
       themSay 1500、meSay 800、sysNote 800，再 × getSpeed()
     · 默认速度 1.3 → 1.5（保留用户主动选过的值，用 patchDefaults 标记迁移）
     · ensureMsgP：已存在消息也给 1/4 短延时，避免刷新后瞬闪

   保留 v3.1 全部内容：
   1. 论坛帖子 p5~p10（加载 + 每次渲染强制合并）
   2. ls / by 全阶段接管（不依赖 patch / extension）
   3. 设置 → 触感反馈下方"消息显示速度"六档
   4. stage 迁移、断点续播
   ================================================================ */
(function () {
  'use strict';

  function baseReady(fn) {
    if (typeof PAGES !== 'undefined' && typeof state !== 'undefined' &&
        typeof save === 'function' && typeof flag === 'function' &&
        typeof sleep === 'function' && typeof render === 'function' &&
        typeof refreshChat === 'function' && typeof storyTime === 'function' &&
        typeof uid === 'function' && typeof esc === 'function' &&
        typeof addTrust === 'function' && typeof trustNote === 'function' &&
        typeof navBar === 'function' && typeof CHOICES !== 'undefined' &&
        typeof Toast !== 'undefined' && typeof Router !== 'undefined' &&
        typeof NotifService !== 'undefined' && typeof CursorGuide !== 'undefined' &&
        typeof ConfirmBox !== 'undefined' && typeof fmtFull === 'function' &&
        typeof sysNow === 'function' && typeof sysTimeStr === 'function') {
      fn();
    } else {
      setTimeout(function () { baseReady(fn); }, 80);
    }
  }

  baseReady(function () {

    /* ============================================================
       1. 状态兜底
       ============================================================ */
    if (!state.settings) state.settings = {};
    if (!state.flags) state.flags = {};
    if (!state.db) state.db = {};
    if (!state.db.forum) state.db.forum = { boards: [], posts: [] };
    if (!Array.isArray(state.db.forum.posts)) state.db.forum.posts = [];
    if (!state.db.chats) state.db.chats = {};
    if (!Array.isArray(state.db.memos)) state.db.memos = [];

    /* ============================================================
       2. 速度工具
       ============================================================ */
    if (!state.patchDefaults) state.patchDefaults = {};
    if (!state.patchDefaults.speedV4Upgraded) {
      if (state.settings.msgSpeed === undefined || state.settings.msgSpeed === 1.3) {
        state.settings.msgSpeed = 1.5;
      }
      state.patchDefaults.speedV4Upgraded = true;
      save();
    }
    if (state.settings.msgSpeed === undefined) {
      state.settings.msgSpeed = 1.5;
      save();
    }

    function getSpeed() {
      var v = state.settings.msgSpeed;
      return (typeof v === 'number' && v > 0) ? v : 1.5;
    }
    function _dl(base) { return Math.round(base * getSpeed()); }

    /* ============================================================
       3. themSay / meSay / sysNote —— 直接实现 + setInterval rebind
          【v4.0 关键修复】忽略主代码 delay，固定基准。
          · themSay base 1500ms
          · meSay   base 800ms
          · sysNote base 800ms
          × getSpeed()（默认 1.5x → 角色 2250ms、玩家 1200ms）
       ============================================================ */
    var finalThemSay = async function (cid, name, text, delay) {
      var gen = window.__storylineGeneration;
      if (window.__storylineFrozen) return;
      await sleep(_dl(1500));
      if (window.__storylineGeneration !== gen) return;
      if (window.__storylineFrozen) return;
      var chat = state.db && state.db.chats && state.db.chats[cid];
      if (!chat) return;
      if (!Array.isArray(chat.messages)) chat.messages = [];
      if (chat.messages.some(function (m) { return m.from === name && m.text === text; })) return;
      chat.messages.push({ id: uid('m'), from: name, text: text, time: storyTime() });
      save();
      refreshChat(cid);
    };
    finalThemSay.__speedWrapper = true;

    var finalMeSay = async function (cid, text, delay) {
      var gen = window.__storylineGeneration;
      if (window.__storylineFrozen) return;
      await sleep(_dl(800));
      if (window.__storylineGeneration !== gen) return;
      if (window.__storylineFrozen) return;
      var chat = state.db && state.db.chats && state.db.chats[cid];
      if (!chat) return;
      if (!Array.isArray(chat.messages)) chat.messages = [];
      if (chat.messages.some(function (m) { return m.from === 'me' && m.text === text; })) return;
      chat.messages.push({ id: uid('m'), from: 'me', text: text, time: storyTime() });
      save();
      refreshChat(cid);
    };
    finalMeSay.__speedWrapper = true;

    var finalSysNote = async function (cid, text, delay) {
      var gen = window.__storylineGeneration;
      if (window.__storylineFrozen) return;
      await sleep(_dl(800));
      if (window.__storylineGeneration !== gen) return;
      if (window.__storylineFrozen) return;
      var chat = state.db && state.db.chats && state.db.chats[cid];
      if (!chat) return;
      if (!Array.isArray(chat.messages)) chat.messages = [];
      if (chat.messages.some(function (m) { return m.type === 'system' && m.text === text; })) return;
      chat.messages.push({ id: uid('m'), type: 'system', text: text, time: storyTime() });
      save();
      refreshChat(cid);
    };
    finalSysNote.__speedWrapper = true;

    function rebindSay() {
      if (window.themSay !== finalThemSay) window.themSay = finalThemSay;
      if (window.meSay !== finalMeSay) window.meSay = finalMeSay;
      if (window.sysNote !== finalSysNote) window.sysNote = finalSysNote;
    }
    rebindSay();
    setInterval(rebindSay, 300);

    /* ============================================================
       4. ensureMsgP —— 幂等 + 已存在时短延时（避免刷新后瞬闪）
       ============================================================ */
    async function ensureMsgP(cid, msg, baseDelay) {
      var gen = window.__storylineGeneration;
      if (window.__storylineFrozen) return;
      var chat = state.db.chats[cid];
      if (!chat) return;
      if (!Array.isArray(chat.messages)) chat.messages = [];
      var exists = chat.messages.some(function (m) {
        if (msg.type === 'system') return m.type === 'system' && m.text === msg.text;
        if (msg.type === 'card') return m.type === 'card' && m.title === msg.title && m.desc === msg.desc;
        return m.from === msg.from && m.text === msg.text;
      });
      if (exists) {
        if (baseDelay && baseDelay > 0) await sleep(_dl(Math.round(baseDelay / 4)));
        return;
      }
      if (baseDelay && baseDelay > 0) await sleep(_dl(baseDelay));
      if (window.__storylineGeneration !== gen) return;
      if (window.__storylineFrozen) return;
      chat.messages.push(Object.assign({ id: uid('m'), time: storyTime() }, msg));
      save();
      refreshChat(cid);
    }

    /* ============================================================
       5. 论坛帖子恢复
       ============================================================ */
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

    function ensureForumPosts() {
      if (!Array.isArray(state.db.forum.posts)) state.db.forum.posts = [];
      var added = 0;
      MORE_POSTS.forEach(function (p) {
        if (!state.db.forum.posts.some(function (x) { return x.id === p.id; })) {
          state.db.forum.posts.push(p);
          added++;
        }
      });
      if (added > 0) save();
      return added;
    }
    ensureForumPosts();

    var prevForum = PAGES.forum;
    PAGES.forum = function (params) {
      ensureForumPosts();
      return prevForum(params);
    };

    /* ============================================================
       6. playingLock
       ============================================================ */
    var _lock = (window.StoryExtension && window.StoryExtension._playingLock)
      ? window.StoryExtension._playingLock
      : {};
    if (!window.StoryExtension) window.StoryExtension = { _playingLock: _lock, CHOICES: CHOICES };
    else if (!window.StoryExtension._playingLock) window.StoryExtension._playingLock = _lock;

    /* ============================================================
       7. stage 迁移
       ============================================================ */
    (function migrateStages() {
      var lsStage = flag('ls_stage') || 0;
      if (lsStage === 3) {
        var ls = state.db.chats.ls;
        if (ls) {
          var hasA = ls.messages.some(function (m) { return m.text === '话说回来，你觉得有没有觉得寒潮封校这件事很奇怪'; });
          var hasB = ls.messages.some(function (m) { return m.text === '封楼期间欢迎你来412大吃特吃嗷'; });
          var hasWk = ls.messages.some(function (m) { return m.text === '诶wk，周学姐好像在群里发东西了'; });
          if (hasWk) flag('ls_stage', 4);
          else if (hasA) { flag('ls_choice_key', 'a'); flag('ls_stage', 5); }
          else if (hasB) { flag('ls_choice_key', 'b'); flag('ls_stage', 5); }
          else flag('ls_stage', 2);
          save();
        }
      }
      var s9Stage = flag('s9_stage') || 0;
      if (s9Stage === 3) {
        var by = state.db.chats.by;
        if (by) {
          var hasLink = by.messages.some(function (m) { return m.text === '【问卷链接】'; });
          if (hasLink) flag('s9_stage', 4);
          else if (flag('s9_choice_key')) flag('s9_stage', 5);
          else flag('s9_stage', 2);
          save();
        }
      }
    })();

    /* ============================================================
       8. PAGES.chat 完整接管 mount
       ============================================================ */
    var prevChat = PAGES.chat;
    PAGES.chat = function (params) {
      var def = prevChat(params);
      def.mount = function (root) {
        var body = root.querySelector('#chat-body');
        if (body) body.scrollTop = body.scrollHeight;
        try { onChatOpenSpeed(params.id); }
        catch (e) { console.error('[speed] onChatOpenSpeed', e); }
      };
      return def;
    };

    function onChatOpenSpeed(cid) {
      if (cid === 'ls') handleLsSpeed();
      else if (cid === 'by') handleBySpeed();
    }

    /* ============================================================
       9. ls 流程
       ============================================================ */
    function handleLsSpeed() {
      if (!flag('ls_added')) return;
      if (_lock['ls'] || _lock['ls_post']) return;
      var stage = flag('ls_stage') || 0;

      if (stage === 0 || stage === 1) { playLinShuangOpeningSpeed(); return; }
      if (stage === 2) {
        if (!(state.choice && state.choice.chatId === 'ls')) {
          state.choice = { chatId: 'ls', nodeId: 'ls_opening', options: [
            { k: 'a', label: '①你觉得寒潮这件事…' },
            { k: 'b', label: '②欢迎来我们寝室玩' }
          ]};
          save();
          render();
        }
        return;
      }
      if (stage === 5) {
        var key = flag('ls_choice_key') || 'a';
        if (CHOICES.ls_opening && CHOICES.ls_opening[key]) CHOICES.ls_opening[key]();
        return;
      }
      if (stage === 6 || stage === 7) { playLsPostChoiceSpeed(); return; }
    }

    async function playLinShuangOpeningSpeed() {
      if (_lock['ls']) return;
      _lock['ls'] = true;
      flag('ls_stage', 1);
      save();
      try {
        await ensureMsgP('ls', { type: 'system', text: '你已通过对方的好友申请' }, 800);
        await ensureMsgP('ls', { from: '临爽', text: '特殊期间嘛，有什么事咱俩可以互相照应一下桀桀桀' }, 1500);
        await ensureMsgP('ls', { from: '临爽', text: '毕竟你就在我对门' }, 1500);
        await ensureMsgP('ls', { from: '临爽', text: '哦对了，真是靠了我得先把你的备注从王晓歌改到陈默…' }, 1500);
        await sleep(_dl(800));
        flag('ls_stage', 2);
        state.choice = { chatId: 'ls', nodeId: 'ls_opening', options: [
          { k: 'a', label: '①你觉得寒潮这件事…' },
          { k: 'b', label: '②欢迎来我们寝室玩' }
        ]};
        save();
        render();
      } finally { _lock['ls'] = false; }
    }

    async function playLsPostChoiceSpeed() {
      if (_lock['ls_post']) return;
      _lock['ls_post'] = true;
      flag('ls_stage', 7);
      save();
      try {
        await ensureMsgP('ls', { from: '临爽', text: '诶wk，周学姐好像在群里发东西了' }, 1500);
        await sleep(_dl(900));
        flag('ls_stage', 4);
        save();
        triggerS9GroupSpeed();
      } finally { _lock['ls_post'] = false; }
    }

    /* ============================================================
       10. by 流程
       ============================================================ */
    function handleBySpeed() {
      var chat = state.db.chats.by;
      if (!chat) return;
      if (chat.joined === false) {
        chat.joined = true;
        if (!chat.messages.length) {
          chat.messages.push({ id: uid('m'), type: 'system', text: '“王晓歌”被拉入群聊', time: storyTime() });
        }
        save();
        setTimeout(function () { render(); }, 40);
      }
      if (_lock['by_g1'] || _lock['by_g2'] || _lock['by_s8'] || _lock['by_s9'] || _lock['by_s9_post']) return;

      if (flag('invited') && !flag('grp1msgs')) {
        flag('grp1msgs', true);
        setTimeout(runGroup1Speed, 800);
        return;
      }
      if (flag('readPost1') && !flag('grp2msgs') && !(state.choice && state.choice.chatId === 'by')) {
        flag('grp2msgs', true);
        setTimeout(runGroup2Speed, 800);
        return;
      }
      if (flag('pending_s8') && !flag('s8msgs')) {
        flag('pending_s8', false);
        flag('s8msgs', true);
        setTimeout(runScene8Speed, 800);
        return;
      }
      if (flag('s9_pending')) {
        var stage = flag('s9_stage') || 0;
        if (stage === 0) { flag('s9_stage', 1); setTimeout(playS9GroupSpeed, 800); }
        else if (stage === 2) {
          if (!(state.choice && state.choice.chatId === 'by')) {
            state.choice = { chatId: 'by', nodeId: 'grp_s9', options: [
              { k: 'a', label: '①你不留校怎么还进留校群' },
              { k: 'b', label: '②羡慕你，受不了这个规则了' }
            ]};
            save(); render();
          }
        }
        else if (stage === 5) {
          var key = flag('s9_choice_key') || 'a';
          if (CHOICES.grp_s9 && CHOICES.grp_s9[key]) CHOICES.grp_s9[key]();
        }
        else if (stage === 6 || stage === 7) { playS9PostChoiceSpeed(); }
        else if (stage === 4) {
          setTimeout(function () {
            CursorGuide.show('[data-action="jump"][data-page="questionnaire"]', '点击填写问卷');
          }, 500);
        }
      }
    }

    async function runGroup1Speed() {
      if (_lock['by_g1']) return;
      _lock['by_g1'] = true;
      try {
        await ensureMsgP('by', { from: '沈敏', text: '这不是412的？王晓歌？' }, 1500);
        await ensureMsgP('by', { from: '沈敏', text: '卧槽你们拉她干嘛啊！？' }, 1500);
        await ensureMsgP('by', { from: '临爽', text: '？什么，详细说来👂🏻' }, 1500);
        await ensureMsgP('by', { from: '沈敏', text: '也没什么…就，你自己看看论坛' }, 1500);
        await sleep(_dl(1200));
        if (!flag('forumGuided')) {
          flag('forumGuided', true);
          Router.root('home');
          setTimeout(function () { CursorGuide.show('[data-app="forum"]', '去看看渠中校园论坛'); }, 900);
        }
      } finally { _lock['by_g1'] = false; }
    }

    async function runGroup2Speed() {
      if (_lock['by_g2']) return;
      _lock['by_g2'] = true;
      try {
        await ensureMsgP('by', { from: '许双荞', text: '群主是周学姐吗？' }, 1500);
        await ensureMsgP('by', { from: '沈敏', text: '@周学姐 学姐拉她干嘛啊啊别来索我命我什么都没干' }, 1500);
        await sleep(_dl(800));
        state.choice = { chatId: 'by', nodeId: 'grp1', options: [
          { k: 'a', label: '①我是她室友陈默' },
          { k: 'b', label: '②其实我一直阴魂不散哦' }
        ]};
        save();
        render();
      } finally { _lock['by_g2'] = false; }
    }

    async function runScene8Speed() {
      if (_lock['by_s8']) return;
      _lock['by_s8'] = true;
      try {
        await ensureMsgP('by', { from: '沈敏', text: '看到了，这也太苛刻了吧？！' }, 1500);
        await ensureMsgP('by', { from: '临爽', text: '才特么6点就不让出楼…是人吗…' }, 1500);
        await ensureMsgP('by', { from: '许双荞', text: '现在貌似已经六点了' }, 1500);
        await ensureMsgP('by', { from: '周学姐', text: '@所有人 现在开始所有人不要出楼！' }, 1500);
        await ensureMsgP('by', { from: '邓许', text: '我倒是有个疑问啊……' }, 1500);
        await ensureMsgP('by', { from: '邓许', text: '寒潮是寒潮，出个宿舍楼和“人身安全”有什么关系？' }, 1500);
        await ensureMsgP('by', { from: '邓许', text: '又和固定的时间有什么关系？' }, 1500);
        await ensureMsgP('by', { from: '沈敏', text: '说的对啊……顶多被冻着，可这应该算健康问题，怎么能算人身安全' }, 1500);
        await sleep(_dl(800));
        state.choice = { chatId: 'by', nodeId: 'grp3', options: [
          { k: 'a', label: '①也许是现在很冷呢？' },
          { k: 'b', label: '②这很不对劲' }
        ]};
        save();
        render();
      } finally { _lock['by_s8'] = false; }
    }

    /* ============================================================
       11. s9
       ============================================================ */
    function triggerS9GroupSpeed() {
      if (flag('s9_notified')) return;
      flag('s9_notified', true);
      flag('s9_pending', true);
      flag('s9_stage', 0);
      var byChat = state.db.chats.by;
      if (byChat && !byChat.messages.some(function (m) {
        return m.from === '周学姐' && m.text === '@所有人 打扰大家一下';
      })) {
        byChat.messages.push({ id: uid('m'), from: '周学姐', text: '@所有人 打扰大家一下', time: storyTime() });
        save();
      }
      NotifService.push({
        id: 'n_s9',
        title: '北苑留校女生群',
        detail: '周学姐：@所有人 打扰大家一下',
        target: { page: 'chat', params: { id: 'by' } }
      });
      var cur = Router.current();
      if (cur.page === 'chat' && cur.params.id === 'by') {
        setTimeout(function () { render(); }, 200);
      }
    }

    async function playS9GroupSpeed() {
      if (_lock['by_s9']) return;
      _lock['by_s9'] = true;
      flag('s9_stage', 1);
      save();
      try {
        await ensureMsgP('by', { from: '周学姐', text: '你们对这次"寒潮预警"有什么想法么……？' }, 1500);
        await ensureMsgP('by', { from: '许双荞', text: '怪怪的，现在才五月份啊' }, 1500);
        await ensureMsgP('by', { from: '临爽', text: '？我靠你不说我都忘了，现在是5月啊！！哪门子的寒潮我问你' }, 1500);
        await ensureMsgP('by', { from: '苏青', text: '五月飞雪，好一出窦娥冤～' }, 1500);
        await ensureMsgP('by', { from: '张夏夏', text: '我早就感觉奇怪了，还好提前撤离了……还是在家舒服啊！' }, 1500);
        await sleep(_dl(800));
        flag('s9_stage', 2);
        state.choice = { chatId: 'by', nodeId: 'grp_s9', options: [
          { k: 'a', label: '①你不留校怎么还进留校群' },
          { k: 'b', label: '②羡慕你，受不了这个规则了' }
        ]};
        save();
        render();
      } finally { _lock['by_s9'] = false; }
    }

    async function playS9PostChoiceSpeed() {
      if (_lock['by_s9_post']) return;
      _lock['by_s9_post'] = true;
      flag('s9_stage', 7);
      save();
      try {
        await ensureMsgP('by', { from: '周学姐', text: '嗯，别的不敢多说，这也是我来找大家的目的。' }, 1500);
        await ensureMsgP('by', { from: '周学姐', text: '北苑的同学们，麻烦大家配合一下，填写以下问卷，我会反馈这一切的蹊跷。' }, 1500);
        await ensureMsgP('by', { from: '临爽', text: '啊靠——都这时候了还要填excel，不要啊！！！（震声' }, 1500);
        await ensureMsgP('by', { from: '周学姐', text: '哈哈别急，除了excel还有你们最爱的ddl' }, 1500);
        await ensureMsgP('by', { from: '周学姐', text: '请大家在今晚前提交给我。' }, 1500);
        await ensureMsgP('by', { from: '张夏夏', text: '我、我也要交吗？' }, 1500);
        await ensureMsgP('by', { from: '周学姐', text: '。。你不用' }, 1500);
        await sleep(_dl(800));
        var hasLink = state.db.chats.by.messages.some(function (m) {
          return m.from === '周学姐' && m.text === '【问卷链接】';
        });
        if (!hasLink) {
          state.db.chats.by.messages.push({
            id: uid('m'), from: '周学姐', text: '【问卷链接】', time: storyTime(),
            link: { text: '【问卷链接】', page: 'questionnaire', params: {} }
          });
          save();
          refreshChat('by');
        }
        await ensureMsgP('by', { from: '许双荞', text: '周学姐，这个问卷的提交处好像不是你啊' }, 1500);
        await ensureMsgP('by', { from: '邓许', text: '好像，还真是……' }, 1500);
        flag('s9_stage', 4);
        save();
        await sleep(_dl(900));
        var body = document.querySelector('#chat-body');
        if (body) body.scrollTop = body.scrollHeight;
        await sleep(_dl(500));
        CursorGuide.show('[data-action="jump"][data-page="questionnaire"]', '点击填写问卷');
      } finally { _lock['by_s9_post'] = false; }
    }

    /* ============================================================
       12. CHOICES.ls_opening / grp_s9
       ============================================================ */
    CHOICES.ls_opening = {
      async a() {
        if (_lock['ls']) return;
        _lock['ls'] = true;
        try {
          state.choice = null;
          flag('ls_choice_key', 'a');
          flag('ls_stage', 5);
          save();
          refreshChat('ls');
          await ensureMsgP('ls', { from: 'me', text: '话说回来，你觉得有没有觉得寒潮封校这件事很奇怪' }, 800);
          await ensureMsgP('ls', { from: '临爽', text: '是吗？小破中老整这种莫名其妙的东西，明明也没有很冷啊' }, 1500);
          flag('ls_stage', 6);
          save();
        } finally { _lock['ls'] = false; }
        await playLsPostChoiceSpeed();
      },
      async b() {
        if (_lock['ls']) return;
        _lock['ls'] = true;
        try {
          state.choice = null;
          flag('ls_choice_key', 'b');
          flag('ls_stage', 5);
          save();
          refreshChat('ls');
          await ensureMsgP('ls', { from: 'me', text: '封楼期间欢迎你来412大吃特吃嗷' }, 800);
          await ensureMsgP('ls', { from: 'me', text: 'VVIP贵宾一位里边儿请～' }, 800);
          await ensureMsgP('ls', { from: '临爽', text: '这老板恐怕是邓许吧' }, 1500);
          await ensureMsgP('ls', { from: '临爽', text: '你只能算个服务员哈哈哈哈' }, 1500);
          await ensureMsgP('ls', { from: 'me', text: '我去你的！' }, 800);
          addTrust(['临爽'], 3);
          await ensureMsgP('ls', { type: 'system', text: trustNote(['临爽'], 3) }, 800);
          flag('ls_stage', 6);
          save();
        } finally { _lock['ls'] = false; }
        await playLsPostChoiceSpeed();
      }
    };

    CHOICES.grp_s9 = {
      async a() {
        if (_lock['by_s9_post']) return;
        _lock['by_s9_post'] = true;
        try {
          state.choice = null;
          flag('s9_choice_key', 'a');
          flag('s9_stage', 5);
          save();
          refreshChat('by');
          await ensureMsgP('by', { from: 'me', text: '这个张夏夏，都不留校怎么还在留校群里苟着啊！' }, 800);
          await ensureMsgP('by', { from: '张夏夏', text: '一线吃瓜～' }, 1500);
          await ensureMsgP('by', { from: '周学姐', text: '我拉的，因为貌似她只能通过这个群和我们联系。' }, 1500);
          await ensureMsgP('by', { from: '临爽', text: '挖什么金矿' }, 1500);
          await ensureMsgP('by', { from: '张夏夏', text: '是这样的…封校那天我发现我联系不上你们任何一个人，直到看到论坛里有这个群的链接，我才好歹能和你们说上话！' }, 1500);
          await ensureMsgP('by', { from: '张夏夏', text: '我似乎是一出校就被识别为"校外人员"了……总之珍惜吧！' }, 1500);
          await ensureMsgP('by', { from: '苏青', text: '确实呢，我现在一想和校外的朋友联系就会弹出一个警告' }, 1500);
          await ensureMsgP('by', { from: '沈敏', text: '对，好像是什么"寒潮期间禁止与校外人员通讯"，弱智极了' }, 1500);
          await ensureMsgP('by', { from: 'me', text: '这不是把我们大家都囚禁在渠中了吗……切断一切外界联系' }, 800);
          await ensureMsgP('by', { from: '邓许', text: '寒潮真的至于这样吗？我不敢苟同' }, 1500);
          var title = '线索：校外人员？';
          if (!state.db.memos.some(function (m) { return m.title === title; })) {
            state.db.memos.push({
              id: uid('memo'), title: title, type: 'auto', time: fmtFull(sysNow()),
              content: '封校后，"校外人员"似乎被隔离了——张夏夏一出校就被系统识别为校外人员，无法与校内联系。\n苏青：一想和校外的朋友联系就会弹出警告"寒潮期间禁止与校外人员通讯"。\n\n这意味着，可能不止寒潮——学校在切断我们与外界的一切联系。'
            });
            save();
          }
          await ensureMsgP('by', { type: 'system', text: '［"线索：校外人员？"已自动记录进备忘录］' }, 800);
          flag('s9_stage', 6);
          save();
        } finally { _lock['by_s9_post'] = false; }
        await playS9PostChoiceSpeed();
      },
      async b() {
        if (_lock['by_s9_post']) return;
        _lock['by_s9_post'] = true;
        try {
          state.choice = null;
          flag('s9_choice_key', 'b');
          flag('s9_stage', 5);
          save();
          refreshChat('by');
          await ensureMsgP('by', { from: 'me', text: '真羡慕你啊……' }, 800);
          await ensureMsgP('by', { from: 'me', text: '我是真受不了这个雷霆规则了！' }, 800);
          await ensureMsgP('by', { from: '沈敏', text: '是啊，根本不是给人用的' }, 1500);
          await ensureMsgP('by', { from: '临爽', text: 'md真的太痛苦了，我们完全就是被囚禁圈养在渠中的牲畜啊！' }, 1500);
          await ensureMsgP('by', { from: '周学姐', text: '没有"们"。。。你自己是牲畜就够了。' }, 1500);
          await ensureMsgP('by', { from: '临爽', text: '？' }, 1500);
          await ensureMsgP('by', { from: '苏青', text: '太无聊了，姐姐我实在很想去7号楼找你们玩哦，奈何学校不让' }, 1500);
          await ensureMsgP('by', { from: '苏青', text: '我也很无奈～' }, 1500);
          await ensureMsgP('by', { from: '许双荞', text: '，，似乎你刚说了懒得出校门' }, 1500);
          await ensureMsgP('by', { from: '张夏夏', text: '哈哈哈我看到你们转发的规则了……哎不是感觉怎么看都怪怪的啊但是' }, 1500);
          addTrust(['沈敏', '临爽'], 1);
          await ensureMsgP('by', { type: 'system', text: trustNote(['沈敏', '临爽'], 1) }, 800);
          flag('s9_stage', 6);
          save();
        } finally { _lock['by_s9_post'] = false; }
        await playS9PostChoiceSpeed();
      }
    };

    /* ============================================================
       13. 设置页速度入口
       ============================================================ */
    var prevSettings = PAGES.settings;
    PAGES.settings = function () {
      var def = prevSettings();
      var prevMount = def.mount;
      def.mount = function (root) {
        if (prevMount) prevMount(root);
        var vib = root.querySelector('[data-action="toggle-vibrate"]');
        if (vib && !root.querySelector('[data-action="open-msg-speed"]')) {
          vib.insertAdjacentHTML('afterend',
            '<div class="row" data-action="open-msg-speed">' +
              '<div class="r-main"><div class="r-title">消息显示速度</div><div class="r-sub">' + getSpeed().toFixed(1) + 'x</div></div>' +
              '<span class="chev-r">›</span>' +
            '</div>'
          );
        }
      };
      return def;
    };

    var SPEED_OPTIONS = [
      { v: 1.0, label: '1.0x · 原速' },
      { v: 1.2, label: '1.2x · 稍快' },
      { v: 1.5, label: '1.5x · 推荐' },
      { v: 1.8, label: '1.8x · 慢速' },
      { v: 2.0, label: '2.0x · 很慢' },
      { v: 2.5, label: '2.5x · 极慢' }
    ];

    PAGES.msgSpeed = function () {
      var cur = getSpeed();
      var rows = SPEED_OPTIONS.map(function (o) {
        return '<div class="row" data-action="set-msg-speed" data-v="' + o.v + '">' +
          '<div class="r-main"><div class="r-title">' + esc(o.label) + '</div></div>' +
          '<span class="r-right">' + (Math.abs(cur - o.v) < 0.01 ? '✓ 当前' : '') + '</span>' +
        '</div>';
      }).join('');
      return {
        html: '<div class="page">' +
          navBar('消息显示速度') +
          '<div class="page-body">' +
            '<div class="card" style="margin-top:var(--sp-3)">' + rows + '</div>' +
            '<div class="px4 txt-xs txt-3 center mt3">数值越大，消息出现越慢。选项前后所有对话均按此速度播放。</div>' +
          '</div>' +
        '</div>'
      };
    };

    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-action]');
      if (!el) return;
      var a = el.dataset.action;
      if (a === 'open-msg-speed') {
        e.stopPropagation();
        Router.push('msgSpeed');
        return;
      }
      if (a === 'set-msg-speed') {
        e.stopPropagation();
        var v = parseFloat(el.dataset.v);
        if (!isNaN(v) && v > 0) {
          state.settings.msgSpeed = v;
          save();
          Toast.show('消息速度：' + v.toFixed(1) + 'x');
          Router.pop();
        }
      }
    }, true);

    /* ============================================================
       14. 暴露 API
       ============================================================ */
    window.StorySpeed = {
      getSpeed: getSpeed,
      adjust: _dl,
      ensureMsgP: ensureMsgP,
      ensureForumPosts: ensureForumPosts,
      triggerS9GroupSpeed: triggerS9GroupSpeed,
      playS9PostChoiceSpeed: playS9PostChoiceSpeed,
      playLsPostChoiceSpeed: playLsPostChoiceSpeed,
      SPEED_OPTIONS: SPEED_OPTIONS
    };

    console.log('[story-speed v4.0] 已加载，速度 ' + getSpeed() + 'x，论坛帖子 ' + state.db.forum.posts.length + ' 条，themSay/meSay/sysNote 已锁定');
  });
})();
