/* ================================================================
   story-speed.js  v2.0
   消息速度 + 论坛帖子 + 剧情时序综合补丁（与 story-patch.js /
   story-extension.js 并存，加载顺序必须在两者之后）

   v2.0 修复：
   1. 【论坛帖子消失】加载时幂等恢复 p5~p10
   2. 【"wk 学姐发东西了"提前】根因是 CHOICES 播放期间原 handle
      介入并触发 wk，导致前后穿插。修复方式：
      - CHOICES 开始即占 _playingLock['ls']/['by_s9_post']
      - 用 stage 5/6/7 让原 handle 走到最后 return（不介入）
      - 播放完毕自己 triggerS9Group，不依赖原 handle
   3. 【问卷提前出现在选项分支前】同上，stage 分得更细：
      stage 5 = 选项前置播放中 / 6 = 前置完成待 wk / 7 = wk 播放中
      / 4 = 已完成。原 handle 遇到 5/6/7 会 return
   4. 【速度不统一】所有 CHOICES 分支 & playLsPostChoice & playS9PostChoice
      的 delay 统一乘上 getSpeed()（默认 1.3x）。player 消息 base 800ms、
      角色消息 base 1500~1700ms、系统消息 800ms，节奏一致
   5. 设置里加"消息显示速度"入口（六档 1.0x ~ 2.0x）
   6. 中途刷新恢复：包装 PAGES.chat.mount，stage 5/6/7 时按
      ls_choice_key / s9_choice_key 重启对应分支（ensureMsgP 幂等，
      已发消息跳过，不重复）
   ================================================================ */
