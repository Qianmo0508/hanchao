/* ================================================================
   story-extension-2.js  v1.0
   剧情扩展·第二部（接 v2.2 结尾：钱逸时"只可惜论坛里那位会修东西
   的荞麦面老师还没进……"）

   本文件不覆盖 story-extension.js，只在其之上接管 huzhu_1.a 的结尾
   及之后所有新剧情。加载顺序：放在最后。

   主要内容：
   1. 重写 CHOICES.huzhu_1.a：保留原对话 + 结尾弹两项
      ①我好像知道她是谁 / ②要不去论坛问问
   2. 重写 CHOICES.huzhu_2：两个分支 + 共同后续 → 结伴选项
   3. CHOICES.huzhu_3：①好啊 / ②noway（含专属红包）
   4. 红包：可点击领取 → 加钱包账单 + 余额
   5. 系统公告 V9（修订版）：通过小渠 AI 公众号卡片跳转
   6. 北苑群 s11：临爽吐槽 + 顶部"入睡"按钮
   7. 入睡 → 渐黑 → 5/9 00:03 锁屏 → 弹临爽求助
   8. 临爽凌晨私聊 + 限时 10s 选项
   9. 三个分支：查看猫眼（黑屏）/ 不敢（黑屏）/ 超时装睡（正确）
   10. 装睡 → 渐黑 → 5/9 早上 07:00 锁屏 → 弹北苑群
   11. 早上 s12：沈敏出事 + ①问临爽 / ②睡不好
   12. 全程时间同步
   ================================================================ */
