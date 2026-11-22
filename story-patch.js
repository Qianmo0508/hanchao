/* ================================================================
   story-patch.js  v1.3
   在 v1.2 基础上新增/修复：
   1. 【关键】第6幕群聊2：点击"临爽：我靠别搞啊，有点吓人了"通知回群聊后，
      自动续播"临爽/许双荞/沈敏"三条新消息，并弹出固定选项1
      （①我是她室友陈默 / ②其实我一直阴魂不散哦）
   2. 好友申请时序确认：仅在 grp3 选项（"大家都早点睡"）之后触发
   3. 好友申请通过后不接任何后续剧情（用户尚未写完，留空）
   4. 保留 v1.2 所有修复（群邀请 8 秒触发器、论坛/公告滚动触发、
      备忘录/群聊1引导、只有妈妈弹警示、群消息间隔 1.4~1.7 秒）
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
        typeof refreshChat !== 'undefined' &&
        typeof CHOICES !== 'undefined') {
      fn();
    } else {
      setTimeout(function () { ready(fn); }, 80);
    }
  }

  ready(function () {

    /* ============================================================
       1. PAGES.chat 完全重写
          - 仅 cid === 'mom' 保留 data-action="send-blocked"
          - 其余所有会话输入框 dead，不弹任何提示
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
        inputArea = '<div class="chat-input"><div class="input-fake" data-action="send-blocked" data-chat="mom">发送消息…</div></div>';
      } else {
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
          按剧情顺序依次检测：
          a) 首次进群 → 加入系统消息
          b) 第4幕群聊1（grp1msgs）
          c) 第6幕群聊2（grp2msgs）—— 需 readPost1 为真且当前无等待选项
          d) 第8幕群聊（s8msgs）—— 需 pending_s8 为真
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

      // 第4幕群聊1
      if (flag('invited') && !flag('grp1msgs')) {
        flag('grp1msgs', true);
        setTimeout(function () { runGroup1Patch(); }, 1000);
        return;
      }

      // 第6幕群聊2：玩家已读完论坛帖子，且当前没有未处理的固定选项
      if (flag('readPost1') && !flag('grp2msgs') &&
          !(state.choice && state.choice.chatId === 'by')) {
        flag('grp2msgs', true);
        setTimeout(function () { runGroup2Patch(); }, 1000);
        return;
      }

      // 第8幕群聊
      if (flag('pending_s8') && !flag('s8msgs')) {
        flag('pending_s8', false);
        flag('s8msgs', true);
        setTimeout(function () { runScene8MsgsPatch(); }, 1000);
        return;
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
        Router.root('home');
        setTimeout(function () {
          CursorGuide.show('[data-app="forum"]', '去看看渠中校园论坛');
        }, 900);
      }
    }

    /* ============================================================
       4. 第6幕群消息 + 固定选项1
          由 readPost1 触发：玩家点"临爽：我靠别搞啊"通知回群聊后自动续播
       ============================================================ */
    async function runGroup2Patch() {
      var cid = 'by';
      await themSay(cid, '临爽', '我靠别搞啊，有点吓人了', 1200);
      await themSay(cid, '许双荞', '群主是周学姐吗？', 1600);
      await themSay(cid, '沈敏', '@周学姐 学姐拉她干嘛啊啊别来索我命我什么都没干', 1600);
      await sleep(700);

      state.choice = {
        chatId: cid,
        nodeId: 'grp1',
        options: [
          { k: 'a', label: '①我是她室友陈默' },
          { k: 'b', label: '②其实我一直阴魂不散哦' }
        ]
      };
      save();
      refreshChat(cid);
    }

    /* ============================================================
       5. 第8幕群消息 + 固定选项2
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
      save();
      refreshChat(cid);
    }

    /* ============================================================
       6. PAGES.home 包装：显示引导光标
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

        // 群聊1看完后的论坛引导
        if (flag('forumGuided') && !flag('forumVisited')) {
          setTimeout(function () {
            CursorGuide.show('[data-app="forum"]', '去看看渠中校园论坛');
          }, 900);
        }
      };
      return def;
    };

    /* ============================================================
       7. PAGES.memoDetail 包装：打字完成后触发消息引导
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
       8. PAGES.forumPost 完全重写：滚动到底触发通知
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
          setTimeout(trigger, 12000);
        }
      };
    };

    /* ============================================================
       9. PAGES.notice 完全重写：滚动到底触发第8幕通知
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
          setTimeout(trigger, 10000);
        }
      };
    };

    /* ============================================================
       10. Router.push 钩子：标记引导完成
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
       11. 群邀请触发器：看备忘录后，在消息区域探索累计 8 秒
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
       12. 好友申请通过后：先留空（用户后续再补剧情）
       ============================================================ */
    var origHandleAction = window.handleAction;
    if (typeof origHandleAction === 'function') {
      window.handleAction = async function (action, el) {
        if (action === 'fr-accept') {
          var id = el.dataset.id;
          var fr = state.db.friendRequests.find(function (x) { return x.id === id; });
          if (fr && fr.status === 'pending') {
            fr.status = 'accepted';
            var c = state.db.contacts.find(function (x) { return x.name === fr.from; });
            if (c) c.hidden = false;
            // 临爽的私聊会话
            if (fr.from === '临爽' && !state.db.chats.ls) {
              state.db.chats.ls = {
                id: 'ls', type: 'private', name: '临爽', avatar: '😆',
                canSend: false, warn: '寒潮期间禁止与校外人员通讯',
                messages: []
              };
            }
            save();
            Toast.show('已通过好友申请');
            // 后续剧情留空（用户尚未写完）
            render();
            return;
          }
        }
        return origHandleAction(action, el);
      };
    }

    /* ============================================================
       13. scene9 拦截：确保好友申请通知在"大家都早点睡"之后才弹
       ============================================================ */
    var origTriggerStory = window.triggerStory;
    window.triggerStory = function (id) {
      if (id === 'scene9') {
        if (!flag('grp3done')) {
          console.warn('[story-patch] scene9 被提前调用，已拦截');
          return;
        }
      }
      return origTriggerStory(id);
    };

    /* ============================================================
       14. 补触发：如果补丁加载时玩家已在群聊
       ============================================================ */
    setTimeout(function () {
      var cur = Router.current();
      if (cur.page === 'chat' && cur.params.id === 'by') {
        onOpenChatPatch('by');
      }
    }, 800);

    console.log('[story-patch v1.3] 已加载：第6幕群聊2自动续播，好友申请时序确认');
  });
})();