(function () {
  'use strict';

  function ready(fn) {
    if (window.StoryExtension && window.StoryExtension.CHOICES &&
        window.StoryExtension._playingLock && window.StoryExtension.addMemoClue &&
        PAGES.chat && PAGES.settings &&
        typeof state !== 'undefined' && typeof save === 'function' &&
        typeof flag === 'function' && typeof sleep === 'function' &&
        typeof render === 'function' && typeof refreshChat === 'function' &&
        typeof storyTime === 'function' && typeof uid === 'function' &&
        typeof esc === 'function' && typeof addTrust === 'function' &&
        typeof trustNote === 'function' && typeof navBar === 'function' &&
        typeof Toast !== 'undefined' && typeof Router !== 'undefined' &&
        typeof NotifService !== 'undefined' && typeof CursorGuide !== 'undefined') {
      fn();
      return;
    }
    setTimeout(function () { ready(fn); }, 100);
  }

  ready(function () {
    var EXT = window.StoryExtension;
    var CHOICES = EXT.CHOICES;
    var _playingLock = EXT._playingLock;

    /* ============================================================
       1. 幂等恢复论坛帖子 p5~p10
       ============================================================ */
    (function restoreForumPosts() {
      if (!state.db) state.db = {};
      if (!state.db.forum) state.db.forum = { boards: [], posts: [] };
      if (!Array.isArray(state.db.forum.posts)) state.db.forum.posts = [];

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

      var added = 0;
      MORE_POSTS.forEach(function (p) {
        if (!state.db.forum.posts.some(function (x) { return x.id === p.id; })) {
          state.db.forum.posts.push(p);
          added++;
        }
      });
      if (added > 0) {
        save();
        console.log('[story-speed] 恢复论坛帖子 ' + added + ' 条');
      }
    })();

    /* ============================================================
       2. 速度工具
       ============================================================ */
    if (!state.settings) state.settings = {};
    if (state.settings.msgSpeed === undefined) {
      state.settings.msgSpeed = 1.3;
      save();
    }
    function getSpeed() {
      var v = state.settings.msgSpeed;
      return (typeof v === 'number' && v > 0) ? v : 1.3;
    }
    function _dl(base) { return Math.round(base * getSpeed()); }

    async function ensureMsgP(cid, msg, baseDelay) {
      var chat = state.db.chats[cid];
      if (!chat) return;
      if (!Array.isArray(chat.messages)) chat.messages = [];
      var exists = chat.messages.some(function (m) {
        if (msg.type === 'system') return m.type === 'system' && m.text === msg.text;
        if (msg.type === 'card') return m.type === 'card' && m.title === msg.title && m.desc === msg.desc;
        return m.from === msg.from && m.text === msg.text;
      });
      if (exists) return;
      if (baseDelay && baseDelay > 0) await sleep(_dl(baseDelay));
      chat.messages.push(Object.assign({ id: uid('m'), time: storyTime() }, msg));
      save();
      refreshChat(cid);
    }

    /* ============================================================
       3. stage 迁移（旧存档 stage=3 修复）
       ============================================================ */
    (function migrateStage() {
      var lsStage = flag('ls_stage') || 0;
      if (lsStage === 3) {
        var chatLs = state.db.chats.ls;
        if (chatLs) {
          var hasWk = chatLs.messages.some(function (m) { return m.text === '诶wk，周学姐好像在群里发东西了'; });
          var hasA = chatLs.messages.some(function (m) { return m.text === '话说回来，你觉得有没有觉得寒潮封校这件事很奇怪'; });
          var hasB = chatLs.messages.some(function (m) { return m.text === '封楼期间欢迎你来412大吃特吃嗷'; });
          if (hasWk) {
            flag('ls_stage', 4);
          } else if (hasA) {
            flag('ls_choice_key', 'a');
            flag('ls_stage', 6);
          } else if (hasB) {
            flag('ls_choice_key', 'b');
            flag('ls_stage', 6);
          } else {
            flag('ls_stage', 2);
            state.choice = {
              chatId: 'ls', nodeId: 'ls_opening',
              options: [
                { k: 'a', label: '①你觉得寒潮这件事…' },
                { k: 'b', label: '②欢迎来我们寝室玩' }
              ]
            };
          }
          save();
        }
      }
      var s9Stage = flag('s9_stage') || 0;
      if (s9Stage === 3) {
        var chatBy = state.db.chats.by;
        if (chatBy) {
          var hasLink = chatBy.messages.some(function (m) { return m.text === '【问卷链接】'; });
          if (hasLink) {
            flag('s9_stage', 4);
          } else {
            flag('s9_stage', 6);
          }
          save();
        }
      }
    })();

    /* ============================================================
       4. triggerS9Group（新）
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
        byChat.messages.push({
          id: uid('m'), from: '周学姐', text: '@所有人 打扰大家一下', time: storyTime()
        });
        save();
      }

      NotifService.push({
        id: 'n_s9',
        title: '北苑留校女生群',
        detail: '周学姐：@所有人 打扰大家一下',
        target: { page: 'chat', params: { id: 'by' } }
      });

      // 玩家就在 by 页面 → 重新 render 触发原 handle 播放 s9 开场
      var cur = Router.current();
      if (cur.page === 'chat' && cur.params.id === 'by') {
        setTimeout(function () { render(); }, 200);
      }
    }

    /* ============================================================
       5. playLsPostChoiceSpeed（新，用 ensureMsgP）
       ============================================================ */
    async function playLsPostChoiceSpeed() {
      if (_playingLock['ls_post']) return;
      _playingLock['ls_post'] = true;
      flag('ls_stage', 7);
      save();
      try {
        await ensureMsgP('ls', { from: '临爽', text: '诶wk，周学姐好像在群里发东西了' }, 1500);
        await sleep(_dl(1000));
        flag('ls_stage', 4);
        save();
        triggerS9GroupSpeed();
      } finally {
        _playingLock['ls_post'] = false;
      }
    }

    /* ============================================================
       6. CHOICES.ls_opening（重写，统一速度）
       ============================================================ */
    CHOICES.ls_opening = {
      async a() {
        if (_playingLock['ls']) return;
        _playingLock['ls'] = true;
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
        } finally {
          _playingLock['ls'] = false;
        }
        await playLsPostChoiceSpeed();
      },
      async b() {
        if (_playingLock['ls']) return;
        _playingLock['ls'] = true;
        try {
          state.choice = null;
          flag('ls_choice_key', 'b');
          flag('ls_stage', 5);
          save();
          refreshChat('ls');

          await ensureMsgP('ls', { from: 'me', text: '封楼期间欢迎你来412大吃特吃嗷' }, 800);
          await ensureMsgP('ls', { from: 'me', text: 'VVIP贵宾一位里边儿请～' }, 1200);
          await ensureMsgP('ls', { from: '临爽', text: '这老板恐怕是邓许吧' }, 1500);
          await ensureMsgP('ls', { from: '临爽', text: '你只能算个服务员哈哈哈哈' }, 1500);
          await ensureMsgP('ls', { from: 'me', text: '我去你的！' }, 800);

          addTrust(['临爽'], 3);
          await ensureMsgP('ls', { type: 'system', text: trustNote(['临爽'], 3) }, 800);

          flag('ls_stage', 6);
          save();
        } finally {
          _playingLock['ls'] = false;
        }
        await playLsPostChoiceSpeed();
      }
    };

    /* ============================================================
       7. CHOICES.grp_s9（重写，统一速度）
       ============================================================ */
    CHOICES.grp_s9 = {
      async a() {
        if (_playingLock['by_s9_post']) return;
        _playingLock['by_s9_post'] = true;
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
          await ensureMsgP('by', { from: '张夏夏', text: '是这样的…封校那天我发现我联系不上你们任何一个人，直到看到论坛里有这个群的链接，我才好歹能和你们说上话！' }, 1700);
          await ensureMsgP('by', { from: '张夏夏', text: '我似乎是一出校就被识别为"校外人员"了……总之珍惜吧！' }, 1500);
          await ensureMsgP('by', { from: '苏青', text: '确实呢，我现在一想和校外的朋友联系就会弹出一个警告' }, 1500);
          await ensureMsgP('by', { from: '沈敏', text: '对，好像是什么"寒潮期间禁止与校外人员通讯"，弱智极了' }, 1500);
          await ensureMsgP('by', { from: 'me', text: '这不是把我们大家都囚禁在渠中了吗……切断一切外界联系' }, 900);
          await ensureMsgP('by', { from: '邓许', text: '寒潮真的至于这样吗？我不敢苟同' }, 1500);

          EXT.addMemoClue();
          await ensureMsgP('by', { type: 'system', text: '［"线索：校外人员？"已自动记录进备忘录］' }, 800);

          flag('s9_stage', 6);
          save();
        } finally {
          _playingLock['by_s9_post'] = false;
        }
        await playS9PostChoiceSpeed();
      },
      async b() {
        if (_playingLock['by_s9_post']) return;
        _playingLock['by_s9_post'] = true;
        try {
          state.choice = null;
          flag('s9_choice_key', 'b');
          flag('s9_stage', 5);
          save();
          refreshChat('by');

          await ensureMsgP('by', { from: 'me', text: '真羡慕你啊……' }, 800);
          await ensureMsgP('by', { from: 'me', text: '我是真受不了这个雷霆规则了！' }, 1200);
          await ensureMsgP('by', { from: '沈敏', text: '是啊，根本不是给人用的' }, 1500);
          await ensureMsgP('by', { from: '临爽', text: 'md真的太痛苦了，我们完全就是被囚禁圈养在渠中的牲畜啊！' }, 1600);
          await ensureMsgP('by', { from: '周学姐', text: '没有"们"。。。你自己是牲畜就够了。' }, 1500);
          await ensureMsgP('by', { from: '临爽', text: '？' }, 1200);
          await ensureMsgP('by', { from: '苏青', text: '太无聊了，姐姐我实在很想去7号楼找你们玩哦，奈何学校不让' }, 1600);
          await ensureMsgP('by', { from: '苏青', text: '我也很无奈～' }, 1500);
          await ensureMsgP('by', { from: '许双荞', text: '，，似乎你刚说了懒得出校门' }, 1500);
          await ensureMsgP('by', { from: '张夏夏', text: '哈哈哈我看到你们转发的规则了……哎不是感觉怎么看都怪怪的啊但是' }, 1600);

          addTrust(['沈敏', '临爽'], 1);
          await ensureMsgP('by', { type: 'system', text: trustNote(['沈敏', '临爽'], 1) }, 800);

          flag('s9_stage', 6);
          save();
        } finally {
          _playingLock['by_s9_post'] = false;
        }
        await playS9PostChoiceSpeed();
      }
    };

    /* ============================================================
       8. playS9PostChoiceSpeed（新，问卷链接 + 光标指引）
       ============================================================ */
    async function playS9PostChoiceSpeed() {
      if (_playingLock['by_s9_post']) return;
      _playingLock['by_s9_post'] = true;
      flag('s9_stage', 7);
      save();
      try {
        await ensureMsgP('by', { from: '周学姐', text: '嗯，别的不敢多说，这也是我来找大家的目的。' }, 1500);
        await ensureMsgP('by', { from: '周学姐', text: '北苑的同学们，麻烦大家配合一下，填写以下问卷，我会反馈这一切的蹊跷。' }, 1700);
        await ensureMsgP('by', { from: '临爽', text: '啊靠——都这时候了还要填excel，不要啊！！！（震声' }, 1500);
        await ensureMsgP('by', { from: '周学姐', text: '哈哈别急，除了excel还有你们最爱的ddl' }, 1500);
        await ensureMsgP('by', { from: '周学姐', text: '请大家在今晚前提交给我。' }, 1400);
        await ensureMsgP('by', { from: '张夏夏', text: '我、我也要交吗？' }, 1400);
        await ensureMsgP('by', { from: '周学姐', text: '。。你不用' }, 1200);

        await sleep(_dl(800));

        // 问卷链接（带跳转）
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

        await sleep(_dl(1000));
        var body = document.querySelector('#chat-body');
        if (body) body.scrollTop = body.scrollHeight;
        await sleep(_dl(500));
        CursorGuide.show('[data-action="jump"][data-page="questionnaire"]', '点击填写问卷');
      } finally {
        _playingLock['by_s9_post'] = false;
      }
    }

    /* ============================================================
       9. 中断恢复（包装 PAGES.chat）
       ============================================================ */
    function resumeLs(cid) {
      if (cid !== 'ls') return;
      if (!flag('ls_added')) return;
      if (_playingLock['ls'] || _playingLock['ls_post']) return;
      var stage = flag('ls_stage') || 0;
      if (stage === 5) {
        var key = flag('ls_choice_key') || 'a';
        if (CHOICES.ls_opening[key]) CHOICES.ls_opening[key]();
      } else if (stage === 6 || stage === 7) {
        playLsPostChoiceSpeed();
      }
    }

    function resumeBy(cid) {
      if (cid !== 'by') return;
      if (_playingLock['by_s9_post']) return;
      var stage = flag('s9_stage') || 0;
      if (stage === 5) {
        var key = flag('s9_choice_key') || 'a';
        if (CHOICES.grp_s9[key]) CHOICES.grp_s9[key]();
      } else if (stage === 6 || stage === 7) {
        playS9PostChoiceSpeed();
      }
    }

    var prevChat = PAGES.chat;
    PAGES.chat = function (params) {
      var def = prevChat(params);
      var prevMount = def.mount;
      def.mount = function (root) {
        if (prevMount) prevMount(root);
        try {
          resumeLs(params.id);
          resumeBy(params.id);
        } catch (e) { console.error('[story-speed] resume', e); }
      };
      return def;
    };

    /* ============================================================
       10. 设置页加"消息显示速度"
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
      { v: 1.1, label: '1.1x · 稍快' },
      { v: 1.3, label: '1.3x · 推荐' },
      { v: 1.5, label: '1.5x · 慢速' },
      { v: 1.8, label: '1.8x · 很慢' },
      { v: 2.0, label: '2.0x · 极慢' }
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
            '<div class="px4 txt-xs txt-3 center mt3">数值越大，消息出现越慢。选项分支后按此速度播放。</div>' +
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
       11. 暴露 API
       ============================================================ */
    window.StorySpeed = {
      getSpeed: getSpeed,
      adjust: _dl,
      ensureMsgP: ensureMsgP,
      playLsPostChoiceSpeed: playLsPostChoiceSpeed,
      playS9PostChoiceSpeed: playS9PostChoiceSpeed,
      triggerS9GroupSpeed: triggerS9GroupSpeed,
      SPEED_OPTIONS: SPEED_OPTIONS
    };

    console.log('[story-speed v2.0] 已加载，当前速度 ' + getSpeed() + 'x');
  });
})();
