/* ================================================================
   story-extension.js  v1.1
   剧情累加文件（与 story-patch.js 并存）

   v1.1 修复：
   1. 临爽私聊消息乱序 —— 改用 ensureMsg 幂等逐条补，
      已存在的消息跳过且不重复延迟，缺失的按顺序慢速补
   2. 大群 s9 消息一次铺满 —— 同上，逐条 1.3~1.6 秒间隔播放
   3. 加 _playingLock 防止同一会话同时启动两次播放
   4. stage 只在关键节点设置（播放完成 / 选项弹出 / 选项已选）
   5. onOpenChatPatchExt 检测 _playingLock，避免刷新后重复播放
   6. 保留 s9 选①自动记录"线索：校外人员？"进备忘录
   7. 保留问卷页（题目从 1 开始编号，红字/删除线）

   如何累加新剧情：
   - 往 EXT 里加阶段，或新加 `if (cid === 'xxx')` 分支
   - 新选项：CHOICES.newNode = { a(){}, b(){} }
   - 新页面：PAGES.newPage = function(){ return { html } }
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
       0. 扩展专用样式
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
      '.q-strike{color:var(--c-danger);text-decoration:line-through}';
    document.head.appendChild(st);

    /* ============================================================
       1. 扩展状态兜底
       ============================================================ */
    function extEnsure() {
      if (!state.flags) state.flags = {};
      if (!state.db) state.db = {};
      if (!state.db.memos) state.db.memos = [];
      if (!state.db.chats) state.db.chats = {};
      if (!state.questionnaireAnswers) state.questionnaireAnswers = {};
    }
    extEnsure();

    /* ============================================================
       2. 幂等消息工具 + 播放锁
       ============================================================ */
    var _playingLock = {};

    // 逐条补消息：已存在则跳过；不存在则延迟 delay 后 push
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

    /* ============================================================
       3. 包装 PAGES.chat
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
       4. 剧情调度
       ============================================================ */
    function onOpenChatPatchExt(cid) {
      extEnsure();
      if (cid === 'ls') return handleLsChat();
      if (cid === 'by') return handleByChatExt();
    }

    /* ============================================================
       5. 临爽私聊
       stage:
         0 = 未开始
         1 = 播放中
         2 = 选项已弹出
         3 = 选项已选（lsPostChoice 播放中）
         4 = 私聊部分完成，已触发群聊
       ============================================================ */
    function handleLsChat() {
      if (!flag('ls_added')) return;
      if (_playingLock['ls']) return;

      var stage = flag('ls_stage') || 0;

      if (stage === 0 || stage === 1) {
        playLinShuangOpening();
        return;
      }

      if (stage === 2) {
        // 选项已弹，如果 choice 丢了（刷新导致）就重弹
        if (!(state.choice && state.choice.chatId === 'ls')) {
          state.choice = {
            chatId: 'ls', nodeId: 'ls_opening',
            options: [
              { k: 'a', label: '①你觉得寒潮这件事…' },
              { k: 'b', label: '②欢迎来我们寝室玩' }
            ]
          };
          save();
          render();
        }
        return;
      }

      if (stage === 3) {
        playLsPostChoice();
        return;
      }

      // stage 4：已完成，等待群聊
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
        state.choice = {
          chatId: cid, nodeId: 'ls_opening',
          options: [
            { k: 'a', label: '①你觉得寒潮这件事…' },
            { k: 'b', label: '②欢迎来我们寝室玩' }
          ]
        };
        save();
        refreshChat(cid);
      } finally {
        _playingLock['ls'] = false;
      }
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
      } finally {
        _playingLock['ls_post'] = false;
      }
    }

    /* ============================================================
       6. 北苑群 s9
       stage:
         0 = 未开始
         1 = runScene9Group 播放中
         2 = 选项已弹
         3 = 选项已选（s9PostChoice 播放中）
         4 = 问卷链接已发
       ============================================================ */
    function handleByChatExt() {
      if (!flag('s9_pending')) return;
      if (_playingLock['by_s9'] || _playingLock['by_s9_post']) return;

      var stage = flag('s9_stage') || 0;

      if (stage === 0 || stage === 1) {
        playS9Group();
        return;
      }

      if (stage === 2) {
        if (!(state.choice && state.choice.chatId === 'by')) {
          state.choice = {
            chatId: 'by', nodeId: 'grp_s9',
            options: [
              { k: 'a', label: '①你不留校怎么还进留校群' },
              { k: 'b', label: '②羡慕你，受不了这个规则了' }
            ]
          };
          save();
          render();
        }
        return;
      }

      if (stage === 3) {
        playS9PostChoice();
        return;
      }

      if (stage === 4) {
        // 问卷链接已发，显示光标指引
        setTimeout(function () {
          CursorGuide.show('[data-action="jump"][data-page="questionnaire"]', '点击填写问卷');
        }, 500);
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
        state.choice = {
          chatId: cid, nodeId: 'grp_s9',
          options: [
            { k: 'a', label: '①你不留校怎么还进留校群' },
            { k: 'b', label: '②羡慕你，受不了这个规则了' }
          ]
        };
        save();
        refreshChat(cid);
      } finally {
        _playingLock['by_s9'] = false;
      }
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
        byChat.messages.push({
          id: uid('m'), from: '周学姐',
          text: '@所有人 打扰大家一下',
          time: storyTime()
        });
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
        // 已在群聊，立即开始播放
        setTimeout(function () { onOpenChatPatchExt('by'); }, 300);
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

        // 问卷链接（带跳转）
        var hasLink = state.db.chats.by.messages.some(function (m) {
          return m.from === '周学姐' && m.text === '【问卷链接】';
        });
        if (!hasLink) {
          state.db.chats.by.messages.push({
            id: uid('m'), from: '周学姐',
            text: '【问卷链接】',
            time: storyTime(),
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
        CursorGuide.show('[data-action="jump"][data-page="questionnaire"]', '点击填写问卷');
      } finally {
        _playingLock['by_s9_post'] = false;
      }
    }

    /* ============================================================
       7. 备忘录线索
       ============================================================ */
    function addMemoClue() {
      extEnsure();
      var title = '线索：校外人员？';
      if (state.db.memos.some(function (m) { return m.title === title; })) return;
      state.db.memos.push({
        id: uid('memo'),
        title: title,
        type: 'auto',
        time: fmtFull(sysNow()),
        content: '封校后，"校外人员"似乎被隔离了——张夏夏一出校就被系统识别为校外人员，无法与校内联系。\n苏青：一想和校外的朋友联系就会弹出警告"寒潮期间禁止与校外人员通讯"。\n\n这意味着，可能不止寒潮——学校在切断我们与外界的一切联系。'
      });
      save();
    }

    /* ============================================================
       8. 问卷数据（题目从 1 开始编号）
       ============================================================ */
    var Q_DATA = {
      title: '渠京第一中学寒潮预警与宿舍管理规定调查问卷',
      author: '周学姐',
      sections: [
        {
          title: '第一部分：关于寒潮预警',
          questions: [
            {
              n: 1, type: 'single-other',
              text: '你是通过什么渠道得知 5 月 8 日寒潮预警的？',
              options: ['班级群通知', '宿舍广播', '同学转告', '公告栏']
            },
            {
              n: 2, type: 'single',
              text: '你对这次寒潮预警的发布方式感受如何？',
              options: ['正常，没什么特别', '有点突然，但可以接受', '很奇怪，发布时机和措辞都不太对劲', '完全不合理']
            },
            {
              n: 3, type: 'single',
              text: '你觉得 5 月出现寒潮预警本身正常吗？',
              options: ['正常，天气无常', '不太正常，5 月不该这么冷', '极度反常']
            },
            {
              n: 4, type: 'single',
              text: '寒潮预警发布后，你有没有听到过宿舍楼外传来什么声音？',
              options: ['没有', '风声', '有人在叫我的名字', '记不清了']
            }
          ]
        },
        {
          title: '第二部分：关于"规则守则"',
          questions: [
            {
              n: 5, type: 'single',
              text: '你仔细读过学校发布的规则守则全文吗？',
              options: ['全部读过', '大致扫了一眼', '只看了宿舍相关部分', '没看过']
            },
            {
              n: 6, type: 'single',
              text: '守则中"下午 6 点后禁止出宿舍楼"这条规定，你的看法是？',
              options: ['可以理解，天冷安全第一', '不太合理，6 点太早了', '完全不合理，限制了正常生活', '规定本身不是问题，但执行方式很奇怪']
            },
            {
              n: 7, type: 'single',
              text: '守则中是否提到过"天黑后不要回应敲门声"这一条？',
              options: ['提到了', '没有提到', '我不记得有这条', '我看的版本和这份问卷说的不一样']
            },
            {
              n: 8, type: 'multiple-other',
              text: '除了 6 点禁出宿舍楼，守则中还有哪些让你觉得奇怪的地方？（可多选）',
              options: ['措辞含糊，很多条款说不清楚', '有些规定和寒潮毫无关系', '处罚措施过于严厉', '没有说明执行期限', '发布前没有任何征求意见', '落款日期不是 5 月 8 日']
            },
            {
              n: 9, type: 'multiple',
              text: '6 点后禁止出宿舍楼，对你的实际影响有哪些？（可多选）',
              options: ['无法去食堂吃晚饭', '无法去教室/图书馆自习', '无法进行正常的课后活动', '生活用品采购受影响', '心理上感到压抑/不安', '暂时没有太大影响']
            },
            {
              n: 10, type: 'single',
              text: '你认为学校发布这份守则的真实目的是什么？',
              options: ['纯粹为了应对寒潮', '借寒潮之名加强管理', '有其他未说明的原因', '说不清楚，但肯定不只是因为天气', '这份守则不是学校发的']
            }
          ]
        },
        {
          title: '第三部分：你的感受与建议',
          questions: [
            {
              n: 11, type: 'single',
              text: '你此刻的感受是？',
              options: ['安全', '不安', '极度不安', '我不想选']
            },
            {
              n: 12, type: 'single',
              text: '整体而言，你对这次寒潮预警 + 规则守则的组合感受是？',
              options: ['正常管理，无需多想', '略有不适，但能接受', '明显感到不对劲', '非常不安，希望有人解释']
            },
            {
              n: 13, type: 'textarea',
              text: '你是否注意到守则发布前后学校有哪些异常变化？（开放题）'
            },
            {
              n: 14, type: 'single',
              text: '如果此刻有人敲门，你会开门吗？',
              options: ['会', '不会', '先问是谁', '我不会靠近门']
            },
            {
              n: 15, type: 'single',
              text: '你觉得同学们私下对这件事的讨论多吗？',
              options: ['讨论很多，大家都很关注', '有一些讨论', '很少有人提', '大家不敢讨论']
            },
            {
              n: 16, type: 'single-other',
              text: '你希望{red:我}整理调查结果后如何处理？',
              options: ['匿名向学校反映', '在同学间公开汇总结果', { text: '修改规则', strike: true }]
            }
          ]
        }
      ]
    };

    /* ============================================================
       9. 问卷页面
       ============================================================ */
    function renderQuestion(q, answers) {
      var n = q.n;
      var cur = answers['q' + n];
      var titleHtml = esc(q.text);
      titleHtml = titleHtml.replace(/\{red:([^}]+)\}/g, '<span class="q-red">$1</span>');

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
       10. 提交问卷
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
      var ok = await ConfirmBox.open({
        title: '确认提交',
        body: '提交后不可修改，确定提交吗？',
        okText: '提交',
        cancelText: '再想想'
      });
      if (!ok) return;

      var answers = collectQuestionnaire();
      state.questionnaireAnswers = answers;
      state.flags.s9_questionnaire_done = true;
      state.flags.s9_stage = 5;
      save();

      Toast.show('问卷已提交');
      setTimeout(function () { render(); }, 300);
    }

    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-action="submit-questionnaire"]');
      if (!el) return;
      e.stopPropagation();
      handleSubmitQuestionnaire();
    }, true);

    /* ============================================================
       11. 输入"其他"时自动选中对应 radio / checkbox
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
       12. Router.push 钩子
       ============================================================ */
    var prevPush = Router.push.bind(Router);
    Router.push = function (page, params) {
      extEnsure();
      if (page === 'questionnaire') {
        CursorGuide.hide();
      }
      prevPush(page, params);
    };

    /* ============================================================
       13. 补触发：如果加载时玩家正在 ls / by 页面
       ============================================================ */
    setTimeout(function () {
      extEnsure();
      var cur = Router.current();
      if (cur.page === 'chat' && (cur.params.id === 'ls' || cur.params.id === 'by')) {
        onOpenChatPatchExt(cur.params.id);
      }
    }, 900);

    /* ============================================================
       14. 暴露扩展 API
       ============================================================ */
    window.StoryExtension = {
      addMemoClue: addMemoClue,
      playLinShuangOpening: playLinShuangOpening,
      playLsPostChoice: playLsPostChoice,
      triggerS9Group: triggerS9Group,
      playS9Group: playS9Group,
      playS9PostChoice: playS9PostChoice,
      renderQuestion: renderQuestion,
      Q_DATA: Q_DATA,
      CHOICES: CHOICES,
      ensureMsg: ensureMsg,
      _playingLock: _playingLock
    };

    console.log('[story-extension v1.1] 已加载：幂等逐条播放，修复乱序与一次铺满');
  });
})();
