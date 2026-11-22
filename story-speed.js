/* ================================================================
   story-speed.js  v1.0
   消息速度统一补丁（与 story-patch.js / story-extension.js 并存）

   加载顺序（务必）：
     <script src="story-patch.js"></script>
     <script src="story-extension.js"></script>
     <script src="story-speed.js"></script>

   本次修复：
   1. 选择后对话太快 —— 重写 CHOICES.ls_opening / CHOICES.grp_s9
      的 a/b，所有 delay 乘上统一速度系数（默认 1.4x）
   2. 设置里找不到"消息显示速度" —— 在 设置 → 触感反馈 下面
      新增"消息显示速度"入口，1.0x ~ 2.0x 六档可选
   3. 未来加剧情的对话建议：需要变速的地方调用
      window.StorySpeed.ensureMsgP(cid, msg, baseDelay)
      即可自动按当前速度播放
   ================================================================ */
(function () {
  'use strict';

  function ready(fn) {
    if (window.StoryExtension &&
        window.StoryExtension.CHOICES &&
        window.StoryExtension.playLsPostChoice &&
        window.StoryExtension.playS9PostChoice &&
        typeof PAGES !== 'undefined' &&
        typeof state !== 'undefined' &&
        typeof Router !== 'undefined' &&
        typeof Toast !== 'undefined' &&
        typeof save !== 'undefined') {
      fn();
    } else {
      setTimeout(function () { ready(fn); }, 100);
    }
  }

  ready(function () {
    var EXT = window.StoryExtension;
    var CHOICES = EXT.CHOICES;

    /* ---- 初始速度值 ---- */
    if (!state.settings) state.settings = {};
    if (state.settings.msgSpeed === undefined) {
      state.settings.msgSpeed = 1.4;
      save();
    }

    function getSpeed() {
      var v = state.settings && state.settings.msgSpeed;
      return (typeof v === 'number' && v > 0) ? v : 1.4;
    }
    function _dl(base) { return Math.round(base * getSpeed()); }

    /* ---- 带速度的幂等消息（供本文件 & 未来剧情使用） ---- */
    async function ensureMsgP(cid, msg, baseDelay) {
      var chat = state.db.chats[cid];
      if (!chat) return;
      if (!Array.isArray(chat.messages)) chat.messages = [];
      var exists = chat.messages.some(function (m) {
        if (msg.type === 'system') return m.type === 'system' && m.text === msg.text;
        return m.from === msg.from && m.text === msg.text;
      });
      if (exists) return;
      if (baseDelay) await sleep(_dl(baseDelay));
      var m = Object.assign({ id: uid('m'), time: storyTime() }, msg);
      chat.messages.push(m);
      save();
      refreshChat(cid);
    }

    /* ============================================================
       重写 CHOICES.ls_opening
       ============================================================ */
    CHOICES.ls_opening = {
      async a() {
        var cid = 'ls';
        state.choice = null;
        flag('ls_stage', 3);
        save();
        await ensureMsgP(cid, { from: 'me', text: '话说回来，你觉得有没有觉得寒潮封校这件事很奇怪' }, 800);
        await ensureMsgP(cid, { from: '临爽', text: '是吗？小破中老整这种莫名其妙的东西，明明也没有很冷啊' }, 1600);
        await EXT.playLsPostChoice();
      },
      async b() {
        var cid = 'ls';
        state.choice = null;
        flag('ls_stage', 3);
        save();
        await ensureMsgP(cid, { from: 'me', text: '封楼期间欢迎你来412大吃特吃嗷' }, 800);
        await ensureMsgP(cid, { from: 'me', text: 'VVIP贵宾一位里边儿请～' }, 1200);
        await ensureMsgP(cid, { from: '临爽', text: '这老板恐怕是邓许吧' }, 1600);
        await ensureMsgP(cid, { from: '临爽', text: '你只能算个服务员哈哈哈哈' }, 1600);
        await ensureMsgP(cid, { from: 'me', text: '我去你的！' }, 1000);
        addTrust(['临爽'], 3);
        await ensureMsgP(cid, { type: 'system', text: trustNote(['临爽'], 3) }, 700);
        await sleep(_dl(700));
        await EXT.playLsPostChoice();
      }
    };

    /* ============================================================
       重写 CHOICES.grp_s9
       ============================================================ */
    CHOICES.grp_s9 = {
      async a() {
        var cid = 'by';
        state.choice = null;
        flag('s9_stage', 3);
        save();
        await ensureMsgP(cid, { from: 'me', text: '这个张夏夏，都不留校怎么还在留校群里苟着啊！' }, 800);
        await ensureMsgP(cid, { from: '张夏夏', text: '一线吃瓜～' }, 1600);
        await ensureMsgP(cid, { from: '周学姐', text: '我拉的，因为貌似她只能通过这个群和我们联系。' }, 1600);
        await ensureMsgP(cid, { from: '临爽', text: '挖什么金矿' }, 1600);
        await ensureMsgP(cid, { from: '张夏夏', text: '是这样的…封校那天我发现我联系不上你们任何一个人，直到看到论坛里有这个群的链接，我才好歹能和你们说上话！' }, 1800);
        await ensureMsgP(cid, { from: '张夏夏', text: '我似乎是一出校就被识别为"校外人员"了……总之珍惜吧！' }, 1600);
        await ensureMsgP(cid, { from: '苏青', text: '确实呢，我现在一想和校外的朋友联系就会弹出一个警告' }, 1600);
        await ensureMsgP(cid, { from: '沈敏', text: '对，好像是什么"寒潮期间禁止与校外人员通讯"，弱智极了' }, 1600);
        await ensureMsgP(cid, { from: 'me', text: '这不是把我们大家都囚禁在渠中了吗……切断一切外界联系' }, 1000);
        await ensureMsgP(cid, { from: '邓许', text: '寒潮真的至于这样吗？我不敢苟同' }, 1600);
        EXT.addMemoClue();
        await ensureMsgP(cid, { type: 'system', text: '［"线索：校外人员？"已自动记录进备忘录］' }, 800);
        await sleep(_dl(800));
        await EXT.playS9PostChoice();
      },
      async b() {
        var cid = 'by';
        state.choice = null;
        flag('s9_stage', 3);
        save();
        await ensureMsgP(cid, { from: 'me', text: '真羡慕你啊……' }, 800);
        await ensureMsgP(cid, { from: 'me', text: '我是真受不了这个雷霆规则了！' }, 1200);
        await ensureMsgP(cid, { from: '沈敏', text: '是啊，根本不是给人用的' }, 1600);
        await ensureMsgP(cid, { from: '临爽', text: 'md真的太痛苦了，我们完全就是被囚禁圈养在渠中的牲畜啊！' }, 1600);
        await ensureMsgP(cid, { from: '周学姐', text: '没有"们"。。。你自己是牲畜就够了。' }, 1600);
        await ensureMsgP(cid, { from: '临爽', text: '？' }, 1200);
        await ensureMsgP(cid, { from: '苏青', text: '太无聊了，姐姐我实在很想去7号楼找你们玩哦，奈何学校不让' }, 1600);
        await ensureMsgP(cid, { from: '苏青', text: '我也很无奈～' }, 1600);
        await ensureMsgP(cid, { from: '许双荞', text: '，，似乎你刚说了懒得出校门' }, 1600);
        await ensureMsgP(cid, { from: '张夏夏', text: '哈哈哈我看到你们转发的规则了……哎不是感觉怎么看都怪怪的啊但是' }, 1600);
        addTrust(['沈敏', '临爽'], 1);
        await ensureMsgP(cid, { type: 'system', text: trustNote(['沈敏', '临爽'], 1) }, 800);
        await sleep(_dl(800));
        await EXT.playS9PostChoice();
      }
    };

    /* ============================================================
       在设置页注入"消息显示速度"行
       ============================================================ */
    var prevSettings = PAGES.settings;
    PAGES.settings = function () {
      var def = prevSettings();
      var prevMount = def.mount;
      def.mount = function (root) {
        if (prevMount) prevMount(root);
        var vibrateRow = root.querySelector('[data-action="toggle-vibrate"]');
        if (vibrateRow && !root.querySelector('[data-action="open-msg-speed"]')) {
          vibrateRow.insertAdjacentHTML('afterend',
            '<div class="row" data-action="open-msg-speed">' +
              '<div class="r-main"><div class="r-title">消息显示速度</div><div class="r-sub">' + getSpeed().toFixed(1) + 'x</div></div>' +
              '<span class="chev-r">›</span>' +
            '</div>'
          );
        }
      };
      return def;
    };

    /* ============================================================
       速度设置页
       ============================================================ */
    var SPEED_OPTIONS = [
      { v: 1.0, label: '1.0x · 原速' },
      { v: 1.2, label: '1.2x · 稍快' },
      { v: 1.4, label: '1.4x · 推荐' },
      { v: 1.6, label: '1.6x · 慢速' },
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
            '<div class="px4 txt-xs txt-3 center mt3">数值越大，消息出现越慢。选项分支后的对话按此速度播放。</div>' +
          '</div>' +
        '</div>'
      };
    };

    /* ============================================================
       action 拦截
       ============================================================ */
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
        if (!isNaN(v)) {
          state.settings.msgSpeed = v;
          save();
          Toast.show('消息速度：' + v.toFixed(1) + 'x');
          Router.pop();
        }
        return;
      }
    }, true);

    /* ============================================================
       暴露给未来剧情使用
       ============================================================ */
    window.StorySpeed = {
      getSpeed: getSpeed,
      adjust: _dl,
      ensureMsgP: ensureMsgP,
      SPEED_OPTIONS: SPEED_OPTIONS
    };

    console.log('[story-speed v1.0] 已加载，当前速度：' + getSpeed() + 'x');
  });
})();
