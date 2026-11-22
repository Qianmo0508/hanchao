/* ================================================================
   story-extension.js  v2.2
   加载顺序：story-patch.js → story-extension.js → story-speed.js

   v2.2 修复：
   · 通过周学姐好友申请变成了通过临爽
   根因：story-patch.js 在 capture 阶段对 [data-action="fr-accept"]
        做了全局劫持，把所有 fr-accept 都当作临爽处理。
   修复：
   1. 重写 PAGES.friendRequests，把 fr_zxj 的 action 换成
      fr-accept-zxj / fr-ignore-zxj（专属，不会被 story-patch 劫持）
   2. 在 story-extension.js 里独立处理 fr-accept-zxj / fr-ignore-zxj
   3. 通过后正常备注"周学姐-北苑6号楼"、建会话、引导进 zx 私聊

   其余 v2.1 内容全部保留（含光标残留修复）
   ================================================================ */
(function () {
  'use strict';

  function ready(fn) {
    if (typeof PAGES !== 'undefined' &&
        typeof Router !== 'undefined' &&
        typeof CursorGuide !== 'undefined' &&
        typeof NotifService !== 'undefined' &&
        typeof themSay !== 'undefined' &&
        typeof meSay !== 'undefined' &&
        typeof pushMsg !== 'undefined' &&
        typeof refreshChat !== 'undefined' &&
        typeof CHOICES !== 'undefined' &&
        typeof state !== 'undefined' &&
        typeof save !== 'undefined' &&
        typeof flag !== 'undefined' &&
        typeof addTrust !== 'undefined' &&
        typeof trustNote !== 'undefined' &&
        typeof storyTime !== 'undefined' &&
        typeof uid !== 'undefined' &&
        typeof esc !== 'undefined' &&
        typeof navBar !== 'undefined' &&
        typeof Toast !== 'undefined' &&
        typeof ConfirmBox !== 'undefined' &&
        typeof sysNow !== 'undefined' &&
        typeof fmtFull !== 'undefined' &&
        typeof sleep !== 'undefined' &&
        typeof render !== 'undefined') {
      fn();
    } else {
      setTimeout(function () { ready(fn); }, 80);
    }
  }

  ready(function () {

    /* ============================================================
       0. 样式
       ============================================================ */
    var st = document.createElement('style');
    st.textContent =
      '.q-block{padding:var(--sp-4) 0;border-bottom:1px dashed var(--c-line)}' +
      '.q-block:last-child{border-bottom:none}' +
      '.q-title{font-size:14.5px;line-height:1.6;margin-bottom:var(--sp-3);font-weight:600;overflow-wrap:anywhere}' +
      '.q-title b{color:var(--c-accent);margin-right:4px}' +
      '.q-label{display:flex;align-items:flex-start;gap:8px;padding:8px 0;font-size:14px;line-height:1.5;cursor:pointer;min-width:0}' +
      '.q-label input[type=radio],.q-label input[type=checkbox]{margin-top:3px;flex:0 0 auto;accent-color:var(--c-accent);width:16px;height:16px}' +
      '.q-label span{overflow-wrap:anywhere;min-width:0}' +
      '.q-other-input{flex:1 1 auto;min-width:0;background:var(--c-card-2);border:1px solid var(--c-line);border-radius:6px;padding:4px 8px;font-size:13px;color:var(--c-text);margin-left:4px}' +
      '.q-text,.q-textarea{width:100%;background:var(--c-card-2);border:1px solid var(--c-line);border-radius:8px;padding:10px 12px;font-size:14px;color:var(--c-text);outline:none;min-width:0}' +
      '.q-textarea{min-height:90px;resize:vertical;line-height:1.6}' +
      '.sec-title-q{font-size:13px;font-weight:700;color:var(--c-text-2);padding:var(--sp-4) 0 var(--sp-2);letter-spacing:.04em;border-top:1px solid var(--c-line);margin-top:var(--sp-3)}' +
      '.sec-title-q:first-of-type{border-top:none;margin-top:0;padding-top:0}' +
      '.q-red{color:var(--c-danger)}' +
      '.q-strike{color:var(--c-danger);text-decoration:line-through}' +
      '@keyframes wxg-blink{0%,100%{opacity:1}50%{opacity:.2}}' +
      '.join-group-btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 24px;border-radius:12px;background:var(--c-accent);color:#fff;border:none;font-size:var(--fs-m);font-weight:600;cursor:pointer;margin-top:8px}';
    document.head.appendChild(st);

    /* ============================================================
       1. 状态兜底
       ============================================================ */
    function extEnsure() {
      if (!state.flags) state.flags = {};
      if (!state.db) state.db = {};
      if (!state.db.memos) state.db.memos = [];
      if (!state.db.chats) state.db.chats = {};
      if (!state.db.friendRequests) state.db.friendRequests = [];
      if (!state.db.forum) state.db.forum = { boards: [], posts: [] };
      if (!Array.isArray(state.db.forum.posts)) state.db.forum.posts = [];
      if (!Array.isArray(state.db.forum.boards)) state.db.forum.boards = [];
      if (!state.questionnaireAnswers) state.questionnaireAnswers = {};
    }
    extEnsure();

    /* ============================================================
       2. 互助板块 + p_help 帖子
       ============================================================ */
    (function ensureHelpBoard() {
      if (!state.db.forum.boards.some(function (b) { return b.id === 'help'; })) {
        state.db.forum.boards.push({ id: 'help', name: '互助板块', hot: true });
      }
      var pHelp = {
        id: 'p_help', board: 'help', author: '肇事逃逸',
        title: '3号楼停电了！封校后东苑3号楼还有人吗。。',
        time: '2025-05-08 19:42', hot: true, pinned: false, locked: false,
        content: 'md我算是彻底受不了了啊啊，东苑男生宿舍这边全都不留校回家耍起了！但是3号楼现在停电了啊……楼里冷冷清清的，有没有3号楼的哥们儿会修电源或者有维修师傅电话的啊。。救！',
        floors: [
          { n: 2, user: '听说你在等周末', text: 'lz是3号楼几层的？我在五层512' },
          { n: 3, user: '肇事逃逸（楼主）', quote: '听说你在等周末', text: '二层！！！208！哥们你谁咱俩加个好友拉个群吧' },
          { n: 4, user: '哪有博弈只有我是啥博弈', text: '……lz和2L就这样直接把自己的寝室号全部透露出来了啊！！！！' },
          { n: 5, user: '我也要鼠吗', text: '还是要注意安全吧。。' },
          { n: 6, user: '我也要鼠吗', text: '但我记得现在很难联系上校外人员了，维修师傅什么的还是别想了吧' },
          { n: 7, user: '肇事逃逸（楼主）', quote: '我也要鼠吗', text: '别这么说别这么说哥们' },
          { n: 8, user: '荞麦面', text: '我倒是会修，可我不是东苑的，现在的时段貌似也不能出宿舍楼' },
          { n: 9, user: '肇事逃逸（楼主）', quote: '荞麦面', text: '这样的8楼我加您' },
          { n: 10, user: '听说你在等周末', quote: '荞麦面', text: '这样的8楼我加您' },
          { n: 10, user: '好想刻薄地活一次', text: '我觉得资源互通真的很重要，现在大家只能通过论坛联系未免太不方便了吧' },
          { n: 11, user: '肇事逃逸（楼主）', text: '这样，哥们儿干脆开一个互助群吧，就别分这个寝那个寝这栋楼那栋楼的了，能看到的想进的就进' },
          { n: 12, user: '肇事逃逸（楼主）', text: '【群聊邀请链接】"互助群"',
            action: { type: 'join-group', groupId: 'huzhu', label: '加入' } }
        ]
      };
      if (!state.db.forum.posts.some(function (p) { return p.id === 'p_help'; })) {
        state.db.forum.posts.push(pHelp);
        save();
      }
    })();

    /* ============================================================
       3. 幂等消息工具 + 播放锁
       ============================================================ */
    var _playingLock = {};

    async function ensureMsg(cid, msg, delay) {
      var chat = state.db.chats[cid];
      if (!chat) return;
      if (!Array.isArray(chat.messages)) chat.messages = [];
      var exists = chat.messages.some(function (m) {
        if (msg.type === 'system') return m.type === 'system' && m.text === msg.text;
        if (msg.type === 'card') return m.type === 'card' && m.title === msg.title && m.desc === msg.desc;
        return m.from === msg.from && m.text === msg.text;
      });
      if (exists) return;
      if (delay) await sleep(delay);
      var m = Object.assign({ id: uid('m'), time: storyTime() }, msg);
      chat.messages.push(m);
      save();
      refreshChat(cid);
    }

    async function ensureMsgP(cid, msg, baseDelay) {
      if (window.StorySpeed && typeof window.StorySpeed.ensureMsgP === 'function') {
        return window.StorySpeed.ensureMsgP(cid, msg, baseDelay);
      }
      return ensureMsg(cid, msg, baseDelay);
    }
    function _dl(base) {
      if (window.StorySpeed && typeof window.StorySpeed.adjust === 'function') {
        return window.StorySpeed.adjust(base);
      }
      return Math.round(base * 1.3);
    }

    /* ============================================================
       4. 包装 PAGES.chat
       ============================================================ */
    var prevChat = PAGES.chat;
    PAGES.chat = function (params) {
      var def = prevChat(params);
      var prevMount = def.mount;
      def.mount = function (root) {
        if (prevMount) prevMount(root);
        try { onOpenChatPatchExt(params.id); }
        catch (e) { console.error('[ext] onOpenChatPatchExt', e); }
      };
      return def;
    };

    /* ============================================================
       5. 剧情调度
       ============================================================ */
    function onOpenChatPatchExt(cid) {
      extEnsure();
      if (cid === 'ls') return handleLsChat();
      if (cid === 'by') return handleByChatExt();
      if (cid === 'zx') return handleZxChat();
      if (cid === 'huzhu') return handleHuzhu();
    }

    /* ============================================================
       6. 临爽私聊
       ============================================================ */
    function handleLsChat() {
      if (!flag('ls_added')) return;
      if (_playingLock['ls'] || _playingLock['ls_post']) return;
      var stage = flag('ls_stage') || 0;

      if (stage === 0 || stage === 1) { playLinShuangOpening(); return; }
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
      if (stage === 3 || stage === 5) {
        var key = flag('ls_choice_key') || 'a';
        if (CHOICES.ls_opening && CHOICES.ls_opening[key]) CHOICES.ls_opening[key]();
        return;
      }
      if (stage === 6 || stage === 7) { playLsPostChoice(); return; }
    }

    async function playLinShuangOpening() {
      if (_playingLock['ls']) return;
      _playingLock['ls'] = true;
      flag('ls_stage', 1);
      save();
      try {
        var cid = 'ls';
        await ensureMsg(cid, { type: 'system', text: '你已通过对方的好友申请' }, 600);
        await ensureMsg(cid, { from: '临爽', text: '特殊期间嘛，有什么事咱俩可以互相照应一下桀桀桀' }, 1400);
        await ensureMsg(cid, { from: '临爽', text: '毕竟你就在我对门' }, 1600);
        await ensureMsg(cid, { from: '临爽', text: '哦对了，真是靠了我得先把你的备注从王晓歌改到陈默…' }, 1800);
        await sleep(900);
        flag('ls_stage', 2);
        state.choice = { chatId: cid, nodeId: 'ls_opening', options: [
          { k: 'a', label: '①你觉得寒潮这件事…' },
          { k: 'b', label: '②欢迎来我们寝室玩' }
        ]};
        save();
        refreshChat(cid);
      } finally { _playingLock['ls'] = false; }
    }

    CHOICES.ls_opening = {
      async a() {
        var cid = 'ls';
        state.choice = null;
        flag('ls_stage', 3);
        save();
        try {
          await ensureMsg(cid, { from: 'me', text: '话说回来，你觉得有没有觉得寒潮封校这件事很奇怪' }, 600);
          await ensureMsg(cid, { from: '临爽', text: '是吗？小破中老整这种莫名其妙的东西，明明也没有很冷啊' }, 1600);
          await playLsPostChoice();
        } catch (e) { console.error(e); }
      },
      async b() {
        var cid = 'ls';
        state.choice = null;
        flag('ls_stage', 3);
        save();
        try {
          await ensureMsg(cid, { from: 'me', text: '封楼期间欢迎你来412大吃特吃嗷' }, 600);
          await ensureMsg(cid, { from: 'me', text: 'VVIP贵宾一位里边儿请～' }, 900);
          await ensureMsg(cid, { from: '临爽', text: '这老板恐怕是邓许吧' }, 1400);
          await ensureMsg(cid, { from: '临爽', text: '你只能算个服务员哈哈哈哈' }, 1500);
          await ensureMsg(cid, { from: 'me', text: '我去你的！' }, 900);
          addTrust(['临爽'], 3);
          await ensureMsg(cid, { type: 'system', text: trustNote(['临爽'], 3) }, 500);
          await sleep(500);
          await playLsPostChoice();
        } catch (e) { console.error(e); }
      }
    };

    async function playLsPostChoice() {
      if (_playingLock['ls_post']) return;
      _playingLock['ls_post'] = true;
      try {
        var cid = 'ls';
        await ensureMsg(cid, { from: '临爽', text: '诶wk，周学姐好像在群里发东西了' }, 1800);
        await sleep(1000);
        flag('ls_stage', 4);
        save();
        triggerS9Group();
      } finally { _playingLock['ls_post'] = false; }
    }

    /* ============================================================
       7. 北苑群（s9 + s10）
       ============================================================ */
    function handleByChatExt() {
      if (_playingLock['by_s9'] || _playingLock['by_s9_post'] ||
          _playingLock['by_s10'] || _playingLock['by_s10_post'] || _playingLock['by_s10_final']) return;

      if (flag('s10_pending') && flag('s10_notified')) {
        handleS10InByChat();
        return;
      }

      if (!flag('s9_pending')) return;

      var stage = flag('s9_stage') || 0;
      if (stage === 0 || stage === 1) { playS9Group(); return; }
      if (stage === 2) {
        if (!(state.choice && state.choice.chatId === 'by')) {
          state.choice = { chatId: 'by', nodeId: 'grp_s9', options: [
            { k: 'a', label: '①你不留校怎么还进留校群' },
            { k: 'b', label: '②羡慕你，受不了这个规则了' }
          ]};
          save();
          render();
        }
        return;
      }
      if (stage === 3) { playS9PostChoice(); return; }
      if (stage === 4) {
        if (!flag('s9_questionnaire_done')) {
          setTimeout(function () {
            if (flag('s9_questionnaire_done')) return;
            CursorGuide.show('[data-action="jump"][data-page="questionnaire"]', '点击填写问卷');
          }, 500);
        }
      }
    }

    async function playS9Group() {
      if (_playingLock['by_s9']) return;
      _playingLock['by_s9'] = true;
      flag('s9_stage', 1);
      save();
      try {
        var cid = 'by';
        await ensureMsg(cid, { from: '周学姐', text: '你们对这次"寒潮预警"有什么想法么……？' }, 1400);
        await ensureMsg(cid, { from: '许双荞', text: '怪怪的，现在才五月份啊' }, 1600);
        await ensureMsg(cid, { from: '临爽', text: '？我靠你不说我都忘了，现在是5月啊！！哪门子的寒潮我问你' }, 1600);
        await ensureMsg(cid, { from: '苏青', text: '五月飞雪，好一出窦娥冤～' }, 1600);
        await ensureMsg(cid, { from: '张夏夏', text: '我早就感觉奇怪了，还好提前撤离了……还是在家舒服啊！' }, 1600);
        await sleep(900);
        flag('s9_stage', 2);
        state.choice = { chatId: cid, nodeId: 'grp_s9', options: [
          { k: 'a', label: '①你不留校怎么还进留校群' },
          { k: 'b', label: '②羡慕你，受不了这个规则了' }
        ]};
        save();
        refreshChat(cid);
      } finally { _playingLock['by_s9'] = false; }
    }

    function triggerS9Group() {
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

    CHOICES.grp_s9 = {
      async a() {
        var cid = 'by';
        state.choice = null;
        flag('s9_stage', 3);
        save();
        try {
          await ensureMsg(cid, { from: 'me', text: '这个张夏夏，都不留校怎么还在留校群里苟着啊！' }, 600);
          await ensureMsg(cid, { from: '张夏夏', text: '一线吃瓜～' }, 1400);
          await ensureMsg(cid, { from: '周学姐', text: '我拉的，因为貌似她只能通过这个群和我们联系。' }, 1600);
          await ensureMsg(cid, { from: '临爽', text: '挖什么金矿' }, 1400);
          await ensureMsg(cid, { from: '张夏夏', text: '是这样的…封校那天我发现我联系不上你们任何一个人，直到看到论坛里有这个群的链接，我才好歹能和你们说上话！' }, 1800);
          await ensureMsg(cid, { from: '张夏夏', text: '我似乎是一出校就被识别为"校外人员"了……总之珍惜吧！' }, 1600);
          await ensureMsg(cid, { from: '苏青', text: '确实呢，我现在一想和校外的朋友联系就会弹出一个警告' }, 1600);
          await ensureMsg(cid, { from: '沈敏', text: '对，好像是什么"寒潮期间禁止与校外人员通讯"，弱智极了' }, 1600);
          await ensureMsg(cid, { from: 'me', text: '这不是把我们大家都囚禁在渠中了吗……切断一切外界联系' }, 800);
          await ensureMsg(cid, { from: '邓许', text: '寒潮真的至于这样吗？我不敢苟同' }, 1600);
          addMemoClue();
          await ensureMsg(cid, { type: 'system', text: '［"线索：校外人员？"已自动记录进备忘录］' }, 600);
          await sleep(700);
          await playS9PostChoice();
        } catch (e) { console.error(e); }
      },
      async b() {
        var cid = 'by';
        state.choice = null;
        flag('s9_stage', 3);
        save();
        try {
          await ensureMsg(cid, { from: 'me', text: '真羡慕你啊……' }, 600);
          await ensureMsg(cid, { from: 'me', text: '我是真受不了这个雷霆规则了！' }, 900);
          await ensureMsg(cid, { from: '沈敏', text: '是啊，根本不是给人用的' }, 1400);
          await ensureMsg(cid, { from: '临爽', text: 'md真的太痛苦了，我们完全就是被囚禁圈养在渠中的牲畜啊！' }, 1600);
          await ensureMsg(cid, { from: '周学姐', text: '没有"们"。。。你自己是牲畜就够了。' }, 1600);
          await ensureMsg(cid, { from: '临爽', text: '？' }, 1200);
          await ensureMsg(cid, { from: '苏青', text: '太无聊了，姐姐我实在很想去7号楼找你们玩哦，奈何学校不让' }, 1600);
          await ensureMsg(cid, { from: '苏青', text: '我也很无奈～' }, 1400);
          await ensureMsg(cid, { from: '许双荞', text: '，，似乎你刚说了懒得出校门' }, 1600);
          await ensureMsg(cid, { from: '张夏夏', text: '哈哈哈我看到你们转发的规则了……哎不是感觉怎么看都怪怪的啊但是' }, 1600);
          addTrust(['沈敏', '临爽'], 1);
          await ensureMsg(cid, { type: 'system', text: trustNote(['沈敏', '临爽'], 1) }, 600);
          await sleep(700);
          await playS9PostChoice();
        } catch (e) { console.error(e); }
      }
    };

    async function playS9PostChoice() {
      if (_playingLock['by_s9_post']) return;
      _playingLock['by_s9_post'] = true;
      try {
        var cid = 'by';
        await ensureMsg(cid, { from: '周学姐', text: '嗯，别的不敢多说，这也是我来找大家的目的。' }, 1600);
        await ensureMsg(cid, { from: '周学姐', text: '北苑的同学们，麻烦大家配合一下，填写以下问卷，我会反馈这一切的蹊跷。' }, 1800);
        await ensureMsg(cid, { from: '临爽', text: '啊靠——都这时候了还要填excel，不要啊！！！（震声' }, 1600);
        await ensureMsg(cid, { from: '周学姐', text: '哈哈别急，除了excel还有你们最爱的ddl' }, 1600);
        await ensureMsg(cid, { from: '周学姐', text: '请大家在今晚前提交给我。' }, 1400);
        await ensureMsg(cid, { from: '张夏夏', text: '我、我也要交吗？' }, 1400);
        await ensureMsg(cid, { from: '周学姐', text: '。。你不用' }, 1200);
        await sleep(800);
        var hasLink = state.db.chats.by.messages.some(function (m) {
          return m.from === '周学姐' && m.text === '【问卷链接】';
        });
        if (!hasLink) {
          state.db.chats.by.messages.push({
            id: uid('m'), from: '周学姐', text: '【问卷链接】', time: storyTime(),
            link: { text: '【问卷链接】', page: 'questionnaire', params: {} }
          });
          save();
          refreshChat(cid);
        }
        await ensureMsg(cid, { from: '许双荞', text: '周学姐，这个问卷的提交处好像不是你啊' }, 1600);
        await ensureMsg(cid, { from: '邓许', text: '好像，还真是……' }, 1600);
        flag('s9_stage', 4);
        save();
        await sleep(1200);
        var body = document.querySelector('#chat-body');
        if (body) body.scrollTop = body.scrollHeight;
        await sleep(500);
        if (!flag('s9_questionnaire_done')) {
          CursorGuide.show('[data-action="jump"][data-page="questionnaire"]', '点击填写问卷');
        }
      } finally { _playingLock['by_s9_post'] = false; }
    }

    /* ============================================================
       8. s10 群聊
       ============================================================ */
    function handleS10InByChat() {
      if (_playingLock['by_s10'] || _playingLock['by_s10_post'] || _playingLock['by_s10_final']) return;
      var stage = flag('s10_stage') || 0;
      if (stage === 0 || stage === 1) { playS10Group(); return; }
      if (stage === 2) {
        if (!(state.choice && state.choice.chatId === 'by')) {
          state.choice = { chatId: 'by', nodeId: 'grp_s10', options: [
            { k: 'a', label: '①我也发现了' },
            { k: 'b', label: '②没有吧是你太敏感了' }
          ]};
          save();
          render();
        }
        return;
      }
      if (stage === 3 || stage === 4) { playS10PostChoice(); return; }
    }

    function triggerS10() {
      if (flag('s10_notified')) return;
      flag('s10_notified', true);
      flag('s10_pending', true);
      flag('s10_stage', 0);
      var byChat = state.db.chats.by;
      if (byChat && !byChat.messages.some(function (m) {
        return m.from === '沈敏' && m.text === '我填完问卷了…';
      })) {
        byChat.messages.push({ id: uid('m'), from: '沈敏', text: '我填完问卷了…', time: storyTime() });
        save();
      }
      NotifService.push({
        id: 'n_s10',
        title: '北苑留校女生群',
        detail: '沈敏：我填完问卷了…',
        target: { page: 'chat', params: { id: 'by' } }
      });
    }

    async function playS10Group() {
      if (_playingLock['by_s10']) return;
      _playingLock['by_s10'] = true;
      flag('s10_stage', 1);
      save();
      try {
        var cid = 'by';
        await ensureMsgP(cid, { from: '许双荞', text: '+1' }, 1500);
        await ensureMsgP(cid, { from: '临爽', text: '+1' }, 1500);
        await ensureMsgP(cid, { from: '沈敏', text: '可是，怎么，第16题怪怪的啊？' }, 1500);
        await ensureMsgP(cid, { from: '沈敏', text: '是有bug吗…' }, 1500);
        await ensureMsgP(cid, { from: '沈敏', text: '@周学姐' }, 1200);
        await sleep(_dl(800));
        flag('s10_stage', 2);
        state.choice = { chatId: cid, nodeId: 'grp_s10', options: [
          { k: 'a', label: '①我也发现了' },
          { k: 'b', label: '②没有吧是你太敏感了' }
        ]};
        save();
        refreshChat(cid);
      } finally { _playingLock['by_s10'] = false; }
    }

    CHOICES.grp_s10 = {
      async a() {
        if (_playingLock['by_s10_post']) return;
        _playingLock['by_s10_post'] = true;
        try {
          var cid = 'by';
          state.choice = null;
          flag('s10_choice_key', 'a');
          flag('s10_stage', 3);
          save();
          refreshChat(cid);
          await ensureMsgP(cid, { from: 'me', text: '我填的时候也发现了…' }, 800);
          await ensureMsgP(cid, { from: 'me', text: '总是出现莫名其妙的红字，还有。。"修改规则"是什么？' }, 900);
          await ensureMsgP(cid, { from: 'me', text: '@周学姐' }, 800);
          await ensureMsgP(cid, { from: '张夏夏', text: '为什么我点进这个问卷是一团乱码啊？' }, 1500);
          await ensureMsgP(cid, { from: '沈敏', text: '啊啊啊你们别吓我了！！！' }, 1500);
          await ensureMsgP(cid, { from: '许双荞', text: '啊，可是在我这一点异常都没有出现啊？' }, 1500);
          await ensureMsgP(cid, { from: 'me', text: '不可能，第16题真的很不对劲！' }, 800);
          addTrust(['邓许', '沈敏'], 3);
          await ensureMsgP(cid, { type: 'system', text: trustNote(['邓许', '沈敏'], 3) }, 800);
          flag('s10_stage', 4);
          save();
        } finally { _playingLock['by_s10_post'] = false; }
        await playS10PostChoice();
      },
      async b() {
        if (_playingLock['by_s10_post']) return;
        _playingLock['by_s10_post'] = true;
        try {
          var cid = 'by';
          state.choice = null;
          flag('s10_choice_key', 'b');
          flag('s10_stage', 3);
          save();
          refreshChat(cid);
          await ensureMsgP(cid, { from: 'me', text: '没有吧，是你太敏感了' }, 800);
          await ensureMsgP(cid, { from: '苏青', text: '没有吧，是你太性感了' }, 1500);
          await ensureMsgP(cid, { from: 'me', text: '哎呀苏姐别玩梗了。。' }, 800);
          await ensureMsgP(cid, { from: 'me', text: '总之这就是一个正常的问卷而已嘛！' }, 800);
          await ensureMsgP(cid, { from: '许双荞', text: '确实，我没察觉出来任何异常' }, 1500);
          await ensureMsgP(cid, { from: '许双荞', text: '你们别担心了，担心的上我宿舍一人领摞寒假作业回去写着玩玩' }, 1500);
          await ensureMsgP(cid, { from: '苏青', text: '……那倒也大可不必了' }, 1500);
          await ensureMsgP(cid, { from: 'me', text: '姐，我们那高二的你也做不了啊……' }, 800);
          await ensureMsgP(cid, { from: '临爽', text: '什么玩意作业别搞我！' }, 1500);
          await ensureMsgP(cid, { from: '沈敏', text: '可、可是明明就是……' }, 1500);
          await ensureMsgP(cid, { from: '沈敏', text: '第16题！好像用红字闪出了一个什么，修改规则？！' }, 1500);
          addTrust(['苏青', '许双荞'], 3);
          await ensureMsgP(cid, { type: 'system', text: trustNote(['苏青', '许双荞'], 3) }, 800);
          flag('s10_stage', 4);
          save();
        } finally { _playingLock['by_s10_post'] = false; }
        await playS10PostChoice();
      }
    };

    async function playS10PostChoice() {
      if (_playingLock['by_s10_final']) return;
      _playingLock['by_s10_final'] = true;
      try {
        var cid = 'by';
        await ensureMsgP(cid, { from: '周学姐', text: '？' }, 1200);
        await ensureMsgP(cid, { from: '周学姐', text: '你们疯了？' }, 1500);
        await ensureMsgP(cid, { from: '沈敏', text: '你疯了才对吧！' }, 1500);
        await ensureMsgP(cid, { from: '周学姐', text: '我他妈根本没写第16题！' }, 1800);
        await ensureMsgP(cid, { from: '临爽', text: '……？' }, 1200);
        await ensureMsgP(cid, { from: '沈敏', text: '等等……你确定？？' }, 1500);
        await ensureMsgP(cid, { from: '周学姐', text: '我以我校园卡里的两千块钱和我论坛版主的名号担保，这个问卷根本，没有第16题。' }, 2000);
        await ensureMsgP(cid, { from: '苏青', text: '事情太奇怪了……难道你们两个中至少有一个说了谎？' }, 1500);
        await ensureMsgP(cid, { from: 'me', text: '可我都挺了解她们的，不像是会说谎的人……' }, 800);
        await ensureMsgP(cid, { from: '邓许', text: '这问卷很蹊跷，如果周学姐的话和沈敏的话都属实，事情像是有什么东西篡改了学姐的问卷。' }, 1800);
        await ensureMsgP(cid, { from: '临爽', text: '别这么说😭✋🤚✋🤚你成功吓到我了' }, 1500);
        await ensureMsgP(cid, { from: '临爽', text: '怎么办，我刚看到消息……到底要不要去填啊' }, 1500);
        await ensureMsgP(cid, { from: '周学姐', text: '…' }, 1200);
        await ensureMsgP(cid, { from: '周学姐', text: '@所有人 大家停一下，我没发过什么问卷调查，所有人当作没看到，不要继续填写了。' }, 1800);
        await ensureMsgP(cid, { from: '许双荞', text: '收到' }, 1200);
        await ensureMsgP(cid, { from: '周学姐', text: '……你就已经填过了吧。' }, 1500);
        await ensureMsgP(cid, { from: '苏青', text: '纯表忠心么？有点意思' }, 1500);
        flag('s10_stage', 5);
        save();
        await sleep(_dl(1200));
        triggerZxjFriendRequest();
      } finally { _playingLock['by_s10_final'] = false; }
    }

    /* ============================================================
       9. 周学姐好友申请 + 私聊
       ============================================================ */
    function triggerZxjFriendRequest() {
      if (flag('zxj_fr_sent')) return;
      flag('zxj_fr_sent', true);
      if (!state.db.friendRequests.some(function (f) {
        return f.from === '周学姐' && f.status === 'pending';
      })) {
        state.db.friendRequests.push({
          id: 'fr_zxj', from: '周学姐', avatar: '🎓',
          text: '有事和你私信。', time: storyTime(), status: 'pending'
        });
        save();
      }
      NotifService.push({
        id: 'n_zxj_fr',
        title: '周学姐向你发出好友申请',
        detail: '周学姐：有事和你私信。',
        target: { page: 'friendRequests', params: {} }
      });
    }

    function handleZxChat() {
      if (!flag('zxj_added')) return;
      if (_playingLock['zx']) return;
      var stage = flag('zx_stage') || 0;
      if (stage === 0) { playZxOpening(); }
    }

    async function playZxOpening() {
      if (_playingLock['zx']) return;
      _playingLock['zx'] = true;
      flag('zx_stage', 1);
      save();
      try {
        var cid = 'zx';
        await ensureMsgP(cid, { type: 'system', text: '你已通过对方的好友申请' }, 800);
        await ensureMsgP(cid, { from: 'me', text: '怎么了？' }, 1200);
        await ensureMsgP(cid, { from: '周学姐', text: '这一切都有问题，就在刚刚我发现，似乎以任何形式的网络传播内容，都可以被篡改。' }, 1800);
        await ensureMsgP(cid, { from: '周学姐', text: '我现在算是知道校方究竟为什么要把我们困在内网了……' }, 1800);
        await ensureMsgP(cid, { from: 'me', text: '可以具体说说怎么回事吗？' }, 1200);
        await ensureMsgP(cid, { from: '周学姐', text: '。。算了，不该知道的少知道一些。' }, 1800);
        await ensureMsgP(cid, { from: '周学姐', text: '我这边收到论坛消息，有人倒是在开互助群，去论坛看看吧，换换心情。' }, 1800);
        flag('zx_stage', 2);
        save();
        await sleep(_dl(1200));
        Router.root('home');
        setTimeout(function () {
          CursorGuide.show('[data-app="forum"]', '去看看渠中校园论坛');
        }, 800);
      } finally { _playingLock['zx'] = false; }
    }

    /* ============================================================
       10. 互助群
       ============================================================ */
    function handleHuzhu() {
      if (!flag('huzhu_joined')) return;
      if (_playingLock['huzhu']) return;
      var stage = flag('huzhu_stage') || 0;
      if (stage === 0) { playHuzhuOpening(); return; }
      if (stage === 2) {
        if (!(state.choice && state.choice.chatId === 'huzhu')) {
          state.choice = { chatId: 'huzhu', nodeId: 'huzhu_1', options: [
            { k: 'a', label: '①我是她室友陈默' }
          ]};
          save();
          render();
        }
        return;
      }
      if (stage === 4) {
        if (!(state.choice && state.choice.chatId === 'huzhu')) {
          state.choice = { chatId: 'huzhu', nodeId: 'huzhu_2', options: [
            { k: 'a', label: '①我好像知道她是谁' }
          ]};
          save();
          render();
        }
        return;
      }
    }

    async function playHuzhuOpening() {
      if (_playingLock['huzhu']) return;
      _playingLock['huzhu'] = true;
      flag('huzhu_stage', 1);
      save();
      try {
        var cid = 'huzhu';
        await ensureMsgP(cid, { from: '钱逸时', text: '热烈欢迎！哎总算有人来了' }, 1500);
        await ensureMsgP(cid, { from: '钱逸时', text: '等等？' }, 1200);
        await ensureMsgP(cid, { from: '钱逸时', text: '我↘靠↘ 你是那个王晓歌？' }, 1500);
        await ensureMsgP(cid, { from: '钱逸时', text: 'md我靠。' }, 1200);
        await sleep(_dl(800));
        flag('huzhu_stage', 2);
        state.choice = { chatId: cid, nodeId: 'huzhu_1', options: [
          { k: 'a', label: '①我是她室友陈默' }
        ]};
        save();
        render();
      } finally { _playingLock['huzhu'] = false; }
    }

    CHOICES.huzhu_1 = {
      async a() {
        if (_playingLock['huzhu']) return;
        _playingLock['huzhu'] = true;
        try {
          var cid = 'huzhu';
          state.choice = null;
          flag('huzhu_stage', 3);
          save();
          refreshChat(cid);
          await ensureMsgP(cid, { from: 'me', text: '……看来我真该改个名了' }, 800);
          await ensureMsgP(cid, { from: 'me', text: '我是她室友陈默，也是412的，说来话长我就长话短说了' }, 900);
          await ensureMsgP(cid, { from: 'me', text: '我借用了她的手机，就这样' }, 800);
          await ensureMsgP(cid, { from: '钱逸时', text: '啊、啊噢哦哦哦……' }, 1500);
          await ensureMsgP(cid, { from: '钱逸时', text: '骚瑞骚瑞，那你也是女寝的吧，同学你好' }, 1500);
          await ensureMsgP(cid, { from: '钱逸时', text: '只可惜论坛里那位会修东西的荞麦面老师还没进……' }, 1500);
          flag('huzhu_stage', 4);
          save();
        } finally { _playingLock['huzhu'] = false; }
        await sleep(_dl(500));
        state.choice = { chatId: 'huzhu', nodeId: 'huzhu_2', options: [
          { k: 'a', label: '①我好像知道她是谁' }
        ]};
        save();
        render();
      }
    };

    CHOICES.huzhu_2 = {
      async a() {
        if (_playingLock['huzhu']) return;
        _playingLock['huzhu'] = true;
        try {
          var cid = 'huzhu';
          state.choice = null;
          flag('huzhu_stage', 5);
          save();
          refreshChat(cid);
          await ensureMsgP(cid, { from: 'me', text: '这个名字，我好像知道她是谁了' }, 800);
          await ensureMsgP(cid, { from: '周未', text: '我好像，也知道她是谁了' }, 1500);
          await ensureMsgP(cid, { from: '钱逸时', text: '？？' }, 1200);
          await ensureMsgP(cid, { from: '钱逸时', text: '这不合理啊兄弟，你潜水潜了这么久怎么突然出来了' }, 1500);
          flag('huzhu_stage', 6);
          save();
        } finally { _playingLock['huzhu'] = false; }
      }
    };

    /* ============================================================
       11. 备忘录线索
       ============================================================ */
    function addMemoClue() {
      extEnsure();
      var title = '线索：校外人员？';
      if (state.db.memos.some(function (m) { return m.title === title; })) return;
      state.db.memos.push({
        id: uid('memo'),
        title: title, type: 'auto', time: fmtFull(sysNow()),
        content: '封校后，"校外人员"似乎被隔离了——张夏夏一出校就被系统识别为校外人员，无法与校内联系。\n苏青：一想和校外的朋友联系就会弹出警告"寒潮期间禁止与校外人员通讯"。\n\n这意味着，可能不止寒潮——学校在切断我们与外界的一切联系。'
      });
      save();
    }

    function addMemoQuestionnaireClue() {
      extEnsure();
      var title = '线索：奇怪的问卷？';
      if (state.db.memos.some(function (m) { return m.title === title; })) return;
      state.db.memos.push({
        id: uid('memo'),
        title: title, type: 'auto', time: fmtFull(sysNow()),
        content: '问卷提交时弹出黑屏红字警告："本问卷没有第16题。请您重新作答。"\n重置后的第16题变成了"你觉得问卷发布人真的是周学姐吗？"。\n\n周学姐在群里说："我他妈根本没写第16题！"\n而沈敏却说她看到第16题有红字"修改规则"。\n\n如果两个人说的都是真的……那是谁篡改了问卷？'
      });
      save();
    }

    /* ============================================================
       12. 问卷数据
       ============================================================ */
    var Q_DATA = {
      title: '渠京第一中学寒潮预警与宿舍管理规定调查问卷',
      author: '周学姐',
      sections: [
        {
          title: '第一部分：关于寒潮预警',
          questions: [
            { n: 1, type: 'single-other',
              text: '你是通过什么渠道得知 5 月 8 日寒潮预警的？',
              options: ['班级群通知', '宿舍广播', '同学转告', '公告栏'] },
            { n: 2, type: 'single',
              text: '你对这次寒潮预警的发布方式感受如何？',
              options: ['正常，没什么特别', '有点突然，但可以接受', '很奇怪，发布时机和措辞都不太对劲', '完全不合理'] },
            { n: 3, type: 'single',
              text: '你觉得 5 月出现寒潮预警本身正常吗？',
              options: ['正常，天气无常', '不太正常，5 月不该这么冷', '极度反常'] },
            { n: 4, type: 'single',
              text: '寒潮预警发布后，你有没有听到过宿舍楼外传来什么声音？',
              options: ['没有', '风声', '有人在叫我的名字', '记不清了'] }
          ]
        },
        {
          title: '第二部分：关于"规则守则"',
          questions: [
            { n: 5, type: 'single',
              text: '你仔细读过学校发布的规则守则全文吗？',
              options: ['全部读过', '大致扫了一眼', '只看了宿舍相关部分', '没看过'] },
            { n: 6, type: 'single',
              text: '守则中"下午 6 点后禁止出宿舍楼"这条规定，你的看法是？',
              options: ['可以理解，天冷安全第一', '不太合理，6 点太早了', '完全不合理，限制了正常生活', '规定本身不是问题，但执行方式很奇怪'] },
            { n: 7, type: 'single',
              text: '守则中是否提到过"天黑后不要回应敲门声"这一条？',
              options: ['提到了', '没有提到', '我不记得有这条', '我看的版本和这份问卷说的不一样'] },
            { n: 8, type: 'multiple-other',
              text: '除了 6 点禁出宿舍楼，守则中还有哪些让你觉得奇怪的地方？（可多选）',
              options: ['措辞含糊，很多条款说不清楚', '有些规定和寒潮毫无关系', '处罚措施过于严厉', '没有说明执行期限', '发布前没有任何征求意见', '落款日期不是 5 月 8 日'] },
            { n: 9, type: 'multiple',
              text: '6 点后禁止出宿舍楼，对你的实际影响有哪些？（可多选）',
              options: ['无法去食堂吃晚饭', '无法去教室/图书馆自习', '无法进行正常的课后活动', '生活用品采购受影响', '心理上感到压抑/不安', '暂时没有太大影响'] },
            { n: 10, type: 'single',
              text: '你认为学校发布这份守则的真实目的是什么？',
              options: ['纯粹为了应对寒潮', '借寒潮之名加强管理', '有其他未说明的原因', '说不清楚，但肯定不只是因为天气', '这份守则不是学校发的'] }
          ]
        },
        {
          title: '第三部分：你的感受与建议',
          questions: [
            { n: 11, type: 'single',
              text: '你此刻的感受是？',
              options: ['安全', '不安', '极度不安', '我不想选'] },
            { n: 12, type: 'single',
              text: '整体而言，你对这次寒潮预警 + 规则守则的组合感受是？',
              options: ['正常管理，无需多想', '略有不适，但能接受', '明显感到不对劲', '非常不安，希望有人解释'] },
            { n: 13, type: 'textarea',
              text: '你是否注意到守则发布前后学校有哪些异常变化？（开放题）' },
            { n: 14, type: 'single',
              text: '如果此刻有人敲门，你会开门吗？',
              options: ['会', '不会', '先问是谁', '我不会靠近门'] },
            { n: 15, type: 'single',
              text: '你觉得同学们私下对这件事的讨论多吗？',
              options: ['讨论很多，大家都很关注', '有一些讨论', '很少有人提', '大家不敢讨论'] },
            { n: 16, type: 'single-other',
              text: '你希望{red:我}整理调查结果后如何处理？',
              options: ['匿名向学校反映', '在同学间公开汇总结果', { text: '修改规则', strike: true }] }
          ]
        }
      ]
    };

    /* ============================================================
       13. 渲染题目
       ============================================================ */
    function renderQuestion(q, answers) {
      if (q.n === 16 && flag('q16_overridden')) {
        q = {
          n: 16, type: 'single',
          text: '{red:你觉得问卷发布人真的是周学姐吗？}',
          options: ['是', '不是']
        };
      }

      var n = q.n;
      var cur = answers['q' + n];
      var titleHtml = esc(q.text).replace(/\{red:([^}]+)\}/g, '<span class="q-red">$1</span>');

      var html = '<div class="q-block">';
      html += '<div class="q-title"><b>' + n + '.</b> ' + titleHtml + '</div>';

      if (q.type === 'single' || q.type === 'single-other') {
        q.options.forEach(function (opt) {
          var display = typeof opt === 'string' ? opt : opt.text;
          var strike = typeof opt === 'object' && opt.strike;
          var checked = (cur === display) ? 'checked' : '';
          var style = strike ? ' style="color:var(--c-danger);text-decoration:line-through;"' : '';
          html += '<label class="q-label">' +
            '<input type="radio" name="q' + n + '" value="' + esc(display) + '" ' + checked + '>' +
            '<span' + style + '>' + esc(display) + '</span>' +
          '</label>';
        });
        if (q.type === 'single-other') {
          var otherVal = (typeof cur === 'string' && cur.indexOf('其他：') === 0) ? cur.slice(3) : '';
          var otherChecked = otherVal ? 'checked' : '';
          html += '<label class="q-label">' +
            '<input type="radio" name="q' + n + '" value="__other" ' + otherChecked + '>' +
            '<span>其他：</span>' +
            '<input type="text" class="q-other-input" data-q="' + n + '" placeholder="请填写" value="' + esc(otherVal) + '">' +
          '</label>';
        }
      } else if (q.type === 'multiple' || q.type === 'multiple-other') {
        var arr = Array.isArray(cur) ? cur : [];
        q.options.forEach(function (opt) {
          var display = typeof opt === 'string' ? opt : opt.text;
          var checked = arr.indexOf(display) >= 0 ? 'checked' : '';
          html += '<label class="q-label">' +
            '<input type="checkbox" name="q' + n + '" value="' + esc(display) + '" ' + checked + '>' +
            '<span>' + esc(display) + '</span>' +
          '</label>';
        });
        if (q.type === 'multiple-other') {
          var otherArr = arr.filter(function (x) { return x.indexOf('其他：') === 0; });
          var otherVal2 = otherArr[0] ? otherArr[0].slice(3) : '';
          var otherChecked2 = otherArr.length ? 'checked' : '';
          html += '<label class="q-label">' +
            '<input type="checkbox" name="q' + n + '" value="__other" ' + otherChecked2 + '>' +
            '<span>其他：</span>' +
            '<input type="text" class="q-other-input" data-q="' + n + '" placeholder="请填写" value="' + esc(otherVal2) + '">' +
          '</label>';
        }
      } else if (q.type === 'textarea') {
        html += '<textarea class="q-textarea" data-q="' + n + '" placeholder="请填写">' + esc(typeof cur === 'string' ? cur : '') + '</textarea>';
      } else if (q.type === 'text') {
        html += '<input class="q-text" data-q="' + n + '" placeholder="请填写" value="' + esc(typeof cur === 'string' ? cur : '') + '">';
      }

      html += '</div>';
      return html;
    }

    /* ============================================================
       14. 问卷页面
       ============================================================ */
    PAGES.questionnaire = function () {
      extEnsure();
      var answers = state.questionnaireAnswers || {};
      var submitted = !!state.flags.s9_questionnaire_done;

      var body = Q_DATA.sections.map(function (sec) {
        return '<div class="sec-title-q">' + esc(sec.title) + '</div>' +
          sec.questions.map(function (q) { return renderQuestion(q, answers); }).join('');
      }).join('');

      var footer = submitted
        ? '<button class="btn block ghost" disabled style="opacity:.5;">已提交</button>' +
          '<div class="txt-xs txt-3 center mt3">你已提交此问卷，等待周学姐整理结果。</div>'
        : '<button class="btn block" data-action="submit-questionnaire">提交</button>';

      return {
        html: '<div class="page">' +
          navBar('调查问卷') +
          '<div class="page-body">' +
            '<div class="notice-doc">' +
              '<h2>' + esc(Q_DATA.title) + '</h2>' +
              '<div class="notice-meta">发起人：' + esc(Q_DATA.author) + '</div>' +
              body +
              '<div class="notice-sign">—— 周学姐</div>' +
              '<div class="txt-xs txt-3 center" style="margin-top:var(--sp-4);line-height:1.7;">' +
                '本问卷匿名，结果仅用于汇总反映同学意见。<br>' +
                '又及：请不要把你填写后的问卷给任何人看。' +
              '</div>' +
            '</div>' +
            '<div class="px4" style="padding-bottom:var(--sp-6);">' + footer + '</div>' +
          '</div>' +
        '</div>',
        mount: function () {
          if (submitted) {
            document.querySelectorAll('.page-body input, .page-body textarea').forEach(function (el) {
              el.disabled = true;
            });
          }
        }
      };
    };

    /* ============================================================
       15. 黑屏红字警告
       ============================================================ */
    function showWarningScreen(lines, onDone) {
      var layers = document.getElementById('layers');
      if (!layers) { onDone && onDone(); return; }
      var old = document.getElementById('wxg-warning-overlay');
      if (old) old.remove();

      var overlay = document.createElement('div');
      overlay.id = 'wxg-warning-overlay';
      overlay.style.cssText = 'position:absolute;inset:0;background:#000;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px;overflow-y:auto;';
      layers.appendChild(overlay);

      function showLine(i) {
        if (i >= lines.length) { onDone && onDone(); return; }
        var line = lines[i];

        if (line.clear) {
          overlay.innerHTML = '';
          setTimeout(function () { showLine(i + 1); }, line.delay || 300);
          return;
        }

        var el = document.createElement('div');
        el.style.cssText = 'text-align:center;margin:12px 0;line-height:1.8;white-space:pre-wrap;overflow-wrap:anywhere;' +
          'color:' + (line.color || '#fff') + ';' +
          'font-size:' + (line.size || '16px') + ';' +
          (line.strike ? 'text-decoration:line-through;' : '') +
          (line.bold ? 'font-weight:700;' : '') +
          (line.letterSpacing ? 'letter-spacing:' + line.letterSpacing + ';' : '');
        overlay.appendChild(el);

        if (line.flash) {
          var chars = Array.from(line.text);
          var idx = 0;
          function nextChar() {
            if (idx >= chars.length) {
              setTimeout(function () { showLine(i + 1); }, line.delay || 1500);
              return;
            }
            el.textContent += chars[idx];
            el.style.animation = 'wxg-blink .3s';
            setTimeout(function () { el.style.animation = ''; }, 300);
            idx++;
            setTimeout(nextChar, line.charDelay || 400);
          }
          nextChar();
        } else if (line.typewriter === false) {
          el.textContent = line.text;
          setTimeout(function () { showLine(i + 1); }, line.delay || 1000);
        } else {
          var idx2 = 0;
          var text = line.text;
          var speed = line.speed || 60;
          function tick() {
            if (idx2 >= text.length) {
              setTimeout(function () { showLine(i + 1); }, line.delay || 1200);
              return;
            }
            el.textContent = text.slice(0, idx2 + 1);
            idx2++;
            setTimeout(tick, speed);
          }
          tick();
        }
      }
      showLine(0);
    }

    /* ============================================================
       16. 问卷提交
       ============================================================ */
    function collectQuestionnaire() {
      var answers = {};
      var inputs = document.querySelectorAll('.page-body input, .page-body textarea');
      inputs.forEach(function (el) {
        if (el.type === 'radio' && el.checked) {
          var qn = 'q' + el.name.replace('q', '');
          var v = el.value;
          if (v === '__other') {
            var other = document.querySelector('.q-other-input[data-q="' + el.name.replace('q', '') + '"]');
            v = (other && other.value.trim()) ? '其他：' + other.value.trim() : '其他';
          }
          answers[qn] = v;
        } else if (el.type === 'checkbox' && el.checked) {
          var qn2 = 'q' + el.name.replace('q', '');
          if (!Array.isArray(answers[qn2])) answers[qn2] = [];
          var v2 = el.value;
          if (v2 === '__other') {
            var other2 = document.querySelector('.q-other-input[data-q="' + el.name.replace('q', '') + '"]');
            v2 = (other2 && other2.value.trim()) ? '其他：' + other2.value.trim() : '其他';
          }
          answers[qn2].push(v2);
        } else if (el.classList.contains('q-text') || el.classList.contains('q-textarea')) {
          answers['q' + el.dataset.q] = el.value;
        }
      });
      return answers;
    }

    async function handleSubmitQuestionnaire() {
      if (state.flags.s9_questionnaire_done) return;

      var answers = collectQuestionnaire();

      if (!flag('q16_overridden')) {
        if (answers.q16 === '修改规则') {
          state.questionnaireAnswers = answers;
          state.questionnaireAnswers.q16 = null;
          flag('q16_overridden', true);
          save();

          showWarningScreen([
            { text: '警告：本问卷没有第16题。', color: '#ff3333', size: '20px', bold: true, speed: 80, delay: 1000 },
            { text: '请您重新作答。', color: '#ff3333', size: '18px', speed: 80, delay: 1800 }
          ], function () {
            var ov = document.getElementById('wxg-warning-overlay');
            if (ov) ov.remove();
            render();
          });
          return;
        }
      }

      if (flag('q16_overridden')) {
        var q16v = answers.q16;
        if (q16v !== '是' && q16v !== '不是') {
          Toast.show('问卷未填写完毕');
          return;
        }
        if (q16v === '不是') {
          state.questionnaireAnswers = answers;
          save();

          showWarningScreen([
            { text: '作答错误。', color: '#ff3333', size: '20px', bold: true, speed: 80, delay: 1000 },
            { text: '有人发现您了&#%', color: '#ff3333', size: '20px', bold: true, speed: 80, strike: true, delay: 1800 },
            { clear: true, delay: 600 },
            { text: '您的学籍已自动注销，', color: '#fff', size: '18px', speed: 60, delay: 800 },
            { text: '寒潮降临，请您注意安全……', color: '#fff', size: '18px', speed: 60, delay: 2000 },
            { clear: true, delay: 800 },
            { text: '王 晓 歌', color: '#ff0000', size: '52px', bold: true, flash: true, charDelay: 500, delay: 2500 }
          ], function () {
            var ov = document.getElementById('wxg-warning-overlay');
            if (ov) ov.remove();
            Router.root('lock');
            setTimeout(function () {
              ConfirmBox.open({
                title: '继续？',
                body: '是否按当前进度继续游玩？\n\n· 选"继续"将回到问卷页面，第16题重置\n· 选"重新开始"将清空本机数据并重开',
                okText: '继续',
                cancelText: '重新开始'
              }).then(function (ok) {
                if (ok) {
                  state.questionnaireAnswers.q16 = null;
                  save();
                  Router.root('questionnaire');
                } else {
                  try { localStorage.removeItem('xiaoqu_save_v1'); } catch (e) {}
                  location.reload();
                }
              });
            }, 800);
          });
          return;
        }
        addMemoQuestionnaireClue();
      }

      var confirmed = await ConfirmBox.open({
        title: '确认提交',
        body: '提交后不可修改，确定提交吗？',
        okText: '提交',
        cancelText: '再想想'
      });
      if (!confirmed) return;

      state.questionnaireAnswers = answers;
      state.flags.s9_questionnaire_done = true;
      state.flags.q_stage = 2;
      save();

      CursorGuide.hide();

      Toast.show('问卷已提交');

      setTimeout(function () {
        render();
        setTimeout(function () { triggerS10(); }, 800);
      }, 300);
    }

    /* ============================================================
       17. PAGES.forumPost
       ============================================================ */
    PAGES.forumPost = function (params) {
      extEnsure();
      var p = state.db.forum.posts.find(function (x) { return x.id === params.id; });
      if (!p) return simplePage('帖子', '<div class="empty">帖子已被删除</div>');

      var floorsHtml = (p.floors || []).map(function (f) {
        var key = p.id + '_' + f.n;
        var likeKey = 'floor_' + key;
        var likes = state.forumLikes || {};
        var mine = likes[likeKey] || 0;
        var replies = (state.forumReplies || {})[key] || [];
        var replyHtml = replies.map(function (r) {
          return '<div class="floor-reply">我（' + esc((state.profile && state.profile.name) || '陈默') + '）：' + esc(r.text) + '</div>';
        }).join('');
        var actionHtml = '';
        if (f.action && f.action.type === 'join-group') {
          actionHtml = '<div style="margin-top:8px;"><button class="join-group-btn" data-action="join-group" data-group="' + esc(f.action.groupId) + '">' + esc(f.action.label) + '</button></div>';
        }
        return '<div class="floor">' +
          '<div class="floor-head">' +
            '<span class="floor-user">' + esc(f.user) + '</span>' +
            '<span class="floor-num">' + f.n + '楼</span>' +
          '</div>' +
          '<div class="floor-body">' +
            (f.quote ? '<span class="quote">回复 @' + esc(f.quote) + '：</span>' : '') +
            esc(f.text) +
          '</div>' +
          actionHtml +
          '<div class="floor-actions">' +
            '<button class="floor-btn ' + (mine ? 'liked' : '') + '" data-action="forum-like" data-key="' + esc(likeKey) + '">' +
              '<span class="like-cnt">' + (mine ? '已赞' : '赞') + '</span>' +
            '</button>' +
            (p.locked ? '' : '<button class="floor-btn" data-action="forum-reply" data-key="' + esc(key) + '">回复</button>') +
          '</div>' +
          replyHtml +
        '</div>';
      }).join('');

      var contentHtml = p.content ? '<div class="notice-doc" style="padding:var(--sp-4);margin-bottom:var(--sp-3);"><div style="font-size:14.5px;line-height:1.7;overflow-wrap:anywhere;">' + esc(p.content) + '</div></div>' : '';

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
            contentHtml +
            '<div class="card" style="padding:0;">' + floorsHtml + '</div>' +
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
                id: uid('m'), from: '临爽', text: '我靠别搞啊，有点吓人了', time: '2025-05-08 18:16'
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
       17.1 PAGES.friendRequests —— v2.2 修复：
       把 fr_zxj 的 action 换成专属 fr-accept-zxj / fr-ignore-zxj，
       绕过 story-patch.js 对 fr-accept 的全局劫持
       ============================================================ */
    var prevFriendRequests = PAGES.friendRequests;
    PAGES.friendRequests = function (params) {
      var def = prevFriendRequests(params);
      // 只替换周学姐那条申请（fr_zxj），临爽 fr_ls 不动
      def.html = def.html.replace(
        /data-action="fr-accept" data-id="fr_zxj"/g,
        'data-action="fr-accept-zxj" data-id="fr_zxj"'
      );
      def.html = def.html.replace(
        /data-action="fr-ignore" data-id="fr_zxj"/g,
        'data-action="fr-ignore-zxj" data-id="fr_zxj"'
      );
      return def;
    };

    /* ============================================================
       18. 加入互助群
       ============================================================ */
    function joinHuzhu() {
      extEnsure();
      if (flag('huzhu_joined')) {
        Toast.show('已加入互助群');
        return;
      }
      flag('huzhu_joined', true);
      flag('huzhu_stage', 0);
      if (!state.db.chats.huzhu) {
        state.db.chats.huzhu = {
          id: 'huzhu', type: 'group', name: '互助群', avatar: '🤝',
          memberCount: 3, canSend: false,
          warn: '寒潮期间禁止与校外人员通讯',
          messages: [
            { id: uid('m'), type: 'system', text: '“王晓歌”已加入群聊', time: storyTime() }
          ]
        };
      } else if (!state.db.chats.huzhu.messages.some(function (m) { return m.text === '“王晓歌”已加入群聊'; })) {
        state.db.chats.huzhu.messages.push({
          id: uid('m'), type: 'system', text: '“王晓歌”已加入群聊', time: storyTime()
        });
      }
      save();
      Toast.show('已加入互助群');
      setTimeout(function () { Router.push('chat', { id: 'huzhu' }); }, 400);
    }

    /* ============================================================
       19. 事件委托
       ============================================================ */
    document.addEventListener('click', function (e) {
      // 提交问卷
      var sub = e.target.closest('[data-action="submit-questionnaire"]');
      if (sub) {
        e.stopPropagation();
        handleSubmitQuestionnaire();
        return;
      }
      // 加入互助群
      var join = e.target.closest('[data-action="join-group"]');
      if (join) {
        e.stopPropagation();
        if (join.dataset.group === 'huzhu') joinHuzhu();
        return;
      }
      // v2.2：周学姐好友申请通过（专属 action，绕过 story-patch 劫持）
      var acceptZxj = e.target.closest('[data-action="fr-accept-zxj"]');
      if (acceptZxj) {
        e.stopPropagation();
        e.preventDefault();
        var id = acceptZxj.dataset.id;
        var fr = state.db.friendRequests.find(function (f) { return f.id === id; });
        if (!fr || fr.status !== 'pending') return;
        fr.status = 'accepted';

        var c = state.db.contacts.find(function (x) { return x.id === 'zx'; });
        if (!c) {
          c = { id: 'zx', name: '周学姐-北苑6号楼', avatar: '🎓', note: '北苑6号楼', hidden: false };
          state.db.contacts.push(c);
        } else {
          c.name = '周学姐-北苑6号楼';
          c.note = '北苑6号楼';
          c.hidden = false;
        }
        if (!state.db.chats.zx) {
          state.db.chats.zx = {
            id: 'zx', type: 'private', name: '周学姐-北苑6号楼', avatar: '🎓',
            canSend: false, warn: '寒潮期间禁止与校外人员通讯', messages: []
          };
        } else {
          state.db.chats.zx.name = '周学姐-北苑6号楼';
        }
        state.flags.zxj_added = true;
        state.flags.zx_stage = 0;
        save();
        Toast.show('已通过好友申请');
        setTimeout(function () {
          ConfirmBox.open({
            title: '已添加周学姐',
            body: '为了方便后续推理，自动备注为：\n\n周学姐-北苑6号楼\n\n她正在等你回复。',
            okText: '去看看',
            cancelText: '稍后'
          }).then(function (ok) {
            if (ok) Router.push('chat', { id: 'zx' });
            else render();
          });
        }, 200);
        return;
      }
      // v2.2：周学姐好友申请忽略（专属 action）
      var ignoreZxj = e.target.closest('[data-action="fr-ignore-zxj"]');
      if (ignoreZxj) {
        e.stopPropagation();
        e.preventDefault();
        var id2 = ignoreZxj.dataset.id;
        var fr2 = state.db.friendRequests.find(function (f) { return f.id === id2; });
        if (fr2 && fr2.status === 'pending') {
          fr2.status = 'ignored';
          save();
          Toast.show('已忽略');
          render();
        }
        return;
      }
    }, true);

    /* ============================================================
       20. 其他输入自动选中
       ============================================================ */
    document.addEventListener('input', function (e) {
      var el = e.target;
      if (!el.classList || !el.classList.contains('q-other-input')) return;
      var q = el.dataset.q;
      var other = document.querySelector(
        'input[type=radio][name="q' + q + '"][value="__other"], ' +
        'input[type=checkbox][name="q' + q + '"][value="__other"]'
      );
      if (other && !other.disabled && el.value.trim()) other.checked = true;
    });

    /* ============================================================
       21. Router.push 钩子
       ============================================================ */
    var prevPush = Router.push.bind(Router);
    Router.push = function (page, params) {
      extEnsure();
      if (page === 'questionnaire') CursorGuide.hide();
      prevPush(page, params);
    };

    /* ============================================================
       22. 全局检查
       ============================================================ */
    setInterval(function () {
      extEnsure();
      var cur = Router.current();
      if (!cur) return;
      if (flag('s9_questionnaire_done')) {
        if (CursorGuide && CursorGuide.current) {
          CursorGuide.hide();
        }
      }
      if (cur.page !== 'chat') return;
      var cid = cur.params.id;
      if (cid === 'zx' || cid === 'huzhu') {
        try { onOpenChatPatchExt(cid); } catch (e) { /* 静默 */ }
      }
      if (cid === 'by' && flag('s10_pending') && flag('s10_notified')) {
        try { handleS10InByChat(); } catch (e) { /* 静默 */ }
      }
    }, 800);

    /* ============================================================
       23. 补触发
       ============================================================ */
    setTimeout(function () {
      extEnsure();
      var cur = Router.current();
      if (cur && cur.page === 'chat') {
        if (cur.params.id === 'ls' || cur.params.id === 'by' ||
            cur.params.id === 'zx' || cur.params.id === 'huzhu') {
          try { onOpenChatPatchExt(cur.params.id); } catch (e) { /* 静默 */ }
        }
      }
    }, 900);

    /* ============================================================
       24. 暴露 API
       ============================================================ */
    window.StoryExtension = {
      addMemoClue: addMemoClue,
      addMemoQuestionnaireClue: addMemoQuestionnaireClue,
      playLinShuangOpening: playLinShuangOpening,
      playLsPostChoice: playLsPostChoice,
      triggerS9Group: triggerS9Group,
      playS9Group: playS9Group,
      playS9PostChoice: playS9PostChoice,
      triggerS10: triggerS10,
      playS10Group: playS10Group,
      playS10PostChoice: playS10PostChoice,
      triggerZxjFriendRequest: triggerZxjFriendRequest,
      playZxOpening: playZxOpening,
      joinHuzhu: joinHuzhu,
      renderQuestion: renderQuestion,
      showWarningScreen: showWarningScreen,
      Q_DATA: Q_DATA,
      CHOICES: CHOICES,
      ensureMsg: ensureMsg,
      ensureMsgP: ensureMsgP,
      _playingLock: _playingLock
    };

    console.log('[story-extension v2.2] 已加载：周学姐好友申请专属 action');
  });
})();
