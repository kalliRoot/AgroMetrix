// ═══════════════════════════════════════════════════════════════
//  AgroMetrix Radar — Sistema de Chat com Persistência
// ═══════════════════════════════════════════════════════════════

class ChatSystem {
  constructor() {
    this.messages = [];
    this.conversations = new Map();
    this.listeners = [];
    this.storageType = 'localStorage'; // 'localStorage' ou 'firestore'
    this.db = null; // Firebase Firestore instance
  }

  // Inicializar com Firebase (opcional)
  initFirebase(firebaseDb) {
    this.db = firebaseDb;
    this.storageType = 'firestore';
    console.log('🔥 Firestore inicializado para chats');
  }

  // ============================================================
  // 1️⃣ SALVAR MENSAGENS (Persistência)
  // ============================================================
  
  async saveMessageToStorage(msgData) {
    const chatKey = `chat_${[msgData.senderId, msgData.receiverId].sort().join('_')}`;
    
    try {
      if (this.storageType === 'firestore' && this.db) {
        // Salvar no Firestore
        const chatId = [msgData.senderId, msgData.receiverId].sort().join('_');
        const messagesRef = collection(this.db, 'chats', chatId, 'messages');
        await addDoc(messagesRef, {
          from: msgData.senderId,
          fromName: msgData.senderName,
          to: msgData.receiverId,
          text: msgData.message,
          timestamp: msgData.timestamp,
          read: msgData.read,
          type: msgData.type
        });
      } else {
        // Salvar no localStorage
        let chats = JSON.parse(localStorage.getItem(chatKey) || '[]');
        chats.push(msgData);
        // Manter últimas 50 mensagens
        if (chats.length > 50) chats = chats.slice(-50);
        localStorage.setItem(chatKey, JSON.stringify(chats));
      }
      return true;
    } catch (e) {
      console.error('Erro ao salvar mensagem:', e);
      return false;
    }
  }

  // ============================================================
  // 2️⃣ CARREGAR HISTÓRICO (Recuperar mensagens)
  // ============================================================
  
