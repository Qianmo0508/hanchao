/* ================================================================
   story-fix.js  v2.0
   最终补丁层（合并 story-fix.js v1.1 + story-extension-2-fix.js v1.0）

   加载顺序：
     story-patch.js → story-extension.js → story-speed.js
     → story-storyline.js → story-extension-2.js → story-fix.js

   功能清单：
   【防穿透 / 防重复提交】
   1. overlay 强制 pointer-events: auto（MutationObserver）
   2. window capture 拦截 submit 重复触发
   3. ConfirmBox.open 清残留 overlay + 处理"继续？"回档
   4. 启动清理残留 overlay

   【光标 / 论坛】
   5. CursorGuide.show 双重拦截：
      · s9_questionnaire_done 时忽略"点击填写问卷"
      · redpacket_opened 时忽略"领取红包"
   6. 互助板块 p_help 幂等补回（启动时 + 每 2s 兜底 + 每次 forum 渲染前）
   7. 论坛自动切互助板块（zx_stage >= 2 且未看过）

   【红包 / 入睡 / 夜间】
   8. CHOICES.huzhu_3.a/b 入口拦截（huzhu_done / redpacket_opened /
      huzhu_redpacket_pending / _lock 任一为真则跳过，彻底避免重跑）
   9. handleOpenRedpacket 覆盖（领取后 stage 8→9）
   10. 红包卡片显示金额 ￥1000.00
   11. huzhu_after_rp_done 补完后续消息（runHuzhuAfterRpOnce）
   12. 入睡按钮即时出现（PAGES.chat.mount 末尾 tryAddSleepButtonNow）
   13. 夜间备忘录自动进入（覆盖 CHOICES.night_ls.a / c）
   14. 回档后完整重置（night_started_done 等）
   15. 定时清理红包残留光标 / stage 8 兜底推 9
   ================================================================ */
