// ═══════════════════════════════════════════════════════════════
//  AgroMetrix Radar — Sistema de Chat
// ═══════════════════════════════════════════════════════════════

class ChatSystem {
  constructor() {
    this.messages = [];
    this.conversations = new Map();
    this.listeners = [];
  }

  addMessage(senderId, senderName, receiverId, message, type = 'chat') {
    const msg = {
      id: Date.now() + Math.random(),
      senderId: senderId,
      senderName: senderName,
      receiverId: receiverId,
      message: message,
      type: type,
      timestamp: new Date().toISOString(),
      read: false
    };
    
    const convId = [senderId, receiverId].sort().join('_');
    if (!this.conversations.has(convId)) {
      this.conversations.set(convId, []);
    }
    this.conversations.get(convId).push(msg);
    this.messages.push(msg);
    
    this.notifyListeners('newMessage', msg);
    
    return msg;
  }

  notifyAccept(requesterId, acceptorId, acceptorName, requestMsg) {
    const msg = this.addMessage(
      acceptorId, 
      acceptorName, 
      requesterId,
      '✅ Aceitou seu chamado: "' + requestMsg + '"',
      'accept'
    );
    
    window.dispatchEvent(new CustomEvent('amx:chat-notification', {
      detail: { type: 'accept', message: msg, from: acceptorName }
    }));
    
    return msg;
  }

