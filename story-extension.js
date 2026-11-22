/* ================================================================
   story-extension.js  v1.0
   剧情累加文件（与 story-patch.js 并存，本文件专用于"加剧情"）

   本次新增内容：
   1. 临爽通过好友后的完整私聊 + 选项 ①/② 分支
   2. 私聊结束自动触发北苑群 s9
   3. 群聊 s9 + 选项 ①/② 分支
   4. 群聊末尾周学姐发【问卷链接】，光标指引点击
   5. 全新问卷页 PAGES.questionnaire（题目从 1 开始编号，
      修正原文档 5/10/16 起跳的 bug）
   6. 选 s9 选项①后自动把"线索：校外人员？"记进备忘录

   如何累加新剧情：
   - 往 EXT.STAGES 里加阶段
   - 或在 onOpenChatPatchExt 里加 cid 分支
   - 或在 CHOICES 里注册新 nodeId
   - 新页面直接注册 PAGES.xxx
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
        typeof fmtFull !== 'undefined') {
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
       2. 包装 PAGES.chat —— 在原有 mount 后追加剧情钩子
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
       3. 剧情入口调度
       ============================================================ */
    function onOpenChatPatchExt(cid) {
      extEnsure();
      if (cid === 'ls') return handleLsChat();
      if (cid === 'by') return handleByChatExt();
    }

    /* ============================================================
       4. 临爽私聊
       ============================================================ */
    function handleLsChat() {
      if (!flag('ls_added')) return;
      var stage = flag('ls_stage') || 0;

      // 玩家正在选项流程中，不重复触发
      if (state.choice && state.choice.chatId === 'ls') return;

      // 阶段 0：首次进入，开播
      if (stage === 0) {
        flag('ls_stage', 1);
        setTimeout(runLinShuangOpening, 600);
        return;
      }

      // 阶段 1：选项已弹但玩家刷新 / 未选完 → 补全消息 + 重弹选项
      if (stage === 1) {
        var chat = state.db.chats.ls;
        if (!chat) return;
        var need = [
          { type: 'system', text: '你已通过对方的好友申请' },
          { from: '临爽', text: '特殊期间嘛，有什么事咱俩可以互相照应一下桀桀桀' },
          { from: '临爽', text: '毕竟你就在我对门' },
          { from: '临爽', text: '哦对了，真是靠了我得先把你的备注从王晓歌改到陈默…' }
        ];
        var changed = false;
        need.forEach(function (e) {
          var exists = chat.messages.some(function (m) {
            if (e.type === 'system') return m.type === 'system' && m.text === e.text;
            return m.from === e.from && m.text === e.text;
          });
          if (!exists) {
            chat.messages.push(Object.assign({ id: uid('m'), time: storyTime() }, e));
            changed = true;
          }
        });
        if (changed) save();
        state.choice = {
          chatId: 'ls', nodeId: 'ls_opening',
          options: [
            { k: 'a', label: '①你觉得寒潮这件事…' },
            { k: 'b', label: '②欢迎来我们寝室玩' }
          ]
        };
        save();
        render();
        return;
      }

      // 阶段 2：选项已选，可能 lsPostChoice 没跑完 → 重跑
      if (stage === 2) {
        setTimeout(runLsPostChoice, 400);
        return;
      }
    }

    async function runLinShuangOpening() {
      var cid = 'ls';
      await sleep(600);
      pushMsg(cid, { type: 'system', text: '你已通过对方的好友申请', time: storyTime() });
      refreshChat(cid);

      await themSay(cid, '临爽', '特殊期间嘛，有什么事咱俩可以互相照应一下桀桀桀', 1200);
      await themSay(cid, '临爽', '毕竟你就在我对门', 1400);
      await themSay(cid, '临爽', '哦对了，真是靠了我得先把你的备注从王晓歌改到陈默…', 1600);
      await sleep(900);

      state.choice = {
        chatId: cid, nodeId: 'ls_opening',
        options: [
          { k: 'a', label: '①你觉得寒潮这件事…' },
          { k: 'b', label: '②欢迎来我们寝室玩' }
        ]
      };
      save();
      refreshChat(cid);
    }

    CHOICES.ls_opening = {
      async a() {
        var cid = 'ls';
        state.choice = null;
        flag('ls_stage', 2);
        save();
        await meSay(cid, '话说回来，你觉得有没有觉得寒潮封校这件事很奇怪', 500);
        await themSay(cid, '临爽', '是吗？小破中老整这种莫名其妙的东西，明明也没有很冷啊', 1600);
        await runLsPostChoice();
      },
      async b() {
        var cid = 'ls';
        state.choice = null;
        flag('ls_stage', 2);
        save();
        await meSay(cid, '封楼期间欢迎你来412大吃特吃嗷', 500);
        await meSay(cid, 'VVIP贵宾一位里边儿请～', 800);
        await themSay(cid, '临爽', '这老板恐怕是邓许吧', 1400);
        await themSay(cid, '临爽', '你只能算个服务员哈哈哈哈', 1400);
        await meSay(cid, '我去你的！', 800);
        addTrust(['临爽'], 3);
        await sleep(400);
        pushMsg(cid, { type: 'system', text: trustNote(['临爽'], 3), time: storyTime() });
        refreshChat(cid);
        await sleep(600);
        await runLsPostChoice();
      }
    };

    async function runLsPostChoice() {
      var cid = 'ls';
      var chat = state.db.chats.ls;
      if (!chat) return;

      var hasTrigger = chat.messages.some(function (m) {
        return m.from === '临爽' && m.text === '诶wk，周学姐好像在群里发东西了';
      });

      if (!hasTrigger) {
        await themSay(cid, '临爽', '诶wk，周学姐好像在群里发东西了', 1800);
      }

      flag('ls_stage', 3);
      save();

      await sleep(1200);
      triggerS9Group();
    }

    /* ============================================================
       5. 北苑群 s9
       ============================================================ */
    function handleByChatExt() {
      if (!flag('s9_pending')) return;
      if (state.choice && state.choice.chatId === 'by') return;

      var stage = flag('s9_stage') || 0;

      if (stage === 0) {
        flag('s9_stage', 1);
        setTimeout(runScene9Group, 900);
        return;
      }

      if (stage === 1) {
        // 补全 s9 群消息 + 重弹选项
        ensureS9Stage1Msgs();
        state.choice = {
          chatId: 'by', nodeId: 'grp_s9',
          options: [
            { k: 'a', label: '①你不留校怎么还进留校群' },
            { k: 'b', label: '②羡慕你，受不了这个规则了' }
          ]
        };
        save();
        render();
        return;
      }

      if (stage === 3 || stage === 4) {
        // 问卷链接已发，显示光标指引（若玩家此刻在群聊页面）
        setTimeout(function () {
          CursorGuide.show('[data-action="jump"][data-page="questionnaire"]', '点击填写问卷');
        }, 500);
        return;
      }
    }

    async function runScene9Group() {
      var cid = 'by';
      await themSay(cid, '周学姐', '你们对这次"寒潮预警"有什么想法么……？', 1200);
      await themSay(cid, '许双荞', '怪怪的，现在才五月份啊', 1600);
      await themSay(cid, '临爽', '？我靠你不说我都忘了，现在是5月啊！！哪门子的寒潮我问你', 1600);
      await themSay(cid, '苏青', '五月飞雪，好一出窦娥冤～', 1600);
      await themSay(cid, '张夏夏', '我早就感觉奇怪了，还好提前撤离了……还是在家舒服啊！', 1600);
      await sleep(900);

      state.choice = {
        chatId: cid, nodeId: 'grp_s9',
        options: [
          { k: 'a', label: '①你不留校怎么还进留校群' },
          { k: 'b', label: '②羡慕你，受不了这个规则了' }
        ]
      };
      flag('s9_stage', 1);
      save();
      refreshChat(cid);
    }

    function ensureS9Stage1Msgs() {
      var chat = state.db.chats.by;
      if (!chat) return;
      var need = [
        { from: '周学姐', text: '你们对这次"寒潮预警"有什么想法么……？' },
        { from: '许双荞', text: '怪怪的，现在才五月份啊' },
        { from: '临爽', text: '？我靠你不说我都忘了，现在是5月啊！！哪门子的寒潮我问你' },
        { from: '苏青', text: '五月飞雪，好一出窦娥冤～' },
        { from: '张夏夏', text: '我早就感觉奇怪了，还好提前撤离了……还是在家舒服啊！' }
      ];
      var changed = false;
      need.forEach(function (e) {
        var exists = chat.messages.some(function (m) { return m.from === e.from && m.text === e.text; });
        if (!exists) {
          chat.messages.push({ id: uid('m'), from: e.from, text: e.text, time: storyTime() });
          changed = true;
        }
      });
      if (changed) save();
    }

    function triggerS9Group() {
      if (flag('s9_notified')) return;
      flag('s9_notified', true);
      flag('s9_pending', true);

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
        onOpenChatPatchExt('by');
      }
    }

    CHOICES.grp_s9 = {
      async a() {
        var cid = 'by';
        state.choice = null;
        flag('s9_stage', 2);
        save();
        await meSay(cid, '这个张夏夏，都不留校怎么还在留校群里苟着啊！', 500);
        await themSay(cid, '张夏夏', '一线吃瓜～', 1400);
        await themSay(cid, '周学姐', '我拉的，因为貌似她只能通过这个群和我们联系。', 1600);
        await themSay(cid, '临爽', '挖什么金矿', 1400);
        await themSay(cid, '张夏夏', '是这样的…封校那天我发现我联系不上你们任何一个人，直到看到论坛里有这个群的链接，我才好歹能和你们说上话！', 1800);
        await themSay(cid, '张夏夏', '我似乎是一出校就被识别为"校外人员"了……总之珍惜吧！', 1600);
        await themSay(cid, '苏青', '确实呢，我现在一想和校外的朋友联系就会弹出一个警告', 1600);
        await themSay(cid, '沈敏', '对，好像是什么"寒潮期间禁止与校外人员通讯"，弱智极了', 1600);
        await meSay(cid, '这不是把我们大家都囚禁在渠中了吗……切断一切外界联系', 800);
        await themSay(cid, '邓许', '寒潮真的至于这样吗？我不敢苟同', 1600);
        addMemoClue();
        await sleep(400);
        pushMsg(cid, { type: 'system', text: '［"线索：校外人员？"已自动记录进备忘录］', time: storyTime() });
        refreshChat(cid);
        await sleep(600);
        await s9PostChoice();
      },
      async b() {
        var cid = 'by';
        state.choice = null;
        flag('s9_stage', 2);
        save();
        await meSay(cid, '真羡慕你啊……', 500);
        await meSay(cid, '我是真受不了这个雷霆规则了！', 800);
        await themSay(cid, '沈敏', '是啊，根本不是给人用的', 1400);
        await themSay(cid, '临爽', 'md真的太痛苦了，我们完全就是被囚禁圈养在渠中的牲畜啊！', 1600);
        await themSay(cid, '周学姐', '没有"们"。。。你自己是牲畜就够了。', 1600);
        await themSay(cid, '临爽', '？', 1200);
        await themSay(cid, '苏青', '太无聊了，姐姐我实在很想去7号楼找你们玩哦，奈何学校不让', 1600);
        await themSay(cid, '苏青', '我也很无奈～', 1400);
        await themSay(cid, '许双荞', '，，似乎你刚说了懒得出校门', 1600);
        await themSay(cid, '张夏夏', '哈哈哈我看到你们转发的规则了……哎不是感觉怎么看都怪怪的啊但是', 1600);
        addTrust(['沈敏', '临爽'], 1);
        await sleep(400);
        pushMsg(cid, { type: 'system', text: trustNote(['沈敏', '临爽'], 1), time: storyTime() });
        refreshChat(cid);
        await sleep(600);
        await s9PostChoice();
      }
    };

    async function s9PostChoice() {
      var cid = 'by';
      var chat = state.db.chats.by;
      if (!chat) return;

      // 已发过问卷链接 → 只补光标，不重推
      var hasLink = chat.messages.some(function (m) {
        return m.from === '周学姐' && m.text === '【问卷链接】';
      });

      if (!hasLink) {
        await themSay(cid, '周学姐', '嗯，别的不敢多说，这也是我来找大家的目的。', 1600);
        await themSay(cid, '周学姐', '北苑的同学们，麻烦大家配合一下，填写以下问卷，我会反馈这一切的蹊跷。', 1800);
        await themSay(cid, '临爽', '啊靠——都这时候了还要填excel，不要啊！！！（震声', 1600);
        await themSay(cid, '周学姐', '哈哈别急，除了excel还有你们最爱的ddl', 1600);
        await themSay(cid, '周学姐', '请大家在今晚前提交给我。', 1400);
        await themSay(cid, '张夏夏', '我、我也要交吗？', 1400);
        await themSay(cid, '周学姐', '。。你不用', 1200);
        await sleep(800);

        pushMsg(cid, {
          from: '周学姐',
          text: '【问卷链接】',
          time: storyTime(),
          link: { text: '【问卷链接】', page: 'questionnaire', params: {} }
        });
        refreshChat(cid);

        await themSay(cid, '许双荞', '周学姐，这个问卷的提交处好像不是你啊', 1600);
        await themSay(cid, '邓许', '好像，还真是……', 1600);
      }

      flag('s9_stage', 3);
      save();

      await sleep(1200);
      var body = document.querySelector('#chat-body');
      if (body) body.scrollTop = body.scrollHeight;
      await sleep(500);
      CursorGuide.show('[data-action="jump"][data-page="questionnaire"]', '点击填写问卷');
    }

    /* ============================================================
       6. 备忘录线索
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
       7. 问卷数据（题目编号从 1 开始，修正跳号）
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
       8. 问卷页面
       ============================================================ */
    function renderQuestion(q, answers) {
      var n = q.n;
      var cur = answers['q' + n];
      var titleHtml = esc(q.text);
      // 处理 {red:xxx}
      titleHtml = titleHtml.replace(/\{red:([^}]+)\}/g, '<span class="q-red">$1</span>');

      var html = '<div class="q-block">';
      html += '<div class="q-title"><b>' + n + '.</b> ' + titleHtml + '</div>';

      if (q.type === 'single' || q.type === 'single-other') {
        q.options.forEach(function (opt) {
          var display = typeof opt === 'string' ? opt : opt.text;
          var strike = typeof opt === 'object' && opt.strike;
          var val = esc(display);
          var checked = (cur === display) ? 'checked' : '';
          var style = strike ? 'style="color:var(--c-danger);text-decoration:line-through;"' : '';
          html += '<label class="q-label">' +
            '<input type="radio" name="q' + n + '" value="' + val + '" ' + checked + '>' +
            '<span ' + style + '>' + esc(display) + '</span>' +
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
            // 只读视图：禁用所有输入
            var body2 = document.querySelector('.page-body');
            if (body2) {
              body2.querySelectorAll('input, textarea, button[data-action="submit-questionnaire"]').forEach(function (el) {
                el.disabled = true;
              });
            }
          }
        }
      };
    };

    /* ============================================================
       9. 提交问卷
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
            if (other && other.value.trim()) v = '其他：' + other.value.trim();
            else v = '其他';
          }
          answers[qn] = v;
        } else if (el.type === 'checkbox' && el.checked) {
          var qn2 = 'q' + el.name.replace('q', '');
          if (!Array.isArray(answers[qn2])) answers[qn2] = [];
          var v2 = el.value;
          if (v2 === '__other') {
            var other2 = document.querySelector('.q-other-input[data-q="' + el.name.replace('q', '') + '"]');
            if (other2 && other2.value.trim()) v2 = '其他：' + other2.value.trim();
            else v2 = '其他';
          }
          answers[qn2].push(v2);
        } else if (el.classList.contains('q-text') || el.classList.contains('q-textarea')) {
          var qn3 = 'q' + el.dataset.q;
          answers[qn3] = el.value;
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
      // 后续剧情待续写（用户尚未更新）
      setTimeout(function () {
        render();
      }, 300);
    }

    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-action="submit-questionnaire"]');
      if (!el) return;
      e.stopPropagation();
      handleSubmitQuestionnaire();
    }, true);

    /* ============================================================
       10. 事件委托：其他输入框选中后自动选中"其他"
       ============================================================ */
    document.addEventListener('input', function (e) {
      var el = e.target;
      if (!el.classList || !el.classList.contains('q-other-input')) return;
      var q = el.dataset.q;
      // 找同组"其他"radio/checkbox
      var other = document.querySelector('input[type=radio][name="q' + q + '"][value="__other"], input[type=checkbox][name="q' + q + '"][value="__other"]');
      if (other && !other.disabled) {
        if (el.value.trim()) other.checked = true;
      }
    });

    /* ============================================================
       11. Router.push 钩子：处理问卷页
       ============================================================ */
    var prevPush = Router.push.bind(Router);
    Router.push = function (page, params) {
      extEnsure();
      if (page === 'questionnaire') {
        CursorGuide.hide();
        if (flag('s9_stage') === 3) {
          flag('s9_stage', 4);
          save();
        }
      }
      prevPush(page, params);
    };

    /* ============================================================
       12. 补触发：如果补丁加载时玩家在 ls / by 群
       ============================================================ */
    setTimeout(function () {
      extEnsure();
      var cur = Router.current();
      if (cur.page === 'chat' && (cur.params.id === 'ls' || cur.params.id === 'by')) {
        onOpenChatPatchExt(cur.params.id);
      }
    }, 900);

    /* ============================================================
       13. 暴露扩展 API（供未来剧情继续累加）
       ============================================================ */
    window.StoryExtension = {
      addMemoClue: addMemoClue,
      runLinShuangOpening: runLinShuangOpening,
      runLsPostChoice: runLsPostChoice,
      triggerS9Group: triggerS9Group,
      runScene9Group: runScene9Group,
      s9PostChoice: s9PostChoice,
      renderQuestion: renderQuestion,
      Q_DATA: Q_DATA,
      CHOICES: CHOICES
    };

    console.log('[story-extension v1.0] 已加载：临爽私聊 / s9 群聊 / 问卷');
  });
})();
