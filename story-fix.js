/* ================================================================
   story-fix.js  v1.0
   加载顺序：story-patch.js → story-extension.js → story-speed.js → story-fix.js

   本文件不改动前面任何文件，只做"补丁层的补丁"。

   v1.0 修复三处：
   1. 【"点击填写问卷"光标残留】
      根因：story-speed.js 的 handleByChatExt 也有一份 stage 4 显示光标的
            代码，没检查 s9_questionnaire_done。而 story-extension.js 里的
            同名函数因为 PAGES.chat.mount 被 story-speed.js 覆盖，根本不跑。
      修复：直接拦截 CursorGuide.show。s9_questionnaire_done 为真时，
            忽略任何指向 questionnaire 的指引。因为 story-speed.js 也是走
            全局 CursorGuide.show，所以一网打尽。

   2. 【周学姐引导去论坛时自动跳互助板块】
      根因：论坛默认停在 gossip 板块，玩家找不到"互助板块" tab。
      修复：包装 PAGES.forum.mount，zx_stage >= 2 且未看过 help 时，
            自动 click "互助板块" tab。

   3. 【黑屏红字反复触发 / "继续"按钮点了没用】
      根因：
        · overlay 的 pointer-events 继承 #layers 的 none，点击穿透到下方
          的"提交"按钮，每次都重新触发 handleSubmitQuestionnaire，
          导致 showWarningScreen 被打断重来，玩家只看到"作答错误"反复闪。
        · 多次并行 onDone → 多个 Router.root('lock') + 多个 ConfirmBox，
          "继续"按钮点到的是混乱中的一个。
      修复：
        · MutationObserver 监控 overlay 出现后强制 pointer-events: auto
        · window capture 阶段拦截 submit 点击，overlay 存在或 1.5s 内
          重复提交直接 stopPropagation
        · 包装 ConfirmBox.open，弹窗前先清掉残留 overlay
        · 启动时清掉可能残留的 overlay
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
        typeof save === 'function') {
      fn();
    } else {
      setTimeout(function () { ready(fn); }, 80);
    }
  }

  ready(function () {

    /* ============================================================
       1. 拦截 CursorGuide.show —— 问卷已提交时忽略指向问卷的光标
       ============================================================ */
    var origShow = CursorGuide.show;
    CursorGuide.show = function (selector, label) {
      if (flag('s9_questionnaire_done')) {
        if ((typeof selector === 'string' && selector.indexOf('questionnaire') >= 0) ||
            (label && String(label).indexOf('填写问卷') >= 0)) {
          // 直接吞掉，不显示
          return;
        }
      }
      return origShow.call(this, selector, label);
    };

    /* ============================================================
       2. 论坛自动切互助板块
       ============================================================ */
    var origForum = PAGES.forum;
    PAGES.forum = function (params) {
      var def = origForum(params);
      var origMount = def.mount;
      def.mount = function (root) {
        if (origMount) origMount(root);
        // 周学姐剧情推进到引导去论坛（zx_stage >= 2）且还没看过互助板块
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
          （window 的 capture 比 document 的 capture 更早执行，
            所以能在 story-extension.js 的 listener 之前拦住）
       ============================================================ */
    window.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest && e.target.closest('[data-action="submit-questionnaire"]');
      if (!btn) return;
      // 黑屏 overlay 正在显示 → 完全阻止
      if (document.getElementById('wxg-warning-overlay')) {
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      // 1.5 秒内重复提交 → 阻止
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

    console.log('[story-fix v1.0] 已加载：光标拦截 / 论坛引导 / 黑屏防穿透 / 提交防抖');
  });
})();