  async loadConversationHistory(userId, otherId) {
    const chatKey = `chat_${[userId, otherId].sort().join('_')}`;
    
    try {
      if (this.storageType === 'firestore' && this.db) {
        const chatId = [userId, otherId].sort().join('_');
        const messagesRef = collection(this.db, 'chats', chatId, 'messages');
        const q = query(messagesRef, orderBy('timestamp'));
        const querySnapshot = await getDocs(q);
        
        const loadedMessages = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          loadedMessages.push({
            id: doc.id,
            senderId: data.from,
            senderName: data.fromName,
            receiverId: data.to,
            message: data.text,
            type: data.type || 'chat',
            timestamp: data.timestamp,
            read: data.read
          });
        });
        
        // Atualizar conversa na memória
        const convId = [userId, otherId].sort().join('_');
        if (!this.conversations.has(convId)) {
          this.conversations.set(convId, []);
        }
        this.conversations.set(convId, loadedMessages);
        this.messages.push(...loadedMessages);
        
        return loadedMessages;
      } else {
        // Carregar do localStorage
        const chats = JSON.parse(localStorage.getItem(chatKey) || '[]');
        
        // Converter para o formato interno
        const loadedMessages = chats.map(chat => ({
          id: chat.id || Date.now(),
          senderId: chat.from,
          senderName: chat.fromName,
          receiverId: chat.to,
          message: chat.text,
          type: chat.type || 'chat',
          timestamp: chat.timestamp,
          read: chat.read || false
        }));
        
        // Atualizar conversa na memória
        const convId = [userId, otherId].sort().join('_');
        if (!this.conversations.has(convId)) {
          this.conversations.set(convId, []);
        }
        this.conversations.set(convId, loadedMessages);
        this.messages.push(...loadedMessages);
        
        return loadedMessages;
      }
    } catch (e) {
      console.error('Erro ao carregar histórico:', e);
      return [];
    }
  }

  // ============================================================
  // 3️⃣ MÉTODOS PRINCIPAIS (Adaptados para persistência)
  // ============================================================
  
  async addMessage(senderId, senderName, receiverId, message, type = 'chat') {
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
    
    // Salvar no storage
    await this.saveMessageToStorage(msg);
    
    // Adicionar à memória
    const convId = [senderId, receiverId].sort().join('_');
    if (!this.conversations.has(convId)) {
      this.conversations.set(convId, []);
      // Carregar histórico existente
      await this.loadConversationHistory(senderId, receiverId);
    }
    this.conversations.get(convId).push(msg);
    this.messages.push(msg);
    
    // Notificar
    this.notifyListeners('newMessage', msg);
    this.playMessageSound();
    this.showNotification(senderName, message);
    
    return msg;
  }

  async notifyAccept(requesterId, acceptorId, acceptorName, requestMsg) {
    const msg = await this.addMessage(
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
        const otherId = convId.split('_').find(id => id !== userId);
        const lastMsg = msgs[msgs.length - 1];
        const otherName = (msgs.find(m => m.senderId === otherId) || {}).senderName || 'Piloto';
        
        convs.push({
          id: convId,
          otherId: otherId,
          otherName: otherName,
          lastMessage: lastMsg,
          unread: msgs.filter(m => m.receiverId === userId && !m.read).length
        });
      }
    }
    return convs.sort((a, b) => new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp));
  }

  async markAsRead(convId, userId) {
    const msgs = this.conversations.get(convId);
    if (msgs) {
      let updated = false;
      for (let i = 0; i < msgs.length; i++) {
        if (msgs[i].receiverId === userId && !msgs[i].read) {
          msgs[i].read = true;
          updated = true;
        }
      }
      
      if (updated && this.storageType === 'localStorage') {
        // Atualizar no localStorage
        const otherId = convId.split('_').find(id => id !== userId);
        const chatKey = `chat_${convId}`;
        const chats = JSON.parse(localStorage.getItem(chatKey) || '[]');
        const updatedChats = chats.map(chat => {
          if (chat.from === otherId && chat.to === userId && !chat.read) {
            chat.read = true;
          }
          return chat;
        });
        localStorage.setItem(chatKey, JSON.stringify(updatedChats));
      }
      
      this.notifyListeners('readUpdate', { convId: convId, userId: userId });
    }
  }

  async sendChat(senderId, senderName, receiverId, message) {
    return await this.addMessage(senderId, senderName, receiverId, message, 'chat');
  }

  // ============================================================
  // 4️⃣ NOTIFICAÇÕES E SONS
  // ============================================================
  
  playMessageSound() {
    try {
      const audio = new Audio('data:audio/wav;base64,U3RlYWx0aCBzb3VuZA==');
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch(e) {}
    
    // Vibrar em dispositivos móveis
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
  }

  showNotification(fromName, message) {
    // Mostrar toast
    this.showToast(`💬 ${fromName}: ${message.substring(0, 50)}`, 'info', 5000);
    
    // Notificação do navegador
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('AgroMetrix Chat', {
        body: `${fromName}: ${message.substring(0, 100)}`,
        icon: '💬'
      });
    }
  }

  showToast(message, type = 'info', duration = 3000) {
    // Criar toast se não existir
    let toast = document.getElementById('amx-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'amx-toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 20px;
        background: #1f5534;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.3s;
        pointer-events: none;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      `;
      document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.style.opacity = '1';
    
    setTimeout(() => {
      toast.style.opacity = '0';
    }, duration);
  }

  // ============================================================
  // 5️⃣ LIMPAR HISTÓRICO
  // ============================================================
  
  async clearChatHistory(userId, otherId) {
    const convId = [userId, otherId].sort().join('_');
    const chatKey = `chat_${convId}`;
    
    if (confirm('⚠️ Deseja limpar todo o histórico deste chat?')) {
      try {
        if (this.storageType === 'localStorage') {
          localStorage.removeItem(chatKey);
        }
        
        // Limpar da memória
        this.conversations.delete(convId);
        this.messages = this.messages.filter(m => {
          const msgConvId = [m.senderId, m.receiverId].sort().join('_');
          return msgConvId !== convId;
        });
        
        this.showToast('🗑️ Histórico removido');
        this.notifyListeners('historyCleared', { convId: convId });
        
        return true;
      } catch (e) {
        console.error('Erro ao limpar histórico:', e);
        this.showToast('❌ Erro ao limpar histórico');
        return false;
      }
    }
    return false;
  }

  // ============================================================
  // 6️⃣ EVENTOS E LISTENERS
  // ============================================================
  
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

  // ============================================================
  // 7️⃣ RENDERIZAR UI COM PERSISTÊNCIA
  // ============================================================
  
  async renderChatUI(containerId, currentUserId, currentUserName) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    let currentConvId = null;
    let currentOtherId = null;
    let currentOtherName = '';
    let isOpen = false;
    
    // Carregar todas as conversas do usuário
    await this.loadAllUserConversations(currentUserId);
    
    container.innerHTML = `
      <div id="amx-chat-widget" style="position:fixed;bottom:20px;right:20px;z-index:1000;font-family:Syne,sans-serif">
        <button id="amx-chat-toggle" style="width:56px;height:56px;border-radius:28px;background:#1f5534;border:none;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;position:relative">
          <span style="font-size:24px">💬</span>
          <span id="amx-chat-badge" style="position:absolute;top:-5px;right:-5px;background:#e03535;color:white;border-radius:10px;padding:2px 6px;font-size:10px;display:none">0</span>
        </button>
        <div id="amx-chat-panel" style="display:none;position:absolute;bottom:70px;right:0;width:350px;height:500px;background:#0d1a0f;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.4);overflow:hidden;flex-direction:column">
          <div style="padding:12px;background:#1f5534;color:white;display:flex;justify-content:space-between;align-items:center">
            <span style="font-weight:700">💬 Conversas</span>
            <div>
              <button id="amx-chat-clear-all" style="background:none;border:none;color:white;font-size:12px;cursor:pointer;margin-right:8px" title="Limpar conversa atual">🗑️</button>
              <button id="amx-chat-close" style="background:none;border:none;color:white;font-size:20px;cursor:pointer">✕</button>
            </div>
          </div>
          <div id="amx-chat-conversations" style="flex:1;overflow-y:auto;padding:8px"></div>
          <div id="amx-chat-messages-area" style="display:none;flex-direction:column;height:100%">
            <div style="padding:8px;background:#1a2a1f;border-bottom:1px solid #2a3a2a">
              <button id="amx-chat-back" style="background:none;border:none;color:#5ec880;cursor:pointer">← Voltar</button>
              <span id="amx-chat-with" style="margin-left:8px;color:white"></span>
            </div>
            <div id="amx-chat-messages" style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px"></div>
            <div style="padding:12px;border-top:1px solid #2a3a2a;display:flex;gap:8px">
              <input id="amx-chat-input" type="text" placeholder="Digite sua mensagem..." style="flex:1;padding:8px;border-radius:8px;border:none;background:#1a2a1f;color:white">
              <button id="amx-chat-send" style="padding:8px 16px;background:#3da866;border:none;border-radius:8px;color:white;cursor:pointer">Enviar</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    const toggle = document.getElementById('amx-chat-toggle');
    const panel = document.getElementById('amx-chat-panel');
    const close = document.getElementById('amx-chat-close');
    const clearAll = document.getElementById('amx-chat-clear-all');
    const conversationsDiv = document.getElementById('amx-chat-conversations');
    const messagesArea = document.getElementById('amx-chat-messages-area');
    const backBtn = document.getElementById('amx-chat-back');
    const messagesDiv = document.getElementById('amx-chat-messages');
    const chatInput = document.getElementById('amx-chat-input');
    const sendBtn = document.getElementById('amx-chat-send');
    const chatWith = document.getElementById('amx-chat-with');
    const badge = document.getElementById('amx-chat-badge');
    
    const self = this;
    
    const renderConversations = () => {
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
          html += `
            <div class="amx-conversation-item" data-convid="${conv.id}" data-otherid="${conv.otherId}" data-othername="${conv.otherName.replace(/"/g, '&quot;')}" style="padding:12px;border-bottom:1px solid #2a3a2a;cursor:pointer;background:${conv.unread > 0 ? '#1f5534' : 'transparent'}">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div style="flex:1">
                  <div style="font-weight:700;color:white">${conv.otherName}</div>
                  <div style="font-size:11px;color:#5a8a65;margin-top:4px">${(conv.lastMessage.message.substring(0, 40))}${conv.lastMessage.message.length > 40 ? '...' : ''}</div>
                </div>
                <div style="text-align:right">
                  <div style="font-size:10px;color:#5a8a65">${new Date(conv.lastMessage.timestamp).toLocaleTimeString()}</div>
                  ${conv.unread > 0 ? '<div style="margin-top:4px;background:#e03535;border-radius:10px;padding:2px 6px;font-size:10px;color:white">' + conv.unread + '</div>' : ''}
                </div>
              </div>
            </div>
          `;
        }
        conversationsDiv.innerHTML = html;
        
        var items = document.querySelectorAll('.amx-conversation-item');
        for (var i = 0; i < items.length; i++) {
          var el = items[i];
          el.addEventListener('click', (function(elem) {
            return async function() {
              currentConvId = elem.dataset.convid;
              currentOtherId = elem.dataset.otherid;
              currentOtherName = elem.dataset.othername;
              await self.markAsRead(currentConvId, currentUserId);
              await renderMessages();
              conversationsDiv.style.display = 'none';
              messagesArea.style.display = 'flex';
              chatWith.textContent = currentOtherName;
              renderConversations();
            };
          })(el));
        }
      }
    };
    
    const renderMessages = async () => {
      // Garantir que temos as mensagens carregadas
      if (!self.conversations.has(currentConvId)) {
        await self.loadConversationHistory(currentUserId, currentOtherId);
      }
      
      var msgs = self.conversations.get(currentConvId) || [];
      var html = '';
      for (var i = 0; i < msgs.length; i++) {
        var msg = msgs[i];
        html += `
          <div style="display:flex;justify-content:${msg.senderId === currentUserId ? 'flex-end' : 'flex-start'}">
            <div style="max-width:70%;padding:8px 12px;border-radius:12px;background:${msg.senderId === currentUserId ? '#3da866' : '#1a2a1f'};color:white">
              ${msg.senderId !== currentUserId ? '<div style="font-size:10px;color:#5a8a65;margin-bottom:4px">' + msg.senderName + '</div>' : ''}
              <div style="font-size:13px;word-wrap:break-word">${this.escapeHtml(msg.message)}</div>
              <div style="font-size:9px;color:#5a8a65;margin-top:4px;text-align:right">
                ${new Date(msg.timestamp).toLocaleTimeString()}
                ${msg.senderId === currentUserId && msg.read ? ' ✓✓' : ''}
              </div>
            </div>
          </div>
        `;
      }
      messagesDiv.innerHTML = html;
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    };
    
    backBtn.addEventListener('click', () => {
      currentConvId = null;
      conversationsDiv.style.display = 'block';
      messagesArea.style.display = 'none';
      renderConversations();
    });
    
    clearAll.addEventListener('click', async () => {
      if (currentConvId && currentOtherId) {
        await self.clearChatHistory(currentUserId, currentOtherId);
        if (currentConvId) {
          conversationsDiv.style.display = 'block';
          messagesArea.style.display = 'none';
          renderConversations();
        }
      }
    });
    
    const sendMessage = async () => {
      var text = chatInput.value.trim();
      if (!text || !currentOtherId) return;
      
      await self.sendChat(currentUserId, currentUserName, currentOtherId, text);
      chatInput.value = '';
      await renderMessages();
      
      window.dispatchEvent(new CustomEvent('amx:message-sent', {
        detail: { to: currentOtherId, message: text }
      }));
    };
    
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
    
    toggle.addEventListener('click', () => {
      isOpen = !isOpen;
      panel.style.display = isOpen ? 'flex' : 'none';
      if (isOpen) {
        conversationsDiv.style.display = 'block';
        messagesArea.style.display = 'none';
        renderConversations();
      }
    });
    
    close.addEventListener('click', () => {
      isOpen = false;
      panel.style.display = 'none';
    });
    
    // Listener para novas mensagens
    this.on('newMessage', (msg) => {
      if (isOpen && currentConvId === [msg.senderId, msg.receiverId].sort().join('_')) {
        renderMessages();
      } else if (msg.receiverId === currentUserId) {
        renderConversations();
        this.showToast(`💬 ${msg.senderName}: ${msg.message.substring(0, 50)}`, 'info', 5000);
      }
    });
    
    return { renderConversations: renderConversations };
  }

  // ============================================================
  // 8️⃣ UTILITÁRIOS
  // ============================================================
  
  async loadAllUserConversations(userId) {
    // Carregar todas as conversas salvas do usuário
    const keys = Object.keys(localStorage);
    const chatKeys = keys.filter(k => k.startsWith('chat_') && k.includes(userId));
    
    for (const key of chatKeys) {
      const otherId = key.replace('chat_', '').split('_').find(id => id !== userId);
      if (otherId) {
        await this.loadConversationHistory(userId, otherId);
      }
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Solicitar permissão para notificações
  requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }
}

// Exportar instância única
export const chat = new ChatSystem();

// Inicializar quando o DOM estiver pronto
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    // Solicitar permissão de notificação automaticamente
    setTimeout(() => {
      chat.requestNotificationPermission();
    }, 2000);
  });
}