  getUserConversations(userId) {
    const convs = [];
    for (let [convId, msgs] of this.conversations) {
      if (convId.includes(userId)) {
        const otherId = convId.split('_').find(function(id) { return id !== userId; });
        const lastMsg = msgs[msgs.length - 1];
        convs.push({
          id: convId,
          otherId: otherId,
          otherName: (msgs.find(function(m) { return m.senderId === otherId; }) || {}).senderName || 'Piloto',
          lastMessage: lastMsg,
          unread: msgs.filter(function(m) { return m.receiverId === userId && !m.read; }).length
        });
      }
    }
    return convs.sort(function(a, b) {
      return new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp);
    });
  }

  markAsRead(convId, userId) {
    const msgs = this.conversations.get(convId);
    if (msgs) {
      for (let i = 0; i < msgs.length; i++) {
        if (msgs[i].receiverId === userId && !msgs[i].read) {
          msgs[i].read = true;
        }
      }
      this.notifyListeners('readUpdate', { convId: convId, userId: userId });
    }
  }

  sendChat(senderId, senderName, receiverId, message) {
    return this.addMessage(senderId, senderName, receiverId, message, 'chat');
  }

  on(event, callback) {
    this.listeners.push({ event: event, callback: callback });
  }

  notifyListeners(event, data) {
    for (let i = 0; i < this.listeners.length; i++) {
      if (this.listeners[i].event === event) {
        this.listeners[i].callback(data);
      }
    }
  }

  renderChatUI(containerId, currentUserId, currentUserName) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    let currentConvId = null;
    let currentOtherId = null;
    let currentOtherName = '';
    let isOpen = false;
    
    container.innerHTML = '<div id="amx-chat-widget" style="position:fixed;bottom:20px;right:20px;z-index:1000;font-family:Syne,sans-serif">' +
      '<button id="amx-chat-toggle" style="width:56px;height:56px;border-radius:28px;background:#1f5534;border:none;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center">' +
        '<span style="font-size:24px">💬</span>' +
        '<span id="amx-chat-badge" style="position:absolute;top:-5px;right:-5px;background:#e03535;color:white;border-radius:10px;padding:2px 6px;font-size:10px;display:none">0</span>' +
      '</button>' +
      '<div id="amx-chat-panel" style="display:none;position:absolute;bottom:70px;right:0;width:350px;height:500px;background:#0d1a0f;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.4);overflow:hidden;flex-direction:column">' +
        '<div style="padding:12px;background:#1f5534;color:white;display:flex;justify-content:space-between;align-items:center">' +
          '<span style="font-weight:700">💬 Conversas</span>' +
          '<button id="amx-chat-close" style="background:none;border:none;color:white;font-size:20px;cursor:pointer">✕</button>' +
        '</div>' +
        '<div id="amx-chat-conversations" style="flex:1;overflow-y:auto;padding:8px"></div>' +
        '<div id="amx-chat-messages-area" style="display:none;flex-direction:column;height:100%">' +
          '<div style="padding:8px;background:#1a2a1f;border-bottom:1px solid #2a3a2a">' +
            '<button id="amx-chat-back" style="background:none;border:none;color:#5ec880;cursor:pointer">← Voltar</button>' +
            '<span id="amx-chat-with" style="margin-left:8px;color:white"></span>' +
          '</div>' +
          '<div id="amx-chat-messages" style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px"></div>' +
          '<div style="padding:12px;border-top:1px solid #2a3a2a;display:flex;gap:8px">' +
            '<input id="amx-chat-input" type="text" placeholder="Digite sua mensagem..." style="flex:1;padding:8px;border-radius:8px;border:none;background:#1a2a1f;color:white">' +
            '<button id="amx-chat-send" style="padding:8px 16px;background:#3da866;border:none;border-radius:8px;color:white;cursor:pointer">Enviar</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
    
    const toggle = document.getElementById('amx-chat-toggle');
    const panel = document.getElementById('amx-chat-panel');
    const close = document.getElementById('amx-chat-close');
    const conversationsDiv = document.getElementById('amx-chat-conversations');
    const messagesArea = document.getElementById('amx-chat-messages-area');
    const backBtn = document.getElementById('amx-chat-back');
    const messagesDiv = document.getElementById('amx-chat-messages');
    const chatInput = document.getElementById('amx-chat-input');
    const sendBtn = document.getElementById('amx-chat-send');
    const chatWith = document.getElementById('amx-chat-with');
    const badge = document.getElementById('amx-chat-badge');
    
    const self = this;
    
    function renderConversations() {
      const convs = self.getUserConversations(currentUserId);
      let totalUnread = 0;
      for (let i = 0; i < convs.length; i++) {
        totalUnread += convs[i].unread;
      }
      
      if (badge) {
        badge.style.display = totalUnread > 0 ? 'flex' : 'none';
        badge.textContent = totalUnread > 99 ? '99+' : totalUnread;
      }
      
      if (conversationsDiv) {
        if (convs.length === 0) {
          conversationsDiv.innerHTML = '<div style="text-align:center;padding:20px;color:#5a8a65">Nenhuma conversa ainda</div>';
          return;
        }
        
        let html = '';
        for (let i = 0; i < convs.length; i++) {
          var conv = convs[i];
          html += '<div class="amx-conversation-item" data-convid="' + conv.id + '" data-otherid="' + conv.otherId + '" data-othername="' + conv.otherName + '" style="padding:12px;border-bottom:1px solid #2a3a2a;cursor:pointer;background:' + (conv.unread > 0 ? '#1f5534' : 'transparent') + '">' +
            '<div style="display:flex;justify-content:space-between;align-items:center">' +
              '<div>' +
                '<div style="font-weight:700;color:white">' + conv.otherName + '</div>' +
                '<div style="font-size:11px;color:#5a8a65;margin-top:4px">' + (conv.lastMessage.message.substring(0, 40)) + (conv.lastMessage.message.length > 40 ? '...' : '') + '</div>' +
              '</div>' +
              '<div style="text-align:right">' +
                '<div style="font-size:10px;color:#5a8a65">' + new Date(conv.lastMessage.timestamp).toLocaleTimeString() + '</div>' +
                (conv.unread > 0 ? '<div style="margin-top:4px;background:#e03535;border-radius:10px;padding:2px 6px;font-size:10px;color:white">' + conv.unread + '</div>' : '') +
              '</div>' +
            '</div>' +
          '</div>';
        }
        conversationsDiv.innerHTML = html;
        
        var items = document.querySelectorAll('.amx-conversation-item');
        for (var i = 0; i < items.length; i++) {
          var el = items[i];
          el.addEventListener('click', (function(elem) {
            return function() {
              currentConvId = elem.dataset.convid;
              currentOtherId = elem.dataset.otherid;
              currentOtherName = elem.dataset.othername;
              self.markAsRead(currentConvId, currentUserId);
              renderMessages();
              conversationsDiv.style.display = 'none';
              messagesArea.style.display = 'flex';
              chatWith.textContent = currentOtherName;
              renderConversations();
            };
          })(el));
        }
      }
    }
    
    function renderMessages() {
      var msgs = self.conversations.get(currentConvId) || [];
      var html = '';
      for (var i = 0; i < msgs.length; i++) {
        var msg = msgs[i];
        html += '<div style="display:flex;justify-content:' + (msg.senderId === currentUserId ? 'flex-end' : 'flex-start') + '">' +
          '<div style="max-width:70%;padding:8px 12px;border-radius:12px;background:' + (msg.senderId === currentUserId ? '#3da866' : '#1a2a1f') + ';color:white">' +
            (msg.senderId !== currentUserId ? '<div style="font-size:10px;color:#5a8a65;margin-bottom:4px">' + msg.senderName + '</div>' : '') +
            '<div style="font-size:13px">' + msg.message + '</div>' +
            '<div style="font-size:9px;color:#5a8a65;margin-top:4px;text-align:right">' + new Date(msg.timestamp).toLocaleTimeString() + '</div>' +
          '</div>' +
        '</div>';
      }
      messagesDiv.innerHTML = html;
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
    
    backBtn.addEventListener('click', function() {
      currentConvId = null;
      conversationsDiv.style.display = 'block';
      messagesArea.style.display = 'none';
      renderConversations();
    });
    
    function sendMessage() {
      var text = chatInput.value.trim();
      if (!text || !currentOtherId) return;
      
      self.sendChat(currentUserId, currentUserName, currentOtherId, text);
      chatInput.value = '';
      renderMessages();
      
      window.dispatchEvent(new CustomEvent('amx:message-sent', {
        detail: { to: currentOtherId, message: text }
      }));
    }
    
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') sendMessage();
    });
    
    toggle.addEventListener('click', function() {
      isOpen = !isOpen;
      panel.style.display = isOpen ? 'flex' : 'none';
      if (isOpen) {
        conversationsDiv.style.display = 'block';
        messagesArea.style.display = 'none';
        renderConversations();
      }
    });
    
    close.addEventListener('click', function() {
      isOpen = false;
      panel.style.display = 'none';
    });
    
    return { renderConversations: renderConversations };
  }
}

export const chat = new ChatSystem();
