// ═══════════════════════════════════════════════════════════════
//  AgroMetrix Radar — chat.js v6
//  Chat em tempo real via Firestore (Estilo WhatsApp/Discord)
// ═══════════════════════════════════════════════════════════════

import { audio } from './audio.js';

class ChatManager {
  constructor() {
    this.activeChats = new Map(); // chatId -> { uid, name, unsub }
    this.currentChatId = null;
    this.db = null;
    this.currentUser = null;
    this.currentProfile = null;
  }

  init(db, user, profile) {
    this.db = db;
    this.currentUser = user;
    this.currentProfile = profile;
  }

  getChatId(uid1, uid2) {
    return [uid1, uid2].sort().join('_');
  }

  getName() {
    const p = this.currentProfile;
    const u = this.currentUser;
    const name = p?.nickname || p?.name || u?.displayName || 'Piloto';
    return name.startsWith('http') ? 'Piloto' : name;
  }

  // Abre chat com um piloto (Painel Principal shChat)
  async openWith(targetUid, targetName) {
    if (!this.db || !this.currentUser) return;
    const chatId = this.getChatId(this.currentUser.uid, targetUid);
    this.currentChatId = chatId;

    // Atualiza UI do painel principal
    const nameEl = document.getElementById('chatName');
    const section = document.getElementById('chatSection');
    if (nameEl) nameEl.textContent = targetName;
    if (section) section.style.display = 'block';

    // Inicia escuta em tempo real
    await this.listenMessages(chatId, targetUid);
  }

  // Escuta mensagens em tempo real
  async listenMessages(chatId, targetUid) {
    const existing = this.activeChats.get(chatId);
    if (existing?.unsub) existing.unsub();

    const { collection, query, orderBy, onSnapshot, limit } =
      await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    const container = document.getElementById('chatMsgs');
    if (container) container.innerHTML = '<div style="text-align:center;color:var(--mt);padding:16px;font-size:11px">Carregando…</div>';

    const q = query(
      collection(this.db, `chats/${chatId}/messages`),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    const unsub = onSnapshot(q, snap => {
      if (!container) return;

      if (snap.empty) {
        container.innerHTML = '<div class="chat-empty">💬 Nenhuma mensagem ainda.<br><span style="font-size:10px;opacity:.7">Diga olá para iniciar a conversa!</span></div>';
        return;
      }

      // Renderização COMPLETA a cada snapshot para garantir sincronia estilo WhatsApp
      // Isso evita que mensagens sumam ou fiquem fora de ordem
      const messagesHtml = snap.docs.map(doc => {
        const m = doc.data();
        return this._renderMsg(m);
      }).join('');

      container.innerHTML = messagesHtml;
      
      // Auto-scroll para a última mensagem
      container.scrollTop = container.scrollHeight;

      // Tocar som se a última mensagem for recebida
      const lastDoc = snap.docs[snap.docs.length - 1];
      if (lastDoc) {
        const lastMsg = lastDoc.data();
        if (lastMsg.uid !== this.currentUser.uid && !snap.metadata.hasPendingWrites) {
          audio.play('message');
          
          // GATILHO DE SEGURANÇA: Se o chat não estiver aberto, abre na marra
          const shChat = document.getElementById('shChat');
          if (shChat && !shChat.classList.contains('on')) {
            if (typeof window.openChatWith === 'function') {
              window.openChatWith(lastMsg.uid, lastMsg.name || 'Piloto');
            }
          }
        }
      }
    }, err => {
      console.error('[Chat] Erro:', err);
      if (container) container.innerHTML = `<div style="text-align:center;color:var(--red);padding:16px;font-size:11px">Erro ao carregar mensagens.</div>`;
    });

    this.activeChats.set(chatId, { uid: targetUid, unsub });
  }

  _renderMsg(m) {
    const isMe = m.uid === this.currentUser?.uid;
    // Tratamento robusto de timestamp
    let time = '';
    if (m.createdAt) {
      const date = m.createdAt.toDate ? m.createdAt.toDate() : new Date(m.createdAt);
      time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    
    const text = this._escHtml(m.text || '');
    
    // Estrutura estilo WhatsApp/Discord com classes mine/theirs
    return `
      <div class="message ${isMe ? 'mine' : 'theirs'}">
        <div class="bubble">
          ${!isMe ? `<div class="chat-msg-name">${m.name || 'Piloto'}</div>` : ''}
          <div class="text">${text}</div>
          <div class="time">${time}</div>
        </div>
      </div>
    `;
  }

  // Envia mensagem
  async send(text) {
    if (!text?.trim() || !this.currentChatId || !this.db) return false;
    const { collection, addDoc, serverTimestamp } =
      await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    try {
      const msgData = {
        uid: this.currentUser.uid,
        name: this.getName(),
        text: text.trim(),
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(this.db, `chats/${this.currentChatId}/messages`), msgData);
      
      // Notificação para o outro lado
      const targetUid = this.activeChats.get(this.currentChatId)?.uid;
      if (targetUid) {
        await addDoc(collection(this.db, 'notifications'), {
          to: targetUid,
          from: this.currentUser.uid,
          fromName: this.getName(),
          type: 'message',
          preview: text.trim().substring(0, 60),
          chatId: this.currentChatId,
          createdAt: serverTimestamp(),
          read: false,
        });
      }
      return true;
    } catch (err) {
      console.error('[Chat] Erro ao enviar:', err);
      return false;
    }
  }

  _escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async acceptRequest(targetUid, targetName, requestMessage) {
    if (!this.db || !this.currentUser) return;
    const chatId = this.getChatId(this.currentUser.uid, targetUid);
    this.currentChatId = chatId;

    const { collection, addDoc, serverTimestamp } =
      await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    // 1. Mensagem automática
    await addDoc(collection(this.db, `chats/${chatId}/messages`), {
      uid: this.currentUser.uid,
      name: this.getName(),
      text: `✅ Olá! Sou ${this.getName()} e posso te ajudar com: "${requestMessage}". Onde você está?`,
      createdAt: serverTimestamp(),
    });

    // 2. Notifica o solicitante
    await addDoc(collection(this.db, 'notifications'), {
      to: targetUid,
      from: this.currentUser.uid,
      fromName: this.getName(),
      type: 'accept',
      preview: requestMessage,
      chatId,
      createdAt: serverTimestamp(),
      read: false,
    });

    // 3. Abre o chat para quem aceitou
    if (typeof window.openChatWith === 'function') {
      await window.openChatWith(targetUid, targetName);
    }
  }
}

export const chat = new ChatManager();
