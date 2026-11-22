/* ================================================================
   story-fix.js  v1.1
   加载顺序：story-patch.js → story-extension.js → story-speed.js
            → story-fix.js → story-storyline.js

   v1.1 新增（在 v1.0 基础上）：
   · 互助板块 p_help 帖子丢失
     根因：story-storyline.js 回退快照时，用快照里的旧 posts 列表
          覆盖了 db.forum.posts，把 story-extension.js 加载时补进去的
          p_help 帖子冲掉了。后续再进互助板块就看不到帖子。
     修复：
     1. 每次渲染 PAGES.forum / PAGES.forumPost 时强制 ensureHelpBoard
        （存在但楼层里没有"加入"按钮也补齐）
     2. 每 2 秒轮询一次，兜底补回
     3. 互助板块 board 本身如果丢了也补回

   v1.0 原有功能（全部保留）：
   1. 拦截 CursorGuide.show —— 问卷已提交时忽略"点击填写问卷"
   2. 论坛自动切互助板块（zx_stage >= 2 且未看过）
   3. overlay 强制 pointer-events: auto
   4. window capture 拦截 submit 重复触发
   5. 包装 ConfirmBox.open 清残留 overlay
   6. 启动清理残留 overlay
   ================================================================ */
(function () {
  'use strict';

  function ready(fn) {
    if (typeof CursorGuide !== 'undefined' &&
        typeof PAGES !== 'undefined' &&
        PAGES.forum &&
        typeof ConfirmBox !== 'undefined' &&
        typeof state !== 'undefined' &&
        typeof flag === 'function' &&
        typeof save === 'function' &&
        typeof esc === 'function' &&
        typeof uid === 'function' &&
        typeof storyTime === 'function') {
      fn();
    } else {
      setTimeout(function () { ready(fn); }, 80);
    }
  }

  ready(function () {

    /* ============================================================
       0. 确保互助板块 + p_help 帖子存在（幂等）
       ============================================================ */
    function ensureHelpBoardFull() {
      if (!state.db) state.db = {};
      if (!state.db.forum) state.db.forum = { boards: [], posts: [] };
      if (!Array.isArray(state.db.forum.boards)) state.db.forum.boards = [];
      if (!Array.isArray(state.db.forum.posts)) state.db.forum.posts = [];

      var changed = false;

      /* 0.1 互助板块 */
      if (!state.db.forum.boards.some(function (b) { return b.id === 'help'; })) {
        state.db.forum.boards.push({ id: 'help', name: '互助板块', hot: true });
        changed = true;
      }

      /* 0.2 p_help 帖子 */
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
        /* 完全不存在 → 整帖补上 */
        state.db.forum.posts.push(pHelpData);
        changed = true;
      } else {
        /* 存在但可能被快照覆盖成旧版本 → 检查楼层里是否有"加入"按钮 */
        var hasJoinAction = Array.isArray(existing.floors) &&
          existing.floors.some(function (f) {
            return f.action && f.action.type === 'join-group';
          });
        if (!hasJoinAction) {
          /* 楼层被覆盖 / 缺 action → 用最新的 floors 替换，其他字段保留 */
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

    /* 启动时先补一次 */
    ensureHelpBoardFull();

    /* 每 2 秒兜底一次 */
    setInterval(ensureHelpBoardFull, 2000);

    /* ============================================================
       1. 拦截 CursorGuide.show —— 问卷已提交时忽略指向问卷的光标
       ============================================================ */
    var origShow = CursorGuide.show;
    CursorGuide.show = function (selector, label) {
      if (flag('s9_questionnaire_done')) {
        if ((typeof selector === 'string' && selector.indexOf('questionnaire') >= 0) ||
            (label && String(label).indexOf('填写问卷') >= 0)) {
          return;
        }
      }
      return origShow.call(this, selector, label);
    };

    /* ============================================================
       2. 论坛：渲染前强制补 p_help + 自动切互助板块
       ============================================================ */
    var origForum = PAGES.forum;
    PAGES.forum = function (params) {
      ensureHelpBoardFull();
      var def = origForum(params);
      var origMount = def.mount;
      def.mount = function (root) {
        if (origMount) origMount(root);
        /* 周学姐引导去论坛 → 自动切互助板块（只看一次） */
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

    /* 帖子详情页也补，避免直接路由到 p_help 时找不到 */
    if (PAGES.forumPost) {
      var origForumPost = PAGES.forumPost;
      PAGES.forumPost = function (params) {
        ensureHelpBoardFull();
        return origForumPost(params);
      };
    }

    /* ============================================================
       3. overlay 强制 pointer-events: auto，防点击穿透
       ============================================================ */
    var layers = document.getElementById('layers');
    if (layers) {
      var ensureOverlayPE = function () {
        var ov = document.getElementById('wxg-warning-overlay');
        if (ov && ov.style.pointerEvents !== 'auto') {
          ov.style.pointerEvents = 'auto';
        }
      };
      try {
        new MutationObserver(ensureOverlayPE).observe(layers, { childList: true, subtree: true });
      } catch (e) { /* 旧浏览器降级 */ }
      ensureOverlayPE();
    }

    /* ============================================================
       4. window capture 阶段拦截 submit 重复触发
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
       5. 包装 ConfirmBox.open，弹窗前清掉残留 overlay
       ============================================================ */
    if (ConfirmBox && ConfirmBox.open) {
      var origConfirm = ConfirmBox.open;
      ConfirmBox.open = function (opts) {
        var ov = document.getElementById('wxg-warning-overlay');
        if (ov) ov.remove();
        return origConfirm.call(this, opts);
      };
    }

    /* ============================================================
       6. 启动时清理残留（旧存档卡死时能自愈）
       ============================================================ */
    var stale = document.getElementById('wxg-warning-overlay');
    if (stale) stale.remove();

    /* ============================================================
       7. 暴露给外部使用
       ============================================================ */
    window.StoryFix = {
      ensureHelpBoardFull: ensureHelpBoardFull
    };

    console.log('[story-fix v1.1] 已加载：互助板块兜底 / 光标拦截 / 黑屏防穿透 / 提交防抖');
  });
})();