(function () {
  'use strict';

  function ready(fn) {
    var ok =
      typeof PAGES !== 'undefined' &&
      typeof Router !== 'undefined' &&
      typeof CursorGuide !== 'undefined' &&
      typeof NotifService !== 'undefined' &&
      typeof state !== 'undefined' &&
      typeof flag === 'function' &&
      typeof save === 'function' &&
      typeof render === 'function' &&
      typeof esc === 'function' &&
      typeof navBar === 'function' &&
      typeof Toast !== 'undefined' &&
      typeof ConfirmBox !== 'undefined' &&
      typeof sysNow === 'function' &&
      typeof fmtFull === 'function' &&
      typeof uid === 'function' &&
      typeof sleep === 'function' &&
      typeof CHOICES !== 'undefined' &&
      typeof Typewriter !== 'undefined' &&
      typeof refreshChat === 'function' &&
      typeof addTrust === 'function' &&
      typeof trustNote === 'function' &&
      typeof storyTime === 'function';
    if (ok) fn();
    else setTimeout(function () { ready(fn); }, 100);
  }

  ready(function () {

    /* ============================================================
       0. 样式
       ============================================================ */
    var st = document.createElement('style');
    st.textContent =
      '.redpacket-card{display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:12px;background:linear-gradient(135deg,#fa9d3b,#f5732b);color:#fff;box-shadow:0 2px 10px rgba(245,115,43,.3);max-width:280px;cursor:pointer;margin-top:2px}' +
      '.redpacket-card.opened{background:linear-gradient(135deg,#b8b8b8,#909090);cursor:default;opacity:.85}' +
      '.redpacket-card .rp-icon{font-size:28px;flex:0 0 auto}' +
      '.redpacket-card .rp-info{flex:1 1 auto;min-width:0}' +
      '.redpacket-card .rp-title{font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.redpacket-card .rp-desc{font-size:11px;opacity:.85;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.redpacket-card .rp-btn{font-size:12px;background:rgba(255,255,255,.24);padding:6px 12px;border-radius:20px;font-weight:600;white-space:nowrap}' +
      '.choice-bar.timed{border:2px solid var(--c-danger);background:rgba(229,72,77,.06)}' +
      '.timed-countdown{display:flex;align-items:center;justify-content:center;font-size:13px;color:var(--c-danger);font-weight:700;padding:6px 0 8px;letter-spacing:.1em;font-variant-numeric:tabular-nums}' +
      '.sleep-btn-top{position:absolute;top:calc(var(--sb-h) + env(safe-area-inset-top) + 6px);left:50%;transform:translateX(-50%);padding:10px 28px;border-radius:24px;background:var(--c-accent);color:#fff;border:none;font-size:15px;font-weight:700;cursor:pointer;z-index:350;box-shadow:0 4px 16px rgba(47,107,255,.4);animation:sleepBtnPulse 1.8s ease-in-out infinite}' +
      '@keyframes sleepBtnPulse{0%,100%{box-shadow:0 4px 16px rgba(47,107,255,.4)}50%{box-shadow:0 4px 24px rgba(47,107,255,.75)}}' +
      '.screen-fade{position:absolute;inset:0;background:#000;z-index:9998;pointer-events:auto;opacity:0;transition:opacity 800ms ease}' +
      '.screen-fade.dark{opacity:1}' +
      '.memo-step-text{font-size:15px;line-height:1.9;overflow-wrap:anywhere;white-space:pre-wrap;margin-bottom:14px}' +
      '.memo-step-btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 24px;border-radius:12px;background:var(--c-accent);color:#fff;border:none;font-size:14px;font-weight:600;cursor:pointer;margin:10px 0}' +
      '.notice-v2-doc{margin:var(--sp-3);padding:var(--sp-5) var(--sp-4);background:var(--c-card);border-radius:var(--r-l);box-shadow:var(--sh-1);min-width:0}' +
      '.notice-v2-doc h2{font-size:17px;text-align:center;margin:0 0 var(--sp-3);line-height:1.5;overflow-wrap:anywhere}' +
      '.notice-v2-doc .nv2-meta{font-size:var(--fs-xs);color:var(--c-text-2);text-align:center;line-height:1.9;padding-bottom:var(--sp-3);border-bottom:1px dashed var(--c-line);margin-bottom:var(--sp-4);overflow-wrap:anywhere}' +
      '.notice-v2-doc .nv2-sec{font-size:14.5px;line-height:1.85;margin-bottom:var(--sp-3);overflow-wrap:anywhere}' +
      '.notice-v2-doc .nv2-sec.red{color:var(--c-danger);font-weight:600}' +
      '.notice-v2-doc .nv2-sign{text-align:right;font-size:var(--fs-s);color:var(--c-text-2);line-height:1.9;margin-top:var(--sp-5);padding-top:var(--sp-3);border-top:1px dashed var(--c-line)}' +
      '@keyframes wxg-blink2{0%,100%{opacity:1}50%{opacity:.2}}';
    document.head.appendChild(st);

    /* ============================================================
       1. 状态兜底
       ============================================================ */
    function extEnsure() {
      if (!state.flags) state.flags = {};
      if (!state.db) state.db = {};
      if (!state.db.memos) state.db.memos = [];
      if (!state.db.chats) state.db.chats = {};
      if (!Array.isArray(state.db.friendRequests)) state.db.friendRequests = [];
    }
    extEnsure();

    var _lock = (window.StoryExtension && window.StoryExtension._playingLock) || {};

    /* ============================================================
       2. 工具
       ============================================================ */
    async function ensureMsgP(cid, msg, baseDelay) {
      if (window.StorySpeed && typeof window.StorySpeed.ensureMsgP === 'function') {
        return window.StorySpeed.ensureMsgP(cid, msg, baseDelay);
      }
      var chat = state.db.chats[cid];
      if (!chat) return;
      if (!Array.isArray(chat.messages)) chat.messages = [];
      var exists = chat.messages.some(function (m) {
        if (msg.type === 'system') return m.type === 'system' && m.text === msg.text;
        if (msg.type === 'card') return m.type === 'card' && m.title === msg.title && m.desc === msg.desc;
        return m.from === msg.from && m.text === msg.text;
      });
      if (exists) return;
      if (baseDelay) await sleep(baseDelay);
      chat.messages.push(Object.assign({ id: uid('m'), time: storyTime() }, msg));
      save();
      refreshChat(cid);
    }
    function _dl(base) {
      if (window.StorySpeed && typeof window.StorySpeed.adjust === 'function') {
        return window.StorySpeed.adjust(base);
      }
      return Math.round(base * 1.3);
    }
    function setSysTimeSafe(dateStr) {
      var d = new Date(dateStr);
      if (isNaN(d.getTime())) return;
      state.clockBase = d.getTime();
      state.clockStartReal = Date.now();
      save();
      try { if (typeof renderStatusBar === 'function') renderStatusBar(); } catch (e) {}
    }

    /* ============================================================
       3. huzhu_1.a —— 完整重写（保留原对话 + 结尾弹两项）
       ============================================================ */
    CHOICES.huzhu_1 = {
      async a() {
        if (_lock['huzhu']) return;
        _lock['huzhu'] = true;
        try {
          var cid = 'huzhu';
          state.choice = null;
          flag('huzhu_stage', 5);
          save();
          refreshChat(cid);
          await ensureMsgP(cid, { from: 'me', text: '……看来我真该改个名了' }, 800);
          await ensureMsgP(cid, { from: 'me', text: '我是她室友陈默，也是412的，说来话长我就长话短说了' }, 900);
          await ensureMsgP(cid, { from: 'me', text: '我借用了她的手机，就这样' }, 800);
          await ensureMsgP(cid, { from: '钱逸时', text: '啊、啊噢哦哦哦……' }, 1500);
          await ensureMsgP(cid, { from: '钱逸时', text: '骚瑞骚瑞，那你也是女寝的吧，同学你好' }, 1500);
          await ensureMsgP(cid, { from: '钱逸时', text: '只可惜论坛里那位会修东西的荞麦面老师还没进……' }, 1500);
          await sleep(_dl(600));
          state.choice = { chatId: cid, nodeId: 'huzhu_2', options: [
            { k: 'a', label: '①我好像知道她是谁' },
            { k: 'b', label: '②要不去论坛问问' }
          ]};
          save();
          refreshChat(cid);
        } finally { _lock['huzhu'] = false; }
      }
    };

    /* ============================================================
       4. huzhu_2 —— 两个分支
       ============================================================ */
    CHOICES.huzhu_2 = {
      async a() {
        if (_lock['huzhu']) return;
        _lock['huzhu'] = true;
        try {
          var cid = 'huzhu';
          state.choice = null;
          flag('huzhu_2_key', 'a');
          flag('huzhu_stage', 6);
          save();
          refreshChat(cid);
          await ensureMsgP(cid, { from: 'me', text: '这个名字，我好像知道她是谁了' }, 800);
          await ensureMsgP(cid, { from: '周未', text: '我好像，也知道她是谁了' }, 1500);
          await ensureMsgP(cid, { from: '钱逸时', text: '？？' }, 1200);
          await ensureMsgP(cid, { from: '钱逸时', text: '哎你两别当谜语人！' }, 1500);
          await ensureMsgP(cid, { from: 'me', text: '是312的许双荞吧，她在我们群呢' }, 800);
          await ensureMsgP(cid, { from: '周未', text: '听说好多人念错她名字，说是不认识，结果一提荞麦面，嚯全都会读了…' }, 1700);
          await ensureMsgP(cid, { from: 'me', text: '原来这个网名是这么来的' }, 800);
          await ensureMsgP(cid, { from: '钱逸时', text: '嗨，太棒了我们终于知道她的网名来源了这对我们楼的停电大有帮助' }, 1700);
          await ensureMsgP(cid, { from: '周未', text: '看得出你怨气比鬼都重了' }, 1500);
          await ensureMsgP(cid, { from: 'me', text: '但我们有荞麦面老师的联系方式' }, 800);
          if (!state.db.chats.huzhu.messages.some(function (m) { return m.type === 'system' && m.text === '“许双荞”被拉入群聊'; })) {
            state.db.chats.huzhu.messages.push({
              id: uid('m'), type: 'system', text: '“许双荞”被拉入群聊', time: storyTime()
            });
            save();
            refreshChat(cid);
          }
          await sleep(_dl(600));
          await ensureMsgP(cid, { from: '许双荞', text: '嗯？' }, 1400);
          await ensureMsgP(cid, { from: '钱逸时', text: '诶呦' }, 1200);
          await ensureMsgP(cid, { from: '钱逸时', text: '我都忘了这一茬了' }, 1500);
          await ensureMsgP(cid, { from: '钱逸时', text: '谢谢小陈同学送来的修理工一位🫶' }, 1500);
          addTrust(['钱逸时'], 5);
          await ensureMsgP(cid, { type: 'system', text: trustNote(['钱逸时'], 5) }, 800);
          await ensureMsgP(cid, { from: '周未', text: '？怎么不谢我' }, 1500);
          await continueAfterWxg();
        } finally { _lock['huzhu'] = false; }
      },
      async b() {
        if (_lock['huzhu']) return;
        _lock['huzhu'] = true;
        try {
          var cid = 'huzhu';
          state.choice = null;
          flag('huzhu_2_key', 'b');
          flag('huzhu_stage', 6);
          save();
          refreshChat(cid);
          await ensureMsgP(cid, { from: 'me', text: '我也不知道是谁，要不要上论坛问问？' }, 800);
          await ensureMsgP(cid, { from: '钱逸时', text: '昂，嗨呀反正明天才能出楼呢，什么时候进群无所吊谓～' }, 1700);
          await ensureMsgP(cid, { from: '周未', text: '我拉她吧，这ID很耳熟' }, 1500);
          await ensureMsgP(cid, { from: '周未', text: '不过陈默，许双荞貌似就住你们楼上吧' }, 1700);
          await ensureMsgP(cid, { from: 'me', text: '原来是她啊！' }, 800);
          await ensureMsgP(cid, { from: '钱逸时', text: 'eng？这不合理啊兄弟，周末你怎么谁都认识啊' }, 1700);
          await ensureMsgP(cid, { from: 'me', text: '忘说了，我俩同班' }, 800);
          if (!state.db.chats.huzhu.messages.some(function (m) { return m.type === 'system' && m.text === '“许双荞”被拉入群聊'; })) {
            state.db.chats.huzhu.messages.push({
              id: uid('m'), type: 'system', text: '“许双荞”被拉入群聊', time: storyTime()
            });
            save();
            refreshChat(cid);
          }
          await sleep(_dl(600));
          await ensureMsgP(cid, { from: '周未', text: '拉了，还有我叫周未…' }, 1500);
          await ensureMsgP(cid, { from: '钱逸时', text: '如厕后记得洗手，周末同学' }, 1500);
          await ensureMsgP(cid, { from: '周未', text: '？' }, 1200);
          await ensureMsgP(cid, { from: 'me', text: '？' }, 1000);
          addTrust(['周未'], 5);
          await ensureMsgP(cid, { type: 'system', text: trustNote(['周未'], 5) }, 800);
          await continueAfterWxg();
        } finally { _lock['huzhu'] = false; }
      }
    };

    /* ============================================================
       5. continueAfterWxg —— 共同后续 → 结伴选项
       ============================================================ */
    async function continueAfterWxg() {
      if (_lock['huzhu_after_wxg']) return;
      _lock['huzhu_after_wxg'] = true;
      try {
        var cid = 'huzhu';
        await ensureMsgP(cid, { from: '许双荞', text: '别吵' }, 1400);
        await ensureMsgP(cid, { from: '许双荞', text: '@钱逸时 肇事逃逸是你啊？' }, 1500);
        await ensureMsgP(cid, { from: '钱逸时', text: '认识哥？:3' }, 1400);
        await ensureMsgP(cid, { from: '苏青', text: '谁不认识你了大富二代^^' }, 1500);
        await ensureMsgP(cid, { from: '钱逸时', text: '卧槽姐你啥时候进来的' }, 1500);
        await ensureMsgP(cid, { from: 'me', text: '苏姐？' }, 1200);
        await ensureMsgP(cid, { from: '苏青', text: '你刚一在论坛发邀请就进喽～多亏周周喊我' }, 1700);
        await ensureMsgP(cid, { from: '许双荞', text: '不说有的没的了，明早门禁开放了我就去你们3号楼修电闸' }, 1800);
        await ensureMsgP(cid, { from: '钱逸时', text: '❤️' }, 1200);
        await ensureMsgP(cid, { from: '许双荞', text: '但前段时间不是说最好结伴而行么，有北苑的愿意陪我去吗' }, 1800);
        await ensureMsgP(cid, { from: '周未', text: '我并非北苑的' }, 1400);
        await ensureMsgP(cid, { from: '许双荞', text: '似乎零人问你' }, 1400);
        await ensureMsgP(cid, { from: '苏青', text: '别看我，姐姐我这两天宅在宿舍都没怎么打扮，是不可能去男生楼的哦' }, 1800);
        await ensureMsgP(cid, { from: '苏青', text: '去问问小陈默？' }, 1400);
        await sleep(_dl(600));
        flag('huzhu_stage', 7);
        save();
        state.choice = { chatId: cid, nodeId: 'huzhu_3', options: [
          { k: 'a', label: '①好啊，我和你去' },
          { k: 'b', label: '②noway，不想出门' }
        ]};
        save();
        refreshChat(cid);
      } finally { _lock['huzhu_after_wxg'] = false; }
    }

    /* ============================================================
       6. huzhu_3 —— 结伴选项
       ============================================================ */
    CHOICES.huzhu_3 = {
      async a() {
        if (_lock['huzhu']) return;
        _lock['huzhu'] = true;
        try {
          var cid = 'huzhu';
          state.choice = null;
          flag('huzhu_3_key', 'a');
          flag('huzhu_stage', 8);
          save();
          refreshChat(cid);
          await ensureMsgP(cid, { from: 'me', text: '好啊，明天我跟你一块去东苑' }, 800);
          await ensureMsgP(cid, { from: 'me', text: '到时我去楼下找你吧' }, 900);
          await ensureMsgP(cid, { from: '许双荞', text: 'OK谢谢你，那就这么定了！' }, 1500);
          await ensureMsgP(cid, { from: '钱逸时', text: '面基吗有点意思～' }, 1500);
          await ensureMsgP(cid, { from: '钱逸时', text: '噢对，@周未 哥们儿你到时候来我寝吧！' }, 1700);
          await ensureMsgP(cid, { from: '苏青', text: '让我猜猜，你一定不是因为怕黑吧^^' }, 1700);
          await ensureMsgP(cid, { from: '周未', text: '完美避开正确答案' }, 1500);
          await ensureMsgP(cid, { from: '钱逸时', text: '。' }, 1200);
          addTrust(['许双荞'], 3);
          await ensureMsgP(cid, { type: 'system', text: trustNote(['许双荞'], 3) }, 800);
          flag('huzhu_done', true);
          save();
          await sleep(_dl(800));
          triggerNoticeV9();
        } finally { _lock['huzhu'] = false; }
      },
      async b() {
        if (_lock['huzhu']) return;
        _lock['huzhu'] = true;
        try {
          var cid = 'huzhu';
          state.choice = null;
          flag('huzhu_3_key', 'b');
          flag('huzhu_stage', 8);
          save();
          refreshChat(cid);
          await ensureMsgP(cid, { from: 'me', text: 'noway' }, 800);
          await ensureMsgP(cid, { from: 'me', text: '我也不想出门，我也要学苏青姐在宿舍躺着' }, 900);
          await ensureMsgP(cid, { from: '许双荞', text: '那也行' }, 1400);
          await ensureMsgP(cid, { from: '钱逸时', text: '卧槽别啊，人多力量大，来嘛🫶' }, 1600);
          await ensureMsgP(cid, { from: '周未', text: '你是不就是想见一面而已。。' }, 1500);
          await ensureMsgP(cid, { from: '钱逸时', text: '哎不重要，那为了小荞老师的人身安全着想也最好一块来嘛' }, 1800);
          await ensureMsgP(cid, { from: '周未', text: '小乔是什么鬼？？' }, 1500);
          await ensureMsgP(cid, { from: '许双荞', text: '。小荞又是什么鬼' }, 1500);
          await ensureMsgP(cid, { from: 'me', text: '哇默契' }, 800);
          await ensureMsgP(cid, { from: 'me', text: '唉，那就，勉为其难地过去吧' }, 900);
          await ensureMsgP(cid, { from: 'me', text: '这群主怎么也不意思意思' }, 800);
          // 红包消息
          var rpId = 'rp_huzhu_1000';
          if (!state.db.chats.huzhu.messages.some(function (m) { return m.type === 'redpacket' && m.rpId === rpId; })) {
            state.db.chats.huzhu.messages.push({
              id: uid('m'),
              type: 'redpacket',
              from: '钱逸时',
              rpId: rpId,
              amount: 1000,
              title: '恭喜发财，大吉大利',
              time: storyTime()
            });
            save();
            refreshChat(cid);
          }
          await ensureMsgP(cid, { from: '钱逸时', text: 'OK一次也发不了太多' }, 1500);
          flag('huzhu_redpacket_pending', true);
          save();
          await sleep(_dl(600));
          CursorGuide.show('[data-action="open-redpacket"]', '领取红包');
        } finally { _lock['huzhu'] = false; }
      }
    };

    /* ============================================================
       7. 红包领取
       ============================================================ */
    function addRedpacketToWallet() {
      if (flag('redpacket_wallet_added_rp_huzhu_1000')) return;
      var DATA = window.GameAPI && window.GameAPI.DATA;
      if (!DATA) return;
      if (!DATA.db.misc) DATA.db.misc = {};
      if (!DATA.db.misc.wallet) DATA.db.misc.wallet = { balance: '￥0', bills: [] };
      if (!Array.isArray(DATA.db.misc.wallet.bills)) DATA.db.misc.wallet.bills = [];
      DATA.db.misc.wallet.bills.unshift({
        t: '红包（钱逸时）',
        a: '+￥1000.00',
        d: fmtFull(sysNow())
      });
      var bal = parseFloat(String(DATA.db.misc.wallet.balance || '￥0').replace('￥', '')) || 0;
      DATA.db.misc.wallet.balance = '￥' + (bal + 1000).toFixed(2);
      flag('redpacket_wallet_added_rp_huzhu_1000', true);
      save();
    }

    // 初始化：如果 flag 为真但 DATA 里没有账单（刷新后）
    if (flag('redpacket_wallet_added_rp_huzhu_1000')) {
      var _D = window.GameAPI && window.GameAPI.DATA;
      if (_D && _D.db && _D.db.misc && _D.db.misc.wallet && Array.isArray(_D.db.misc.wallet.bills)) {
        if (!_D.db.misc.wallet.bills.some(function (b) { return b.t === '红包（钱逸时）' && b.a === '+￥1000.00'; })) {
          var _bal = parseFloat(String(_D.db.misc.wallet.balance || '￥0').replace('￥', '')) || 0;
          _D.db.misc.wallet.bills.unshift({ t: '红包（钱逸时）', a: '+￥1000.00', d: fmtFull(sysNow()) });
          _D.db.misc.wallet.balance = '￥' + (_bal + 1000).toFixed(2);
        }
      }
    }

    async function handleOpenRedpacket(rid) {
      if (flag('redpacket_opened_' + rid)) {
        Toast.show('已领取过此红包');
        return;
      }
      flag('redpacket_opened_' + rid, true);
      save();
      addRedpacketToWallet();
      CursorGuide.hide();
      var cid = 'huzhu';
      if (!state.db.chats[cid].messages.some(function (m) {
        return m.type === 'system' && m.text === '你领取了“钱逸时”的红包';
      })) {
        state.db.chats[cid].messages.push({
          id: uid('m'), type: 'system', text: '你领取了“钱逸时”的红包', time: storyTime()
        });
        save();
      }
      refreshChat(cid);
      if (flag('huzhu_redpacket_pending') && !_lock['huzhu_rp_cont']) {
        flag('huzhu_redpacket_pending', false);
        save();
        setTimeout(function () { continueAfterRedpacket(); }, 700);
      }
    }

    async function continueAfterRedpacket() {
      if (_lock['huzhu_rp_cont']) return;
      _lock['huzhu_rp_cont'] = true;
      try {
        var cid = 'huzhu';
        await ensureMsgP(cid, { from: '苏青', text: '草，怎么还是专属红包，我领不了' }, 1600);
        await ensureMsgP(cid, { from: '周未', text: '我是一个愤怒的普通人，@钱逸时 现在要小心了' }, 1700);
        await ensureMsgP(cid, { from: '许双荞', text: '。到底是谁修电闸' }, 1500);
        await ensureMsgP(cid, { from: '钱逸时', text: '错了错了错了，明天每个人找我领超级大红包，现在我限额了…万恶的渠中校园钱包还特么有限额' }, 1900);
        addTrust(['钱逸时'], 3);
        await ensureMsgP(cid, { type: 'system', text: trustNote(['钱逸时'], 3) }, 800);
        flag('huzhu_done', true);
        save();
        await sleep(_dl(800));
        triggerNoticeV9();
      } finally { _lock['huzhu_rp_cont'] = false; }
    }

    /* ============================================================
       8. 系统公告 V9
       ============================================================ */
    function triggerNoticeV9() {
      if (flag('notice_v9_triggered')) return;
      flag('notice_v9_triggered', true);
      setSysTimeSafe('2025-05-08T20:00:00');
      // 在小渠 AI 里加公告卡片
      if (!state.db.chats.xiaoqu) {
        state.db.chats.xiaoqu = { id: 'xiaoqu', type: 'ai', name: '小渠【AI】', avatar: '🤖', canSend: false, warn: '寒潮期间禁止与校外人员通讯', messages: [] };
      }
      if (!state.db.chats.xiaoqu.messages.some(function (m) {
        return m.type === 'card' && m.title === '系统公告' && (m.desc || '').indexOf('修订版') >= 0;
      })) {
        state.db.chats.xiaoqu.messages.push({
          id: uid('m'),
          type: 'card',
          title: '系统公告',
          desc: '《寒潮期间宿舍管理条例（修订版）》已发布，点击查看全文',
          time: '2025-05-08 20:00'
        });
        save();
      }
      NotifService.push({
        id: 'n_notice_v9',
        title: '《寒潮期间宿舍管理条例》已更新',
        detail: '点击查看详情',
        target: { page: 'noticeV2', params: {} }
      });
    }

    /* PAGES.noticeV2 */
    PAGES.noticeV2 = function () {
      var sections = [
        { text: '寒潮持续，现更新宿舍管理条例如下，请遵照执行。原条例同时废止。' },
        { no: '1.', text: '每日 22:30 统一熄灯，23:00 后不得串寝、喧哗，请按时归寝。' },
        { no: '2.', text: '闸机一人一卡，严禁尾随代刷。识别异常请到值班室登记，勿反复尝试。' },
        { no: '3.', text: '夜间听到敲门声，先看猫眼。门外无人时，不必开门，也不必回应。' },
        { no: '4.', text: '0:00 后请立刻就寝睡觉。请确保你的眼睛闭上，并专注于入眠。不要看时间，不要听门外。', red: true },
        { no: '6.', text: '0:00 后若室友与你说话，请勿回答；次日再确认其是否说过。' },
        { no: '7.', text: '突发停电请留在寝室等待，勿去配电间，勿用手机照向楼道。' },
        { no: '8.', text: '校园网仅保留校内服务，请勿以非官方方式连接校外网络。' },
        { no: '9.', text: '发现异常请报告宿管，并记录时间、位置及持续时长。若有人叫你的名字且来自寝室外，请勿应答。' },
        { no: '10.', text: '请相互关照，保持积极心态。焦虑失眠可通过校园通预约心理咨询。' }
      ];
      var secs = sections.map(function (s) {
        return '<div class="nv2-sec ' + (s.red ? 'red' : '') + '">' +
          (s.no ? '<b>' + esc(s.no) + '</b> ' : '') + esc(s.text) +
        '</div>';
      }).join('');
      return {
        html: '<div class="page">' +
          navBar('系统公告') +
          '<div class="page-body">' +
            '<div class="notice-v2-doc">' +
              '<h2>《寒潮期间宿舍管理条例（修订版）》</h2>' +
              '<div class="nv2-meta">' +
                '渠京第一中学·校园通系统公告<br>' +
                '发布单位：学生工作处（小渠自动发布）<br>' +
                '文号：渠中〔2025〕9 号<br>' +
                '发布日期：2025 年 5 月 8 日 20:00' +
              '</div>' +
              secs +
              '<div class="nv2-sign">渠京第一中学 学生处<br>2025 年 5 月 8 日</div>' +
            '</div>' +
            '<div class="px4 txt-xs txt-3 center" style="padding-bottom:var(--sp-6);">以上条例自发布之日起施行。寒潮终将过去，感谢同学们的理解与配合。</div>' +
          '</div>' +
        '</div>',
        mount: function () {
          if (!flag('notice_v9_read')) {
            flag('notice_v9_read', true);
            save();
            setTimeout(function () { triggerS11(); }, 2500);
          }
        }
      };
    };

    /* 公告卡片点击跳转 */
    window.addEventListener('click', function (e) {
      var el = e.target.closest('[data-action="gzh-card"]');
      if (!el) return;
      var desc = el.querySelector('.g-desc');
      if (desc && desc.textContent.indexOf('修订版') >= 0) {
        e.stopPropagation();
        e.preventDefault();
        Router.push('noticeV2');
      }
    }, true);

    /* ============================================================
       9. 北苑群 s11
       ============================================================ */
    function triggerS11() {
      if (flag('s11_triggered')) return;
      flag('s11_triggered', true);
      flag('s11_pending', true);
      flag('s11_notified', true);
      setSysTimeSafe('2025-05-08T20:30:00');
      var byChat = state.db.chats.by;
      if (byChat && !byChat.messages.some(function (m) {
        return m.from === '临爽' && m.text === '我去别搞又有新的私人规则了';
      })) {
        byChat.messages.push({ id: uid('m'), from: '临爽', text: '我去别搞又有新的私人规则了', time: storyTime() });
        save();
      }
      NotifService.push({
        id: 'n_s11',
        title: '北苑留校女生群',
        detail: '临爽：我去别搞又有新的私人规则了',
        target: { page: 'chat', params: { id: 'by' } }
      });
    }

    async function playS11Group() {
      if (_lock['by_s11']) return;
      _lock['by_s11'] = true;
      flag('s11_stage', 1);
      save();
      try {
        var cid = 'by';
        await ensureMsgP(cid, { from: '沈敏', text: '看到了。。零点必须睡觉是个什么鬼规则啊' }, 1500);
        await ensureMsgP(cid, { from: '临爽', text: '根本没有这样的规则！' }, 1500);
        await ensureMsgP(cid, { from: '许双荞', text: '你只是怕了' }, 1400);
        await ensureMsgP(cid, { from: '周学姐', text: '这tm谁不怕' }, 1500);
        await ensureMsgP(cid, { from: '周学姐', text: '理论上这根本做不到啊，人不可能强制自己睡着。' }, 1800);
        await ensureMsgP(cid, { from: '张夏夏', text: '对啊……我现在放假了都一点保底睡呢，不熬夜算发挥失常' }, 1800);
        await ensureMsgP(cid, { from: '临爽', text: '还是那句话，真。。。羡慕。。。你啊。。。' }, 1700);
        await ensureMsgP(cid, { from: '苏青', text: '既然这样的话，我建议你们都早点上床酝酿一下睡意咯' }, 1800);
        await ensureMsgP(cid, { from: '邓许', text: '对，时间差不多了，大家别聊天了，越聊越精神' }, 1700);
        flag('s11_stage', 2);
        flag('s11_done', true);
        flag('s11_sleep_ready', true);
        save();
        await sleep(_dl(600));
        CursorGuide.show('[data-action="do-sleep"]', '提前上床躺一会吧');
      } finally { _lock['by_s11'] = false; }
    }

    /* ============================================================
       10. 入睡 → 凌晨
       ============================================================ */
    async function doSleep() {
      if (_lock['sleep']) return;
      _lock['sleep'] = true;
      try {
        CursorGuide.hide();
        flag('s11_sleep_ready', false);
        flag('sleep_started', true);
        save();
        var layers = document.getElementById('layers');
        var fade = document.createElement('div');
        fade.className = 'screen-fade';
        fade.style.opacity = '0';
        layers.appendChild(fade);
        await sleep(60);
        fade.classList.add('dark');
        fade.style.opacity = '1';
        await sleep(1100);
        // 设置时间为 5/9 00:03
        setSysTimeSafe('2025-05-09T00:03:00');
        // 切锁屏
        Router.root('lock');
        await sleep(500);
        // 渐亮
        fade.style.opacity = '0';
        await sleep(800);
        fade.remove();
        // 弹临爽通知
        flag('night_active', true);
        flag('night_stage', 0);
        save();
        var lsChat = state.db.chats.ls;
        if (lsChat && !lsChat.messages.some(function (m) { return m.text === '陈默...我宿舍有人在敲门'; })) {
          lsChat.messages.push({
            id: uid('m'), from: '临爽', text: '陈默...我宿舍有人在敲门', time: '2025-05-09 00:03'
          });
          save();
        }
        NotifService.push({
          id: 'n_night_ls',
          title: '临爽-北苑411',
          detail: '临爽：陈默...我宿舍有人在敲门',
          target: { page: 'chat', params: { id: 'ls' } }
        });
      } finally { _lock['sleep'] = false; }
    }

    /* ============================================================
       11. 凌晨私聊 + 限时选项
       ============================================================ */
    async function playNightLs() {
      if (_lock['night_ls']) return;
      _lock['night_ls'] = true;
      flag('night_stage', 1);
      save();
      try {
        var cid = 'ls';
        await ensureMsgP(cid, { from: '临爽', text: '你听到了吗？' }, 1500);
        await ensureMsgP(cid, { from: '临爽', text: '我不敢下去看…你能帮我从猫眼里看一眼吗？？' }, 1700);
        await ensureMsgP(cid, { from: '临爽', text: '求你了！！你一定还没睡对吧' }, 1500);
        await sleep(_dl(800));
        flag('night_stage', 2);
        save();
        state.choice = {
          chatId: cid, nodeId: 'night_ls',
          timeLimit: 10000,
          onTimeout: 'c',
          options: [
            { k: 'a', label: '①好，我帮你看看' },
            { k: 'b', label: '②抱歉，我也不太敢' }
          ]
        };
        save();
        refreshChat(cid);
        startNightCountdown(10000);
      } finally { _lock['night_ls'] = false; }
    }

    var _nightCountdownTimer = null;
    function startNightCountdown(total) {
      if (_nightCountdownTimer) clearInterval(_nightCountdownTimer);
      var endTime = Date.now() + total;
      _nightCountdownTimer = setInterval(function () {
        var remain = endTime - Date.now();
        var el = document.getElementById('timed-countdown');
        if (!el) { clearInterval(_nightCountdownTimer); return; }
        if (remain <= 0) {
          clearInterval(_nightCountdownTimer);
          _nightCountdownTimer = null;
          if (el) el.textContent = '超时';
          handleNightTimeout();
          return;
        }
        el.textContent = Math.ceil(remain / 1000) + 's';
      }, 100);
    }

    function handleNightTimeout() {
      if (flag('night_choice_made')) return;
      flag('night_choice_made', 'sleep');
      save();
      if (CHOICES.night_ls && CHOICES.night_ls.c) {
        try { CHOICES.night_ls.c(); } catch (e) { console.error(e); }
      }
    }

    /* 3 个分支 */
    CHOICES.night_ls = {
      async a() {
        if (flag('night_choice_made')) return;
        flag('night_choice_made', 'a');
        save();
        if (_nightCountdownTimer) { clearInterval(_nightCountdownTimer); _nightCountdownTimer = null; }
        var cid = 'ls';
        state.choice = null;
        save();
        refreshChat(cid);
        await ensureMsgP(cid, { from: 'me', text: '好，我这就过去帮你看看，别害怕' }, 800);
        await sleep(_dl(600));
        // 生成夜间备忘录1
        createNight1Memo();
        // 指引进备忘录
        Router.root('home');
        setTimeout(function () {
          CursorGuide.show('[data-app="memos"]', '去备忘录看看');
        }, 800);
      },
      async b() {
        if (flag('night_choice_made')) return;
        flag('night_choice_made', 'b');
        save();
        if (_nightCountdownTimer) { clearInterval(_nightCountdownTimer); _nightCountdownTimer = null; }
        var cid = 'ls';
        state.choice = null;
        save();
        refreshChat(cid);
        await ensureMsgP(cid, { from: 'me', text: '真的真的抱歉，我也不敢' }, 800);
        await ensureMsgP(cid, { from: '临爽', text: '……' }, 1500);
        await ensureMsgP(cid, { from: '临爽', text: '我听到开门声了' }, 1500);
        await ensureMsgP(cid, { from: '临爽', text: '我好害怕' }, 1500);
        // 红字逐个显示"临爽：我进来了。"
        await typewriteRedMsg('ls', '临爽', '我进来了。');
        await sleep(_dl(800));
        await showNightViolation();
      },
      async c() {
        if (flag('night_choice_made') && flag('night_choice_made') !== 'sleep') return;
        flag('night_choice_made', 'sleep');
        save();
        if (_nightCountdownTimer) { clearInterval(_nightCountdownTimer); _nightCountdownTimer = null; }
        state.choice = null;
        save();
        refreshChat('ls');
        await sleep(_dl(600));
        // 小渠弹窗
        NotifService.push({
          id: 'n_night_xiaoqu',
          title: '小渠',
          detail: '你……真的睡了？',
          target: { page: 'memos', params: {} }
        });
        await sleep(_dl(1200));
        // 生成夜间备忘录2（装睡）
        createNight2Memo();
        Router.root('home');
        setTimeout(function () {
          CursorGuide.show('[data-app="memos"]', '去备忘录看看');
        }, 800);
      }
    };

    async function typewriteRedMsg(cid, from, text) {
      var chat = state.db.chats[cid];
      if (!chat) return;
      var tmpId = 'tmp_red_' + Date.now();
      if (!Array.isArray(chat.messages)) chat.messages = [];
      chat.messages.push({ id: tmpId, from: from, text: '', time: storyTime(), isRed: true });
      save();
      refreshChat(cid);
      for (var i = 1; i <= text.length; i++) {
        var idx = chat.messages.findIndex(function (m) { return m.id === tmpId; });
        if (idx < 0) return;
        chat.messages[idx].text = text.slice(0, i);
        save();
        refreshChat(cid);
        await sleep(180);
      }
      var idx2 = chat.messages.findIndex(function (m) { return m.id === tmpId; });
      if (idx2 >= 0) chat.messages[idx2].id = uid('m');
      save();
    }

    /* ============================================================
       12. 夜间备忘录
       ============================================================ */
    function createNight1Memo() {
      if (state.db.memos.some(function (m) { return m.id === 'night1'; })) return;
      state.db.memos.push({
        id: 'night1',
        title: '夜间记录·1',
        type: 'night_scene',
        time: fmtFull(sysNow()),
        steps: [
          {
            text: '你小声下了床，没惊动邓许。奇怪的是，此时敲门声似乎越来越大了，就好像移动到了你门前一样。',
            speed: 50,
            button: '查看猫眼',
            nextTrigger: 'night1Cat'
          },
          {
            text: '那敲门声，真正敲的就是412的宿舍门。',
            color: 'red',
            speed: 80,
            delay: 800,
            nextTrigger: 'night1Red'
          },
          {
            text: '你 对 上 了 那 人 的 眼 睛 。\n\n是 临 爽。',
            color: 'red',
            large: true,
            speed: 320,
            delay: 800,
            nextTrigger: 'night1Violation'
          }
        ]
      });
      save();
    }

    function createNight2Memo() {
      if (state.db.memos.some(function (m) { return m.id === 'night2'; })) return;
      state.db.memos.push({
        id: 'night2',
        title: '夜间记录·2',
        type: 'night_scene',
        time: fmtFull(sysNow()),
        steps: [
          {
            text: '对不起，临爽，我必须按照规则装睡…或者，对面发消息求助的人，根本就不是我的同学临爽了。\n\n无论如何，现在赶紧睡觉吧，否则早晚会被发现。\n\n明天一切都会好起来的……但愿吧。',
            speed: 55,
            button: '入睡',
            nextTrigger: 'nightSleep'
          }
        ]
      });
      save();
    }

    /* night 场景的全局触发函数 */
    window.night1Cat = function () {
      // 猫眼查看后，备忘录会自己进入 step 1（红字），无需额外操作
      // 但可以弹一个小渠通知
      setTimeout(function () {
        NotifService.push({
          id: 'n_night_cat_xiaoqu',
          title: '小渠',
          detail: '你果然还没睡。',
          target: { page: 'memos', params: {} }
        });
      }, 1500);
    };
    window.night1Red = function () {
      // 红字大字后，触发违规
    };
    window.night1Violation = async function () {
      if (flag('night_violation_done')) return;
      flag('night_violation_done', true);
      save();
      await sleep(_dl(700));
      NotifService.push({
        id: 'n_night_violation',
        title: '系统通知',
        detail: '您已违反第4条规则，您的学藉已注销。',
        target: null
      });
      await sleep(_dl(1500));
      // 黑屏"我 进 来 了。"
      showFinalViolation('我 进 来 了。');
    };
    window.nightSleep = async function () {
      if (flag('night_sleep_done')) return;
      flag('night_sleep_done', true);
      save();
      // 渐黑
      var layers = document.getElementById('layers');
      var fade = document.createElement('div');
      fade.className = 'screen-fade';
      fade.style.opacity = '0';
      layers.appendChild(fade);
      await sleep(60);
      fade.classList.add('dark');
      fade.style.opacity = '1';
      await sleep(1200);
      // 设置时间为 5/9 07:00
      setSysTimeSafe('2025-05-09T07:00:00');
      Router.root('lock');
      await sleep(500);
      fade.style.opacity = '0';
      await sleep(800);
      fade.remove();
      // 早上
      flag('morning_started', true);
      flag('morning_stage', 0);
      save();
      triggerS12();
    };

    /* ============================================================
       13. 违规黑屏（"我 进 来 了。"）
       ============================================================ */
    async function showNightViolation() {
      await sleep(_dl(800));
      NotifService.push({
        id: 'n_night_b_violation',
        title: '小渠',
        detail: '你果然还没睡。',
        target: null
      });
      await sleep(_dl(1500));
      NotifService.push({
        id: 'n_night_b_sys',
        title: '系统通知',
        detail: '您已违反第4条规则，您的学藉已注销。',
        target: null
      });
      await sleep(_dl(1500));
      showFinalViolation('我 进 来 了。');
    }

    function showFinalViolation(text) {
      var layers = document.getElementById('layers');
      if (!layers) return;
      var ov = document.createElement('div');
      ov.id = 'wxg-night-violation';
      ov.style.cssText = 'position:absolute;inset:0;background:#000;z-index:9999;display:flex;align-items:center;justify-content:center;flex-direction:column;pointer-events:auto;';
      layers.appendChild(ov);
      var el = document.createElement('div');
      el.style.cssText = 'color:#ff0000;font-size:52px;font-weight:700;letter-spacing:10px;text-align:center;text-shadow:0 0 20px rgba(255,0,0,.6);';
      ov.appendChild(el);
      var chars = Array.from(text);
      var i = 0;
      function tick() {
        if (i >= chars.length) {
          setTimeout(function () {
            ov.remove();
            backToLockAfterViolation();
          }, 2200);
          return;
        }
        el.textContent += chars[i];
        el.style.animation = 'wxg-blink2 .3s';
        setTimeout(function () { el.style.animation = ''; }, 300);
        i++;
        setTimeout(tick, 500);
      }
      setTimeout(tick, 800);
    }

    function backToLockAfterViolation() {
      Router.root('lock');
      setTimeout(function () {
        ConfirmBox.open({
          title: '继续？',
          body: '是否按当前进度继续游玩？\n\n· 选"继续"将回到凌晨收到消息那一刻\n· 选"重新开始"将清空本机数据并重开',
          okText: '继续',
          cancelText: '重新开始'
        }).then(function (ok) {
          if (ok) {
            resetNightFlags();
            setSysTimeSafe('2025-05-09T00:03:00');
            // 清掉凌晨临爽消息
            if (state.db.chats.ls) {
              state.db.chats.ls.messages = state.db.chats.ls.messages.filter(function (m) {
                return !['陈默...我宿舍有人在敲门', '你听到了吗？', '我不敢下去看…你能帮我从猫眼里看一眼吗？？', '求你了！！你一定还没睡对吧', '我进来了。', '我听到开门声了', '我好害怕', '……'].includes(m.text);
              });
              save();
            }
            // 清掉夜间备忘录
            state.db.memos = state.db.memos.filter(function (m) {
              return m.id !== 'night1' && m.id !== 'night2';
            });
            save();
            flag('night_active', true);
            flag('night_stage', 0);
            save();
            // 重新推临爽消息
            if (state.db.chats.ls && !state.db.chats.ls.messages.some(function (m) { return m.text === '陈默...我宿舍有人在敲门'; })) {
              state.db.chats.ls.messages.push({
                id: uid('m'), from: '临爽', text: '陈默...我宿舍有人在敲门', time: '2025-05-09 00:03'
              });
              save();
            }
            setTimeout(function () {
              NotifService.push({
                id: 'n_night_ls_retry',
                title: '临爽-北苑411',
                detail: '临爽：陈默...我宿舍有人在敲门',
                target: { page: 'chat', params: { id: 'ls' } }
              });
            }, 500);
          } else {
            try { localStorage.removeItem('xiaoqu_save_v1'); } catch (e) {}
            location.reload();
          }
        });
      }, 800);
    }

    function resetNightFlags() {
      flag('night_violation_done', false);
      flag('night_choice_made', false);
      flag('night_sleep_done', false);
      flag('night_stage', 0);
      flag('night_active', true);
      save();
    }

    /* ============================================================
       14. 早上 s12
       ============================================================ */
    function triggerS12() {
      if (flag('s12_triggered')) return;
      flag('s12_triggered', true);
      flag('s12_pending', true);
      flag('s12_notified', true);
      var byChat = state.db.chats.by;
      if (byChat && !byChat.messages.some(function (m) {
        return m.from === '苏青' && m.text === '不妙了不妙了awww！！';
      })) {
        byChat.messages.push({ id: uid('m'), from: '苏青', text: '不妙了不妙了awww！！', time: '2025-05-09 07:00' });
        save();
      }
      NotifService.push({
        id: 'n_s12',
        title: '北苑留校女生群',
        detail: '苏青：不妙了不妙了awww！！',
        target: { page: 'chat', params: { id: 'by' } }
      });
    }

    async function playS12Group() {
      if (_lock['by_s12']) return;
      _lock['by_s12'] = true;
      flag('s12_stage', 1);
      save();
      try {
        var cid = 'by';
        await ensureMsgP(cid, { from: '许双荞', text: '学姐也知道那事了？' }, 1500);
        await ensureMsgP(cid, { from: '周学姐', text: '……我没办法接受' }, 1500);
        await ensureMsgP(cid, { from: '邓许', text: '？出什么事了' }, 1400);
        await ensureMsgP(cid, { from: '周学姐', text: '沈敏出事了。你们还不知道吗' }, 1800);
        await ensureMsgP(cid, { from: '苏青', text: '王姨刚说的…说是7号楼五层暖气突然停暖，门又被反锁，沈敏是在里面活活冻死的' }, 2000);
        await ensureMsgP(cid, { from: '苏青', text: '但鬼信啊！！！' }, 1500);
        await ensureMsgP(cid, { from: '邓许', text: '全是bug，这不可能是真相' }, 1700);
        await ensureMsgP(cid, { from: '邓许', text: '第一，突发的暖气停暖一定会整楼停，怎么可能只停她那一层……太蹩脚了' }, 1900);
        await ensureMsgP(cid, { from: '周学姐', text: '对，第二是现在的天气不可能在密闭的宿舍中把人活活冻死！' }, 1900);
        await ensureMsgP(cid, { from: '张夏夏', text: '不对吧？！她真死了？？？' }, 1700);
        await ensureMsgP(cid, { from: '张夏夏', text: '我刚醒。。。怎么会，都出命案了校方不管？？' }, 1800);
        await ensureMsgP(cid, { from: '临爽', text: '我靠啊……完全不能相信，一切事情都变得诡异了……' }, 1800);
        await sleep(_dl(800));
        flag('s12_stage', 2);
        save();
        state.choice = { chatId: cid, nodeId: 'grp_s12', options: [
          { k: 'a', label: '①临爽你昨晚怎么样' },
          { k: 'b', label: '②这样根本睡不了一个好觉' }
        ]};
        save();
        refreshChat(cid);
      } finally { _lock['by_s12'] = false; }
    }

    CHOICES.grp_s12 = {
      async a() {
        if (_lock['by_s12']) return;
        _lock['by_s12'] = true;
        try {
          var cid = 'by';
          state.choice = null;
          flag('s12_choice_key', 'a');
          flag('s12_stage', 3);
          save();
          refreshChat(cid);
          await ensureMsgP(cid, { from: 'me', text: '临爽！昨晚你怎么样？我醒了才看到消息，可担心死我了！！' }, 900);
          await ensureMsgP(cid, { from: '临爽', text: '啥消息？' }, 1500);
          await ensureMsgP(cid, { from: 'me', text: '？求助消息啊，我去给你截图' }, 900);
          flag('morning_ls_checked', false);
          flag('s12_stage', 4);
          save();
          await sleep(_dl(600));
          CursorGuide.show('[data-app="messages"]', '进和临爽的聊天框');
        } finally { _lock['by_s12'] = false; }
      },
      async b() {
        if (_lock['by_s12']) return;
        _lock['by_s12'] = true;
        try {
          var cid = 'by';
          state.choice = null;
          flag('s12_choice_key', 'b');
          flag('s12_stage', 3);
          save();
          refreshChat(cid);
          await ensureMsgP(cid, { from: 'me', text: '这种情况下，我们根本不可能完成规则4上的“睡一个好觉啊”……！' }, 900);
          await ensureMsgP(cid, { from: '临爽', text: '对啊…我昨晚老梦到敲门声，这噩梦让我一晚上都没睡好' }, 1800);
          await ensureMsgP(cid, { from: 'me', text: '……你怎么确定那是梦?' }, 900);
          await ensureMsgP(cid, { from: '临爽', text: '草你别吓我。。因为7号楼人最多门禁很严啊，别说闯进来了，跟校外人员发消息都甭想！' }, 1900);
          flag('s12_stage', 4);
          save();
        } finally { _lock['by_s12'] = false; }
      }
    };

    /* ============================================================
       15. PAGES.chat 包装
       ============================================================ */
    var prevChat = PAGES.chat;
    PAGES.chat = function (params) {
      var def = prevChat(params);
      var cid = params.id;

      // 限时选项：红框 + 倒计时
      if (state.choice && state.choice.timeLimit && state.choice.chatId === cid) {
        var remain = Math.ceil(state.choice.timeLimit / 1000);
        def.html = def.html.replace(
          '<div class="choice-bar" id="choice-bar">',
          '<div class="choice-bar timed" id="choice-bar">' +
            '<div class="timed-countdown" id="timed-countdown">' + remain + 's</div>'
        );
      }

      var prevMount = def.mount;
      def.mount = function (root) {
        if (prevMount) prevMount(root);
        try {
          // 红包卡片 + 公告卡片 DOM 替换
          renderSpecialMessages(root, cid);
          // 限时选项倒计时启动
          if (state.choice && state.choice.timeLimit && state.choice.chatId === cid) {
            startNightCountdown(state.choice.timeLimit);
          }
          // 各阶段 hook
          chatMountHook(root, cid);
        } catch (e) {
          console.error('[ext2] chatMountHook', e);
        }
      };
      return def;
    };

    function renderSpecialMessages(root, cid) {
      var chat = state.db.chats[cid];
      if (!chat || !Array.isArray(chat.messages)) return;
      var bubbles = root.querySelectorAll('.bubble');
      var idx = 0;
      var msgIndex = 0;
      /* 遍历消息，匹配气泡顺序 */
      var allMsgs = chat.messages;
      for (var i = 0; i < allMsgs.length; i++) {
        var m = allMsgs[i];
        if (m.type === 'system' || m.type === 'card') continue;
        var bubble = bubbles[idx];
        idx++;
        if (!bubble) continue;
        if (m.type === 'redpacket') {
          var opened = flag('redpacket_opened_' + m.rpId);
          bubble.innerHTML = '<div class="redpacket-card ' + (opened ? 'opened' : '') + '" data-action="open-redpacket" data-rid="' + esc(m.rpId) + '">' +
            '<div class="rp-icon">🧧</div>' +
            '<div class="rp-info">' +
              '<div class="rp-title">' + esc(m.title || '恭喜发财，大吉大利') + '</div>' +
              '<div class="rp-desc">' + (opened ? '已领取' : '专属红包 · 点击领取') + '</div>' +
            '</div>' +
            '<div class="rp-btn">' + (opened ? '已领取' : '领取') + '</div>' +
          '</div>';
          bubble.style.background = 'transparent';
          bubble.style.padding = '0';
          bubble.style.boxShadow = 'none';
        } else if (m.isRed) {
          bubble.style.color = 'var(--c-danger)';
          bubble.style.fontWeight = '700';
        }
      }
    }

    function chatMountHook(root, cid) {
      extEnsure();
      // huzhu 阶段
      if (cid === 'huzhu') {
        var stage = flag('huzhu_stage') || 0;
        if (stage === 5 && !state.choice && !_lock['huzhu']) {
          setTimeout(function () { CHOICES.huzhu_1.a(); }, 300);
        } else if (stage === 6 && !_lock['huzhu']) {
          var k2 = flag('huzhu_2_key');
          if (k2 && CHOICES.huzhu_2 && CHOICES.huzhu_2[k2] && !_lock['huzhu_after_wxg']) {
            setTimeout(function () { CHOICES.huzhu_2[k2](); }, 300);
          }
        } else if (stage === 7 && !state.choice) {
          setTimeout(function () {
            state.choice = { chatId: 'huzhu', nodeId: 'huzhu_3', options: [
              { k: 'a', label: '①好啊，我和你去' },
              { k: 'b', label: '②noway，不想出门' }
            ]};
            save();
            render();
          }, 200);
        } else if (stage === 8 && !_lock['huzhu']) {
          var k3 = flag('huzhu_3_key');
          if (k3 && CHOICES.huzhu_3 && CHOICES.huzhu_3[k3]) {
            setTimeout(function () { CHOICES.huzhu_3[k3](); }, 300);
          }
        }
        // 红包待领取
        if (flag('huzhu_redpacket_pending') && !flag('redpacket_opened_rp_huzhu_1000')) {
          setTimeout(function () {
            CursorGuide.show('[data-action="open-redpacket"]', '领取红包');
          }, 500);
        }
      }

      // 北苑群阶段
      if (cid === 'by') {
        if (flag('s11_pending') && flag('s11_notified') && !flag('s11_done') && !_lock['by_s11']) {
          setTimeout(function () { playS11Group(); }, 600);
        }
        if (flag('s12_pending') && flag('s12_notified') && !flag('s12_done') && !_lock['by_s12']) {
          var st = flag('s12_stage') || 0;
          if (st === 0 || st === 1) {
            setTimeout(function () { playS12Group(); }, 600);
          } else if (st === 2 && !state.choice) {
            setTimeout(function () {
              state.choice = { chatId: 'by', nodeId: 'grp_s12', options: [
                { k: 'a', label: '①临爽你昨晚怎么样' },
                { k: 'b', label: '②这样根本睡不了一个好觉' }
              ]};
              save(); render();
            }, 300);
          } else if (st === 3 && !_lock['by_s12']) {
            var k12 = flag('s12_choice_key');
            if (k12 && CHOICES.grp_s12 && CHOICES.grp_s12[k12]) {
              setTimeout(function () { CHOICES.grp_s12[k12](); }, 300);
            }
          }
        }
        // 入睡按钮
        if (flag('s11_sleep_ready')) {
          addSleepButton(root);
        }
      }

      // 临爽聊天
      if (cid === 'ls') {
        if (flag('night_active') && !flag('night_started_done')) {
          var nstage = flag('night_stage') || 0;
          if (nstage === 0 || nstage === 1) {
            flag('night_started_done', true);
            setTimeout(function () { playNightLs(); }, 600);
          } else if (nstage === 2 && !state.choice) {
            setTimeout(function () {
              state.choice = {
                chatId: 'ls', nodeId: 'night_ls',
                timeLimit: 10000,
                onTimeout: 'c',
                options: [
                  { k: 'a', label: '①好，我帮你看看' },
                  { k: 'b', label: '②抱歉，我也不太敢' }
                ]
              };
              save(); render();
            }, 300);
          }
        }
        // 早上①分支：玩家进临爽聊天 → 发现消息消失
        if (flag('morning_started') && flag('s12_choice_key') === 'a' && !flag('morning_ls_checked')) {
          flag('morning_ls_checked', true);
          save();
          setTimeout(function () {
            var chatLs = state.db.chats.ls;
            if (chatLs) {
              // 移除所有凌晨消息（正确分支走装睡所以不会有，但兜底一下）
              chatLs.messages = chatLs.messages.filter(function (m) {
                return !['陈默...我宿舍有人在敲门', '你听到了吗？', '我不敢下去看…你能帮我从猫眼里看一眼吗？？', '求你了！！你一定还没睡对吧', '我进来了。', '我听到开门声了', '我好害怕', '……'].includes(m.text);
              });
              save();
              refreshChat('ls');
            }
            Toast.show('聊天记录停留在凌晨前的对话', 3000);
          }, 500);
        }
      }
    }

    function addSleepButton(root) {
      if (root.querySelector('[data-action="do-sleep"]')) return;
      var btn = document.createElement('button');
      btn.className = 'sleep-btn-top';
      btn.setAttribute('data-action', 'do-sleep');
      btn.textContent = '入睡';
      root.appendChild(btn);
      setTimeout(function () {
        CursorGuide.show('[data-action="do-sleep"]', '提前上床躺一会吧');
      }, 500);
    }

    /* ============================================================
       16. PAGES.memoDetail 包装 —— night_scene
       ============================================================ */
    var prevMemoDetail = PAGES.memoDetail;
    PAGES.memoDetail = function (params) {
      extEnsure();
      var m = state.db.memos.find(function (x) { return x.id === params.id; });
      if (m && m.type === 'night_scene') {
        return renderNightMemo(m);
      }
      return prevMemoDetail(params);
    };

    function renderNightMemo(m) {
      var stepsHtml = (m.steps || []).map(function (s, i) {
        var style = '';
        if (s.color === 'red') style += 'color:var(--c-danger);';
        if (s.large) style += 'font-size:26px;font-weight:700;letter-spacing:4px;line-height:1.7;';
        return '<div class="memo-step" data-step="' + i + '" style="display:none;">' +
          '<div class="memo-step-text" id="nstep-' + i + '" style="' + style + '"></div>' +
          (s.button ? '<button class="memo-step-btn" data-action="night-step-btn" data-step="' + i + '" data-trigger="' + esc(s.nextTrigger || '') + '">' + esc(s.button) + '</button>' : '') +
        '</div>';
      }).join('');
      return {
        html: '<div class="page">' +
          navBar(m.title || '夜间记录') +
          '<div class="page-body">' +
            '<div class="typewriter-area" id="night-memo-container">' + stepsHtml + '</div>' +
            '<div class="px4 txt-xs txt-3 center" style="padding-bottom:var(--sp-6);">' + esc(m.time || '') + '</div>' +
          '</div>' +
        '</div>',
        mount: function (root) {
          var showStep = function (idx) {
            if (idx >= (m.steps || []).length) {
              CursorGuide.hide();
              Router.pop();
              return;
            }
            var step = m.steps[idx];
            var container = root.querySelector('[data-step="' + idx + '"]');
            var textEl = root.querySelector('#nstep-' + idx);
            if (!container || !textEl) return;
            container.style.display = 'block';
            Typewriter.run(textEl, step.text || '', { speed: step.speed || 50 }).then(function () {
              if (step.button) return;
              if (step.nextTrigger && typeof window[step.nextTrigger] === 'function') {
                setTimeout(function () {
                  try { window[step.nextTrigger](); } catch (e) { console.error(e); }
                }, step.delay || 800);
              }
              showStep(idx + 1);
            });
          };
          setTimeout(function () { showStep(0); }, 400);

          root.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-action="night-step-btn"]');
            if (!btn) return;
            e.stopPropagation();
            var idx = parseInt(btn.dataset.step, 10);
            var trigger = btn.dataset.trigger;
            btn.style.display = 'none';
            if (trigger && typeof window[trigger] === 'function') {
              try { window[trigger](); } catch (e) { console.error(e); }
            }
            // 进入下一步
            var step = m.steps[idx];
            showStep(idx + 1);
          });
        }
      };
    }

    /* ============================================================
       17. 锁屏通知拦截（限时选项前的密码）
       ============================================================ */
    window.addEventListener('click', function (e) {
      var el = e.target.closest('[data-action="notif-jump"]');
      if (!el) return;
      var cur = Router.current();
      if (cur.page !== 'lock') return;
      var nid = el.dataset.id;
      if (nid === 'n_night_ls' || nid === 'n_night_ls_retry' || nid === 'n_s12') {
        e.stopPropagation();
        e.preventDefault();
        var targetChat = (nid === 'n_s12') ? 'by' : 'ls';
        promptUnlock(function (ok) {
          if (ok) {
            try { NotifService.markRead(nid); } catch (er) {}
            Router.root('home');
            setTimeout(function () { Router.push('chat', { id: targetChat }); }, 300);
          }
        });
      }
    }, true);

    function promptUnlock(cb) {
      var layers = document.getElementById('layers');
      var scrim = document.createElement('div');
      scrim.className = 'modal-scrim';
      scrim.innerHTML =
        '<div class="modal" style="background:#0b0c10;color:#fff;max-width:320px;">' +
          '<h3 style="text-align:center;color:#fff;margin-bottom:16px;">输入锁屏密码</h3>' +
          '<div class="pin-dots" id="pin-dots-popup" style="margin:20px auto;justify-content:center;">' +
            '<i></i><i></i><i></i><i></i>' +
          '</div>' +
          '<div style="text-align:center;color:#f55;font-size:12px;min-height:20px;" id="pin-msg-popup"></div>' +
          '<div class="pin-keys" id="pin-keys-popup" style="grid-template-columns:repeat(3,58px);justify-content:center;gap:8px;">' +
            [1,2,3,4,5,6,7,8,9].map(function (n) { return '<button class="pin-key" data-k="' + n + '">' + n + '</button>'; }).join('') +
            '<button class="pin-key ghost" data-k="cancel">取消</button>' +
            '<button class="pin-key" data-k="0">0</button>' +
            '<button class="pin-key ghost" data-k="del">⌫</button>' +
          '</div>' +
        '</div>';
      layers.appendChild(scrim);
      var entered = '';
      var dots = scrim.querySelectorAll('#pin-dots-popup i');
      var msg = scrim.querySelector('#pin-msg-popup');
      function refresh() { dots.forEach(function (d, i) { d.classList.toggle('on', i < entered.length); }); }
      scrim.addEventListener('click', function (ev) {
        var btn = ev.target.closest('[data-k]');
        if (!btn) {
          if (ev.target === scrim) { scrim.remove(); cb(false); }
          return;
        }
        var k = btn.dataset.k;
        if (k === 'cancel') { scrim.remove(); cb(false); return; }
        if (k === 'del') { entered = entered.slice(0, -1); refresh(); return; }
        if (entered.length >= 4) return;
        entered += k;
        refresh();
        if (entered.length === 4) {
          setTimeout(function () {
            if (entered === (state.settings && state.settings.lockPassword || '1234')) {
              scrim.remove();
              cb(true);
            } else {
              msg.textContent = '密码错误';
              entered = '';
              refresh();
            }
          }, 150);
        }
      });
    }

    /* ============================================================
       18. 事件委托
       ============================================================ */
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-action]');
      if (!el) return;
      var a = el.dataset.action;
      if (a === 'open-redpacket') {
        e.stopPropagation();
        var rid = el.dataset.rid;
        handleOpenRedpacket(rid);
        return;
      }
      if (a === 'do-sleep') {
        e.stopPropagation();
        doSleep();
        return;
      }
    }, true);

    /* ============================================================
       19. 兼容 v2.2 的 huzhu 逻辑 —— stage 4 → 5
       （v2.2 的 handleHuzhu 里 stage 4 会弹单项 huzhu_2，需要拦截）
       ============================================================ */
    // 在 PAGES.chat 的最外层 mount 已经处理了 stage 5/6/7/8 的重新触发
    // stage 4 是 v2.2 的状态，不应该被触发（因为我把 huzhu_1.a 的 stage 直接设置为 5）
    // 但为了兜底，如果玩家已经 stage 4 的旧存档，重置为 5
    if (flag('huzhu_stage') === 4) {
      flag('huzhu_stage', 2);  // 让 v2.2 重新弹 huzhu_1 选项
      save();
    }

    /* ============================================================
       20. 补触发：进各种聊天时
       ============================================================ */
    setTimeout(function () {
      extEnsure();
      var cur = Router.current();
      if (cur && cur.page === 'chat') {
        try { chatMountHook(document.querySelector('.page-body') || document.body, cur.params.id); } catch (e) {}
      }
    }, 1000);

    /* ============================================================
       21. 暴露 API
       ============================================================ */
    window.StoryExtension2 = {
      triggerNoticeV9: triggerNoticeV9,
      triggerS11: triggerS11,
      triggerS12: triggerS12,
      doSleep: doSleep,
      handleOpenRedpacket: handleOpenRedpacket,
      addRedpacketToWallet: addRedpacketToWallet,
      promptUnlock: promptUnlock,
      showFinalViolation: showFinalViolation
    };

    console.log('[story-extension-2 v1.0] 已加载：huzhu 扩写 / 红包 / 公告 / s11 / 凌晨 / s12');
  });
})();