(function () {
  'use strict';

  function baseReady(fn) {
    if (typeof PAGES !== 'undefined' &&
        typeof Router !== 'undefined' &&
        typeof CursorGuide !== 'undefined' &&
        typeof state !== 'undefined' &&
        typeof flag === 'function' &&
        typeof save === 'function' &&
        typeof render === 'function' &&
        typeof esc === 'function' &&
        typeof sleep === 'function' &&
        typeof uid === 'function' &&
        typeof storyTime === 'function' &&
        typeof sysNow === 'function' &&
        typeof fmtFull === 'function' &&
        typeof ConfirmBox !== 'undefined' &&
        typeof NotifService !== 'undefined' &&
        typeof Toast !== 'undefined' &&
        typeof CHOICES !== 'undefined') {
      fn();
    } else {
      setTimeout(function () { baseReady(fn); }, 100);
    }
  }

  baseReady(function () {

    /* ============================================================
       0. 通用引用
       ============================================================ */
    var _lock = (window.StoryExtension && window.StoryExtension._playingLock) || {};
    var EXT2 = window.StoryExtension2 || null;

    /* ============================================================
       1. 互助板块 p_help 幂等补回
       ============================================================ */
    function ensureHelpBoardFull() {
      if (!state.db) state.db = {};
      if (!state.db.forum) state.db.forum = { boards: [], posts: [] };
      if (!Array.isArray(state.db.forum.boards)) state.db.forum.boards = [];
      if (!Array.isArray(state.db.forum.posts)) state.db.forum.posts = [];

      var changed = false;

      if (!state.db.forum.boards.some(function (b) { return b.id === 'help'; })) {
        state.db.forum.boards.push({ id: 'help', name: '互助板块', hot: true });
        changed = true;
      }

      var pHelpData = {
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

      var existing = null;
      for (var i = 0; i < state.db.forum.posts.length; i++) {
        if (state.db.forum.posts[i].id === 'p_help') { existing = state.db.forum.posts[i]; break; }
      }

      if (!existing) {
        state.db.forum.posts.push(pHelpData);
        changed = true;
      } else {
        var hasJoinAction = Array.isArray(existing.floors) &&
          existing.floors.some(function (f) {
            return f.action && f.action.type === 'join-group';
          });
        if (!hasJoinAction) {
          existing.floors = pHelpData.floors;
          existing.board = 'help';
          existing.hot = true;
          if (!existing.content) existing.content = pHelpData.content;
          if (!existing.title) existing.title = pHelpData.title;
          if (!existing.author) existing.author = pHelpData.author;
          if (!existing.time) existing.time = pHelpData.time;
          changed = true;
        }
      }

      if (changed) save();
      return changed;
    }
    ensureHelpBoardFull();
    setInterval(ensureHelpBoardFull, 2000);

    /* ============================================================
       2. CursorGuide.show 双重拦截
       ============================================================ */
    var origShow = CursorGuide.show;
    CursorGuide.show = function (selector, label) {
      // 问卷已提交，忽略指向问卷的光标
      if (flag('s9_questionnaire_done')) {
        if ((typeof selector === 'string' && selector.indexOf('questionnaire') >= 0) ||
            (label && String(label).indexOf('填写问卷') >= 0)) {
          return;
        }
      }
      // 红包已领，忽略指向红包的光标
      if (flag('redpacket_opened_rp_huzhu_1000')) {
        if ((typeof selector === 'string' && selector.indexOf('open-redpacket') >= 0) ||
            (label && String(label).indexOf('领取红包') >= 0)) {
          return;
        }
      }
      return origShow.call(this, selector, label);
    };

    /* ============================================================
       3. 论坛：渲染前补 p_help + 自动切互助板块
       ============================================================ */
    var origForum = PAGES.forum;
    PAGES.forum = function (params) {
      ensureHelpBoardFull();
      var def = origForum(params);
      var origMount = def.mount;
      def.mount = function (root) {
        if (origMount) origMount(root);
        if (flag('zx_stage') >= 2 && !flag('help_board_seen')) {
          setTimeout(function () {
            var tab = root.querySelector('[data-action="forum-board"][data-id="help"]');
            if (tab) {
              flag('help_board_seen', true);
              save();
              tab.click();
            }
          }, 200);
        }
      };
      return def;
    };

    if (PAGES.forumPost) {
      var origForumPost = PAGES.forumPost;
      PAGES.forumPost = function (params) {
        ensureHelpBoardFull();
        return origForumPost(params);
      };
    }

    /* ============================================================
       4. overlay pointer-events: auto
       ============================================================ */
    var layers = document.getElementById('layers');
    if (layers) {
      var ensureOverlayPE = function () {
        var ov = document.getElementById('wxg-warning-overlay');
        if (ov && ov.style.pointerEvents !== 'auto') {
          ov.style.pointerEvents = 'auto';
        }
        var ov2 = document.getElementById('wxg-night-violation');
        if (ov2 && ov2.style.pointerEvents !== 'auto') {
          ov2.style.pointerEvents = 'auto';
        }
      };
      try {
        new MutationObserver(ensureOverlayPE).observe(layers, { childList: true, subtree: true });
      } catch (e) {}
      ensureOverlayPE();
    }

    /* ============================================================
       5. window capture 拦截 submit 重复触发
       ============================================================ */
    window.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest && e.target.closest('[data-action="submit-questionnaire"]');
      if (!btn) return;
      if (document.getElementById('wxg-warning-overlay')) {
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      if (window.__qx_submitting) {
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      window.__qx_submitting = true;
      setTimeout(function () { window.__qx_submitting = false; }, 1500);
    }, true);

    /* ============================================================
       6. ConfirmBox.open 统一包装
          · 弹窗前清残留 overlay
          · "继续？"回档后做完整重置
       ============================================================ */
    var prevConfirm = ConfirmBox.open;
    ConfirmBox.open = async function (opts) {
      var ov = document.getElementById('wxg-warning-overlay');
      if (ov) ov.remove();
      var ov2 = document.getElementById('wxg-night-violation');
      if (ov2) ov2.remove();

      var ok = await prevConfirm.call(this, opts);

      if (opts && opts.title === '继续？' && ok) {
        try {
          flag('night_violation_done', false);
          flag('night_choice_made', false);
          flag('night_sleep_done', false);
          flag('night_stage', 0);
          flag('night_active', true);
          flag('night_started_done', false);
          save();

          if (window.StoryExtension && window.StoryExtension._playingLock) {
            Object.keys(window.StoryExtension._playingLock).forEach(function (k) {
              window.StoryExtension._playingLock[k] = false;
            });
          }

          try { CursorGuide.hide(); } catch (e) {}

          var ov3 = document.getElementById('wxg-night-violation');
          if (ov3) ov3.remove();
          var ov4 = document.getElementById('wxg-warning-overlay');
          if (ov4) ov4.remove();

          if (state.choice && state.choice.nodeId === 'night_ls') {
            state.choice = null;
            save();
          }

          if (state.db.chats && state.db.chats.ls) {
            state.db.chats.ls.messages = state.db.chats.ls.messages.filter(function (m) {
              return !['你听到了吗？', '我不敢下去看…你能帮我从猫眼里看一眼吗？？', '求你了！！你一定还没睡对吧', '我进来了。', '我听到开门声了', '我好害怕', '……'].includes(m.text);
            });
            var hasFirst = state.db.chats.ls.messages.some(function (m) {
              return m.text === '陈默...我宿舍有人在敲门';
            });
            if (!hasFirst) {
              state.db.chats.ls.messages.push({
                id: uid('m'), from: '临爽', text: '陈默...我宿舍有人在敲门', time: '2025-05-09 00:03'
              });
            }
            save();
          }

          if (state.db.memos) {
            state.db.memos = state.db.memos.filter(function (m) {
              return m.id !== 'night1' && m.id !== 'night2';
            });
            save();
          }
        } catch (err) {
          console.error('[story-fix] resetNightFlags', err);
        }
      }
      return ok;
    };

    /* ============================================================
       7. 启动清理残留
       ============================================================ */
    var stale1 = document.getElementById('wxg-warning-overlay');
    if (stale1) stale1.remove();
    var stale2 = document.getElementById('wxg-night-violation');
    if (stale2) stale2.remove();

    /* ============================================================
       8. CHOICES.huzhu_3.a / b 入口拦截（彻底防重跑）
       ============================================================ */
    (function wrapHuzhu3() {
      if (!CHOICES.huzhu_3) return;
      var origA = CHOICES.huzhu_3.a;
      if (typeof origA === 'function' && !origA.__fixWrapped) {
        CHOICES.huzhu_3.a = async function () {
          if (flag('huzhu_done')) return;
          if (_lock['huzhu']) return;
          return origA.apply(this, arguments);
        };
        CHOICES.huzhu_3.a.__fixWrapped = true;
      }
      var origB = CHOICES.huzhu_3.b;
      if (typeof origB === 'function' && !origB.__fixWrapped) {
        CHOICES.huzhu_3.b = async function () {
          if (flag('huzhu_done')) return;
          if (flag('redpacket_opened_rp_huzhu_1000')) return;
          if (flag('huzhu_redpacket_pending')) return;
          if (_lock['huzhu']) return;
          return origB.apply(this, arguments);
        };
        CHOICES.huzhu_3.b.__fixWrapped = true;
      }
    })();

    /* ============================================================
       9. handleOpenRedpacket 覆盖（领取后 stage 8→9）
       ============================================================ */
    if (EXT2 && typeof EXT2.handleOpenRedpacket === 'function') {
      var origHandleRp = EXT2.handleOpenRedpacket;
      EXT2.handleOpenRedpacket = async function (rid) {
        if (flag('redpacket_opened_' + rid)) {
          Toast.show('已领取过此红包');
          if (flag('huzhu_stage') === 8) {
            flag('huzhu_stage', 9);
            save();
          }
          CursorGuide.hide();
          return;
        }
        await origHandleRp(rid);
        if (flag('huzhu_stage') === 8) {
          flag('huzhu_stage', 9);
          save();
        }
      };
    }

    /* ============================================================
       10. 红包卡片装饰（显示 ￥1000.00）
       ============================================================ */
    function decorateRedpackets(root) {
      var cards = root.querySelectorAll('.redpacket-card');
      if (!cards.length) return;
      Array.prototype.forEach.call(cards, function (card) {
        var rid = card.dataset.rid;
        if (!rid) return;
        var chat = state.db.chats && state.db.chats.huzhu;
        if (!chat || !Array.isArray(chat.messages)) return;
        var msg = chat.messages.find(function (m) { return m.type === 'redpacket' && m.rpId === rid; });
        if (!msg) return;
        var amount = typeof msg.amount === 'number' ? msg.amount : 0;
        var amountStr = '￥' + amount.toFixed(2);
        var opened = flag('redpacket_opened_' + rid);
        var rpTitle = card.querySelector('.rp-title');
        var rpDesc = card.querySelector('.rp-desc');
        if (rpTitle && !rpTitle.dataset.amountSet) {
          rpTitle.textContent = amountStr + ' · ' + (msg.title || '恭喜发财，大吉大利');
          rpTitle.dataset.amountSet = '1';
        }
        if (rpDesc) {
          rpDesc.textContent = opened ? '已领取 · 已存入钱包' : '专属红包 · 点击领取';
        }
        var btn = card.querySelector('.rp-btn');
        if (btn) btn.textContent = opened ? '已领取' : '领取';
      });
    }

    /* ============================================================
       11. 入睡按钮即时出现
       ============================================================ */
    function tryAddSleepButtonNow(root) {
      if (!flag('s11_sleep_ready')) return;
      var cur = Router.current();
      if (!cur || cur.page !== 'chat' || cur.params.id !== 'by') return;
      var vp = document.getElementById('viewport');
      if (!vp) return;
      if (vp.querySelector('[data-action="do-sleep"]')) return;
      var btn = document.createElement('button');
      btn.className = 'sleep-btn-top';
      btn.setAttribute('data-action', 'do-sleep');
      btn.textContent = '入睡';
      vp.appendChild(btn);
      setTimeout(function () {
        var cur2 = Router.current();
        if (cur2 && cur2.page === 'chat' && cur2.params.id === 'by') {
          CursorGuide.show('[data-action="do-sleep"]', '提前上床躺一会吧');
        }
      }, 400);
    }

    /* ============================================================
       12. huzhu_stage === 9 兜底补完后续消息
       ============================================================ */
    function handleHuzhuStage9() {
      if (flag('huzhu_stage') !== 9) return;
      if (flag('huzhu_done')) return;
      if (flag('huzhu_after_rp_done')) return;
      if (_lock['huzhu_rp_cont_fix']) return;
      if (!flag('redpacket_opened_rp_huzhu_1000')) return;
      setTimeout(runHuzhuAfterRpOnce, 300);
    }

    async function runHuzhuAfterRpOnce() {
      if (_lock['huzhu_rp_cont_fix']) return;
      if (flag('huzhu_after_rp_done')) return;
      if (flag('huzhu_done')) return;
      _lock['huzhu_rp_cont_fix'] = true;
      flag('huzhu_after_rp_done', true);
      save();
      try {
        var cid = 'huzhu';
        var sp = window.StorySpeed;
        if (!sp) return;
        await sp.ensureMsgP(cid, { from: '苏青', text: '草，怎么还是专属红包，我领不了' }, 1600);
        await sp.ensureMsgP(cid, { from: '周未', text: '我是一个愤怒的普通人，@钱逸时 现在要小心了' }, 1700);
        await sp.ensureMsgP(cid, { from: '许双荞', text: '。到底是谁修电闸' }, 1500);
        await sp.ensureMsgP(cid, { from: '钱逸时', text: '错了错了错了，明天每个人找我领超级大红包，现在我限额了…万恶的渠中校园钱包还特么有限额' }, 1900);
        if (typeof addTrust === 'function') addTrust(['钱逸时'], 3);
        if (typeof trustNote === 'function') {
          await sp.ensureMsgP(cid, { type: 'system', text: trustNote(['钱逸时'], 3) }, 800);
        }
        flag('huzhu_done', true);
        save();
        await sleep(sp.adjust(800));
        if (EXT2 && typeof EXT2.triggerNoticeV9 === 'function') {
          EXT2.triggerNoticeV9();
        }
      } finally {
        _lock['huzhu_rp_cont_fix'] = false;
      }
    }

    /* ============================================================
       13. 夜间备忘录构建（覆盖 CHOICES.night_ls）
       ============================================================ */
    function buildNight1Memo() {
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

    function buildNight2Memo() {
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

    if (CHOICES.night_ls) {
      CHOICES.night_ls.a = async function () {
        if (flag('night_choice_made')) return;
        flag('night_choice_made', 'a');
        save();
        var cid = 'ls';
        state.choice = null;
        save();
        refreshChat(cid);
        var sp = window.StorySpeed;
        if (sp) await sp.ensureMsgP(cid, { from: 'me', text: '好，我这就过去帮你看看，别害怕' }, 800);
        await sleep((sp ? sp.adjust(600) : 800));
        buildNight1Memo();
        Router.push('memoDetail', { id: 'night1' });
      };

      CHOICES.night_ls.c = async function () {
        if (flag('night_choice_made') && flag('night_choice_made') !== 'sleep') return;
        flag('night_choice_made', 'sleep');
        save();
        var cid = 'ls';
        state.choice = null;
        save();
        refreshChat(cid);
        var sp = window.StorySpeed;
        await sleep((sp ? sp.adjust(600) : 800));
        NotifService.push({
          id: 'n_night_xiaoqu',
          title: '小渠',
          detail: '你……真的睡了？',
          target: { page: 'memos', params: {} }
        });
        await sleep((sp ? sp.adjust(1200) : 1600));
        buildNight2Memo();
        Router.push('memoDetail', { id: 'night2' });
      };
    }

    /* ============================================================
       14. 包装 PAGES.chat.mount
          · decorateRedpackets
          · tryAddSleepButtonNow
          · handleHuzhuStage9
       ============================================================ */
    var prevChat = PAGES.chat;
    PAGES.chat = function (params) {
      var def = prevChat(params);
      var prevMount = def.mount;
      def.mount = function (root) {
        if (prevMount) prevMount(root);
        try {
          decorateRedpackets(root);
          tryAddSleepButtonNow(root);
          if (params.id === 'huzhu') {
            handleHuzhuStage9();
          }
        } catch (e) {
          console.error('[story-fix] mount', e);
        }
      };
      return def;
    };

    /* ============================================================
       15. 定时兜底
       ============================================================ */
    // 清理红包残留光标
    setInterval(function () {
      if (flag('redpacket_opened_rp_huzhu_1000') &&
          CursorGuide.current &&
          CursorGuide.current.selector &&
          String(CursorGuide.current.selector).indexOf('open-redpacket') >= 0) {
        CursorGuide.hide();
      }
    }, 500);

    // stage 8 兜底推 9（红包已领但 stage 卡在 8）
    setInterval(function () {
      if (flag('huzhu_stage') === 8 &&
          flag('redpacket_opened_rp_huzhu_1000') &&
          !flag('huzhu_done')) {
        flag('huzhu_stage', 9);
        save();
      }
    }, 1000);

    // 入睡按钮兜底（如果因为某些原因 PAGES.chat.mount 没被执行）
    setInterval(function () {
      if (!flag('s11_sleep_ready')) return;
      var cur = Router.current();
      if (!cur || cur.page !== 'chat' || cur.params.id !== 'by') return;
      var vp = document.getElementById('viewport');
      if (!vp) return;
      if (vp.querySelector('[data-action="do-sleep"]')) return;
      tryAddSleepButtonNow(document.querySelector('.page-body') || document.body);
    }, 800);

    /* ============================================================
       16. 暴露 API
       ============================================================ */
    window.StoryFix = {
      ensureHelpBoardFull: ensureHelpBoardFull,
      decorateRedpackets: decorateRedpackets,
      tryAddSleepButtonNow: tryAddSleepButtonNow,
      runHuzhuAfterRpOnce: runHuzhuAfterRpOnce
    };

    console.log('[story-fix v2.0] 已加载：合并 fix + ext2-fix，红包/入睡/夜间/回档全修复');
  });
})();
