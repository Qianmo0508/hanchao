/* ================================================================
   story-patch.js  v1.2
   修复清单：
   1. PAGES.chat 完全重写：仅"妈妈"点击输入框弹校外通讯警示，其余一律点不动
   2. 备忘录看完后的光标引导：改为回桌面后指向消息 App
   3. 群聊1看完后的光标引导：回桌面后指向论坛 App（修复指向不存在元素）
   4. 群邀请通知：玩家看过备忘录后，在消息区域探索累计 8 秒触发
   5. 论坛帖子通知：滚动到底后 1.5 秒触发，12 秒兜底，不再一进页就弹
   6. 系统公告第8幕通知：滚动到底后 1.2 秒触发，10 秒兜底，不再一打开就弹
   7. 第8幕群消息：进入群聊后逐条展示，间隔 1.4~1.6 秒
   8. 第9幕好友申请：维持原 CHOICES.grp3 末尾触发，但确保第8幕选项出现前不会提前弹
   9. 所有群消息间隔拉长到 1.4~1.7 秒，给玩家反应时间
   10. 首次加载时如果玩家已在群聊页，自动补触发一次
   ================================================================ */
(function () {
  'use strict';

  function ready(fn) {
    if (typeof PAGES !== 'undefined' &&
        typeof STORY !== 'undefined' &&
        typeof Router !== 'undefined' &&
        typeof CursorGuide !== 'undefined' &&
        typeof NotifService !== 'undefined' &&
        typeof Typewriter !== 'undefined' &&
        typeof themSay !== 'undefined' &&
        typeof refreshChat !== 'undefined') {
      fn();
    } else {
      setTimeout(function () { ready(fn); }, 80);
    }
  }

  ready(function () {

    /* ============================================================
       0. 工具：补丁内部使用
       ============================================================ */
    var P = {
      chat: function (params) { return PAGES.chat(params); },
      home: function () { return PAGES.home(); }
    };

    /* ============================================================
       1. PAGES.chat 完全重写
          - 仅 cid === 'mom' 保留 data-action="send-blocked"
          - 其余所有会话输入框 dead，不弹任何提示
          - 保留消息渲染、卡片、链接、固定选项、群聊发言者显示
       ============================================================ */
    PAGES.chat = function (params) {
      var cid = params.id;
      var chat = state.db.chats[cid];
      if (!chat) {
        return simplePage('会话不存在', '<div class="empty">该会话不存在或已被删除。</div>');
      }
      state.unread[cid] = 0;
      save();

      var msgsHtml = '';
      (chat.messages || []).forEach(function (m) {
        if (m.type === 'system') {
          msgsHtml += '<div class="msg-sys">' + esc(m.text) + '</div>';
          return;
        }
        if (m.type === 'card') {
          msgsHtml += '<div class="msg">' +
            '<div class="msg-av">' + esc(chat.avatar) + '</div>' +
            '<div class="msg-wrap">' +
              '<div class="msg-name">' + esc(m.title) + '</div>' +
              '<div class="gzh-card" data-action="gzh-card">' +
                '<div class="g-title">' + esc(m.title) + '</div>' +
                '<div class="g-desc">' + esc(m.desc) + '</div>' +
                '<div class="g-time">' + esc(m.time) + '</div>' +
              '</div>' +
            '</div>' +
          '</div>';
          return;
        }
        var isMe = m.from === 'me';
        var showName = chat.type === 'group' && !isMe;
        var textHtml = esc(m.text || '');
        if (m.link) {
          textHtml = textHtml.replace(esc(m.link.text),
            '<span class="link" data-action="jump" data-page="' + esc(m.link.page) +
            '" data-params="' + esc(JSON.stringify(m.link.params || {})) + '">' +
            esc(m.link.text) + '</span>');
        }
        msgsHtml += '<div class="msg ' + (isMe ? 'me' : '') + '">' +
          '<div class="msg-av">' + (isMe ? '🫥' : esc(chat.type === 'group' ? (m.from || '?').slice(0, 1) : chat.avatar)) + '</div>' +
          '<div class="msg-wrap">' +
            (showName ? '<div class="msg-name">' + esc(m.from) + '</div>' : '') +
            '<div class="bubble">' + textHtml + '</div>' +
            '<div class="msg-time">' + esc(m.time || '') + '</div>' +
          '</div>' +
        '</div>';
      });

      var inputArea;
      if (state.choice && state.choice.chatId === cid) {
        inputArea = '<div class="choice-bar" id="choice-bar">' +
          state.choice.options.map(function (o) {
            return '<button class="choice-btn" data-action="choose" data-key="' + esc(o.k) + '">' + esc(o.label) + '</button>';
          }).join('') +
        '</div>';
      } else if (chat.type === 'self' || chat.silent) {
        inputArea = '<div class="chat-input"><div class="input-fake dead">发送消息</div></div>';
      } else if (cid === 'mom') {
        // 只有妈妈这一处是校外人员，点击弹警示
        inputArea = '<div class="chat-input"><div class="input-fake" data-action="send-blocked" data-chat="mom">发送消息…</div></div>';
      } else {
        // 其余全部点不动，不弹任何提示
        inputArea = '<div class="chat-input"><div class="input-fake dead">发送消息…</div></div>';
      }

      return {
        html: '<div class="page">' +
          navBar(chat.name, {
            back: true,
            right: chat.type === 'group'
              ? '<button class="nav-btn" data-action="chat-info" data-id="' + esc(cid) + '">···</button>'
              : ''
          }) +
          '<div class="page-body chat-body" id="chat-body">' +
            (msgsHtml || '<div class="empty">暂无消息</div>') +
          '</div>' +
          inputArea +
        '</div>',
        mount: function (root) {
          var body = root.querySelector('#chat-body');
          if (body) body.scrollTop = body.scrollHeight;
          onOpenChatPatch(cid);
        }
      };
    };

    /* ============================================================
       2. onOpenChatPatch：群聊进入钩子
       ============================================================ */
    function onOpenChatPatch(cid) {
      if (cid !== 'by') return;
      var chat = state.db.chats.by;

      if (chat.joined === false) {
        chat.joined = true;
        if (!chat.messages.length) {
          chat.messages.push({
            id: uid('m'),
            type: 'system',
            text: '“王晓歌”被拉入群聊',
            time: '2025-05-08 18:02'
          });
        }
        save();
        setTimeout(function () { render(); }, 40);
      }

      if (flag('invited') && !flag('grp1msgs')) {
        flag('grp1msgs', true);
        setTimeout(function () { runGroup1Patch(); }, 1000);
      }

      if (flag('pending_s8') && !flag('s8msgs')) {
        flag('pending_s8', false);
        flag('s8msgs', true);
        setTimeout(function () { runScene8MsgsPatch(); }, 1000);
      }
    }

    /* ============================================================
       3. 第4幕群消息 + 论坛引导
       ============================================================ */
    async function runGroup1Patch() {
      var cid = 'by';
      await themSay(cid, '沈敏', '这不是412的？王晓歌？', 1400);
      await themSay(cid, '沈敏', '卧槽你们拉她干嘛啊！？', 1700);
      await themSay(cid, '临爽', '？什么，详细说来👂🏻', 1700);
      await themSay(cid, '沈敏', '也没什么…就，你自己看看论坛', 1700);
      await sleep(1500);

      if (!flag('forumGuided')) {
        flag('forumGuided', true);
        // 关键修复：回桌面（论坛图标只存在于桌面）
        Router.root('home');
        setTimeout(function () {
          CursorGuide.show('[data-app="forum"]', '去看看渠中校园论坛');
        }, 900);
      }
    }

    /* ============================================================
       4. 第8幕群消息 + 固定选项2
       ============================================================ */
    async function runScene8MsgsPatch() {
      var cid = 'by';
      await themSay(cid, '张夏夏', '你们看新的通知了没？', 1400);
      await themSay(cid, '沈敏', '看到了，这也太苛刻了吧？！', 1600);
      await themSay(cid, '临爽', '才特么6点就不让出楼…是人吗…', 1600);
      await themSay(cid, '许双荞', '现在貌似已经六点了', 1600);
      await themSay(cid, '周学姐', '@所有人 现在开始所有人不要出楼！', 1600);
      await themSay(cid, '邓许', '我倒是有个疑问啊……', 1600);
      await themSay(cid, '邓许', '寒潮是寒潮，出个宿舍楼和“人身安全”有什么关系？', 1600);
      await themSay(cid, '邓许', '又和固定的时间有什么关系？', 1600);
      await themSay(cid, '沈敏', '说的对啊……顶多被冻着，可这应该算健康问题，怎么能算人身安全', 1600);

      state.choice = {
        chatId: cid,
        nodeId: 'grp3',
        options: [
          { k: 'a', label: '①也许是现在很冷呢？' },
          { k: 'b', label: '②这很不对劲' }
        ]
      };
      refreshChat(cid);
    }

    /* ============================================================
       5. PAGES.home 包装：显示引导光标
       ============================================================ */
    var origHome = PAGES.home;
    PAGES.home = function () {
      var def = origHome();
      var origMount = def.mount;
      def.mount = function (root) {
        if (origMount) origMount(root);

        // 备忘录看完后的消息引导
        if (flag('needMsgGuide') && !flag('msgGuideDone')) {
          setTimeout(function () {
            CursorGuide.show('[data-app="messages"]', '去看看消息吧');
          }, 900);
        }

        // 群聊1看完后的论坛引导（如果玩家还没进过论坛）
        if (flag('forumGuided') && !flag('forumVisited')) {
          setTimeout(function () {
            CursorGuide.show('[data-app="forum"]', '去看看渠中校园论坛');
          }, 900);
        }
      };
      return def;
    };

    /* ============================================================
       6. PAGES.memoDetail 包装：轮询检测打字完成
       ============================================================ */
    var origMemoDetail = PAGES.memoDetail;
    PAGES.memoDetail = function (params) {
      var def = origMemoDetail(params);
      if (params.id !== 'memo_open') return def;

      var origMount = def.mount;
      def.mount = function (root) {
        if (origMount) origMount(root);

        var check = setInterval(function () {
          if (flag('memoRead')) {
            clearInterval(check);
            if (!flag('memoGuideShown')) {
              flag('memoGuideShown', true);
              flag('needMsgGuide', true);
              // 在备忘录页显示指向返回按钮的引导
              var backBtn = root.querySelector('[data-action="back"]');
              if (backBtn) {
                CursorGuide.show('[data-action="back"]', '返回桌面，去看看消息');
              } else {
                Toast.show('返回桌面，去看看消息吧', 3200);
              }
            }
          }
        }, 400);

        setTimeout(function () { clearInterval(check); }, 40000);
      };
      return def;
    };

    /* ============================================================
       7. PAGES.forumPost 完全重写：滚动到底触发通知
       ============================================================ */
    PAGES.forumPost = function (params) {
      var p = state.db.forum.posts.find(function (x) { return x.id === params.id; });
      if (!p) return simplePage('帖子', '<div class="empty">帖子已被删除</div>');

      var floors = p.floors.map(function (f) {
        return '<div class="floor">' +
          '<div class="floor-head">' +
            '<span class="floor-user">' + esc(f.user) + '</span>' +
            '<span class="floor-num">' + f.n + '楼</span>' +
          '</div>' +
          '<div class="floor-body">' +
            (f.quote ? '<span class="quote">回复 @' + esc(f.quote) + '：</span>' : '') +
            esc(f.text) +
          '</div>' +
        '</div>';
      }).join('');

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
            '<div class="card" style="padding:0;">' + floors + '</div>' +
            (p.locked ? '<div class="locked-tip">本帖已被管理员“' + esc(p.lockedBy || 'zhou') + '”设置为“禁止回复”</div>' : '') +
          '</div>' +
        '</div>',
        mount: function (root) {
          if (!p || p.id !== 'p1' || flag('readPost1')) return;

          var triggered = false;
          var trigger = function () {
            if (triggered || flag('readPost1')) return;
            triggered = true;
            flag('readPost1', true);
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
          // 兜底：即使不滚动，12 秒后也触发
          setTimeout(trigger, 12000);
        }
      };
    };

    /* ============================================================
       8. PAGES.notice 完全重写：滚动到底触发第8幕通知
       ============================================================ */
    PAGES.notice = function () {
      var n = state.db.notice;
      var secs = n.sections.map(function (s) {
        return '<div class="notice-sec ' + (s.red ? 'red' : '') + '">' +
          '<b>' + esc(s.no) + '</b>　' + esc(s.text) +
        '</div>';
      }).join('');

      return {
        html: '<div class="page">' +
          navBar('系统公告') +
          '<div class="page-body" id="notice-body">' +
            '<div class="notice-doc">' +
              '<h2>' + esc(n.title) + '</h2>' +
              '<div class="notice-meta">' +
                esc(n.meta.pub) + '<br>' +
                '发布单位：' + esc(n.meta.unit) + '<br>' +
                '文号：' + esc(n.meta.doc) + '<br>' +
                '发布日期：' + esc(n.meta.date) +
              '</div>' +
              secs +
              '<div class="notice-sign">' + esc(n.sign).replace(/\n/g, '<br>') + '</div>' +
            '</div>' +
            '<div class="px4 txt-xs txt-3 center" style="padding-bottom:var(--sp-6);">本公告由小渠自动发布 · 请勿转发</div>' +
          '</div>' +
        '</div>',
        mount: function (root) {
          if (flag('readNotice')) return;

          var triggered = false;
          var trigger = function () {
            if (triggered || flag('readNotice')) return;
            triggered = true;
            flag('readNotice', true);
            flag('s8Notified', true);
            flag('pending_s8', true);
            NotifService.push({
              id: 'n_s8',
              title: '北苑留校女生群有新消息',
              detail: '张夏夏：你们看新的通知了没？',
              target: { page: 'chat', params: { id: 'by' } }
            });
          };

          var body = root.querySelector('#notice-body');
          if (body) {
            body.addEventListener('scroll', function () {
              if (body.scrollTop + body.clientHeight >= body.scrollHeight - 60) {
                setTimeout(trigger, 1200);
              }
            }, { passive: true });
          }
          // 兜底：即使不滚动，10 秒后也触发
          setTimeout(trigger, 10000);
        }
      };
    };

    /* ============================================================
       9. Router.push 钩子：标记引导完成
       ============================================================ */
    var origPush = Router.push.bind(Router);
    Router.push = function (page, params) {
      if (page === 'forum' || page === 'forumPost') {
        flag('forumVisited', true);
        CursorGuide.hide();
      }
      if (page === 'messages' || page === 'chat' || page === 'contacts' || page === 'contact') {
        flag('msgGuideDone', true);
      }
      origPush(page, params);
    };

    /* ============================================================
       10. 群邀请触发器
           条件：已看过备忘录，在消息区域探索累计 8 秒
       ============================================================ */
    var msgAreaTime = 0;
    var lastTick = Date.now();
    var inviteTriggered = false;

    setInterval(function () {
      var now = Date.now();
      var dt = now - lastTick;
      lastTick = now;

      if (inviteTriggered || flag('invited') || !flag('memoRead')) {
        msgAreaTime = 0;
        return;
      }

      var cur = Router.current();
      var inMsgArea =
        cur.page === 'messages' ||
        cur.page === 'chat' ||
        cur.page === 'contacts' ||
        cur.page === 'contact' ||
        cur.page === 'friendRequests';

      if (inMsgArea) {
        msgAreaTime += dt;
      } else {
        // 离开消息区域时缓慢衰减，避免玩家被迫一直待着
        msgAreaTime = Math.max(0, msgAreaTime - dt * 0.6);
      }

      if (msgAreaTime > 8000) {
        inviteTriggered = true;
        flag('invited', true);
        NotifService.push({
          id: 'n_invite',
          title: '您已被邀请进入“北苑留校女生群”',
          detail: '点击加入群聊',
          target: { page: 'chat', params: { id: 'by' } }
        });
      }
    }, 500);

    /* ============================================================
       11. 补触发：如果补丁加载时玩家已经在群聊
       ============================================================ */
    setTimeout(function () {
      var cur = Router.current();
      if (cur.page === 'chat' && cur.params.id === 'by') {
        onOpenChatPatch('by');
      }
    }, 800);

    /* ============================================================
       12. 兼容：原 CHOICES.grp3 末尾触发 scene9
           这里只做一次时序保险，确保第8幕选项出现前不会提前弹
       ============================================================ */
    var origTriggerStory = triggerStory;
    window.triggerStory = function (id) {
      if (id === 'scene9') {
        // 只有第8幕选项处理完（grp3done）才允许触发
        if (!flag('grp3done')) {
          console.warn('[story-patch] scene9 被提前调用，已拦截');
          return;
        }
      }
      return origTriggerStory(id);
    };

    console.log('[story-patch v1.2] 已加载，全部修复生效');
  });
})();
