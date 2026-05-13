// ═══════════════════════════════════════════════════════════════
//  AgroMetrix Radar — chat.js v8
//  Chat em tempo real via Firestore (comportamento WhatsApp/Messenger)
//  v8: onSnapshot sempre renderiza no container principal do chat.
//      Notificações não substituem a renderização da conversa.
// ═══════════════════════════════════════════════════════════════

import { audio } from './audio.js';

class ChatManager {
  constructor() {
    this.activeChats = new Map(); // chatId -> { uid, name, unsub }
    this.currentChatId = null;
    this.db = null;
    this.currentUser = null;
    this.currentProfile = null;
    this._lastRenderedHtml = '';
    this.onNewMessage = null;
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
    return name && String(name).startsWith('http') ? 'Piloto' : name;
  }

  async openWith(targetUid, targetName = 'Piloto') {
    if (!this.db || !this.currentUser || !targetUid) return;

    const chatId = this.getChatId(this.currentUser.uid, targetUid);
    this.currentChatId = chatId;
    this._lastRenderedHtml = '';

    const nameEl = document.getElementById('chatName');
    if (nameEl) nameEl.textContent = targetName || 'Piloto';

    await this.listenMessages(chatId, targetUid, targetName);
  }

  async listenMessages(chatId, targetUid, targetName = 'Piloto') {
    const previous = this.activeChats.get(chatId);
    if (previous?.unsub) previous.unsub();

    const { collection, query, orderBy, onSnapshot, limit } =
      await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    const container = document.getElementById('chatMsgs');
    if (container) {
      container.innerHTML = '<div class="chat-empty">🔄 Carregando histórico…</div>';
      container.scrollTop = container.scrollHeight;
    }

    const messagesQuery = query(
      collection(this.db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    let initialSnapshot = true;

    const unsub = onSnapshot(messagesQuery, (snap) => {
      if (this.currentChatId !== chatId) return;

      const messages = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // Fluxo correto:
      // addDoc(...) -> Firestore atualiza -> onSnapshot dispara -> renderMessages()
      this.renderMessages(messages, chatId);

      if (!initialSnapshot && !snap.metadata.hasPendingWrites) {
        const received = snap.docChanges().filter((change) => {
          const msg = change.doc.data();
          return change.type === 'added' && msg.uid && msg.uid !== this.currentUser?.uid;
        });

        if (received.length) {
          const last = received[received.length - 1].doc.data();
          audio.play('message');

          // Opcional: permite acender indicador discreto fora do chat,
          // mas nunca renderiza a mensagem fora de #chatMsgs.
          if (typeof this.onNewMessage === 'function') {
            this.onNewMessage(last.uid, last.name || targetName || 'Piloto', last.text || '');
          }
        }
      }

      initialSnapshot = false;
    }, (err) => {
      console.error('[Chat] Erro no listener realtime:', err);
      const c = document.getElementById('chatMsgs');
      if (c && this.currentChatId === chatId) {
        c.innerHTML = '<div class="chat-empty">⚠️ Não foi possível carregar as mensagens.</div>';
      }
    });

    this.activeChats.set(chatId, { uid: targetUid, name: targetName, unsub });
  }

  renderMessages(messages, chatId = this.currentChatId) {
    const container = document.getElementById('chatMsgs');
    if (!container || this.currentChatId !== chatId) return;

    if (!messages || messages.length === 0) {
      const emptyHtml = '<div class="chat-empty">💬 Nenhuma mensagem ainda.<br><span style="font-size:10px;opacity:.7">Diga olá para iniciar a conversa!</span></div>';
      if (this._lastRenderedHtml !== emptyHtml) {
        container.innerHTML = emptyHtml;
        this._lastRenderedHtml = emptyHtml;
      }
      container.scrollTop = container.scrollHeight;
      return;
    }

    const messagesHtml = messages.map((msg) => this._renderMsg(msg)).join('');

    if (this._lastRenderedHtml !== messagesHtml) {
      container.innerHTML = messagesHtml;
      this._lastRenderedHtml = messagesHtml;
    }

    container.scrollTop = container.scrollHeight;
  }

  _renderMsg(m) {
    const isMe = m.uid === this.currentUser?.uid;
    let time = '';

    if (m.createdAt) {
      const date = m.createdAt.toDate ? m.createdAt.toDate() : new Date(m.createdAt);
      if (!Number.isNaN(date.getTime())) {
        time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      }
    }

    const text = this._escHtml(m.text || '');
    const name = this._escHtml(m.name || 'Piloto');

    return `
      <div class="message ${isMe ? 'mine' : 'theirs'}">
        <div class="bubble">
          ${!isMe ? `<div class="chat-msg-name">${name}</div>` : ''}
          <div class="text">${text}</div>
          <div class="time">${time}</div>
        </div>
      </div>
    `;
  }

  async send(text) {
    if (!text?.trim() || !this.currentChatId || !this.db || !this.currentUser) return false;

    const { collection, addDoc, serverTimestamp } =
      await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    try {
      const cleanText = text.trim();
      const msgData = {
        uid: this.currentUser.uid,
        name: this.getName(),
        text: cleanText,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(this.db, 'chats', this.currentChatId, 'messages'), msgData);

      const target = this.activeChats.get(this.currentChatId);
      if (target?.uid) {
        await addDoc(collection(this.db, 'notifications'), {
          to: target.uid,
          from: this.currentUser.uid,
          fromName: this.getName(),
          senderName: this.getName(),
          type: 'message',
          preview: cleanText.substring(0, 60),
          message: cleanText,
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

  async loadActiveChats() {
    if (!this.db || !this.currentUser) return [];

    const { collection, query, where, limit, getDocs, orderBy } =
      await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    const uid = this.currentUser.uid;
    const byChat = new Map();

    const collectNotification = (notif) => {
      const otherId = notif.from === uid ? notif.to : notif.from;
      if (!otherId || otherId === uid) return;

      const chatId = notif.chatId || this.getChatId(uid, otherId);
      const createdAt = notif.createdAt?.toDate ? notif.createdAt.toDate().getTime() : Date.parse(notif.createdAt || 0) || 0;
      const previous = byChat.get(chatId);

      if (!previous || createdAt >= previous.updatedAtMs) {
        byChat.set(chatId, {
          chatId,
          otherId,
          lastMessage: notif.message || notif.preview || 'Toque para conversar',
          updatedAt: createdAt ? new Date(createdAt).toISOString() : null,
          updatedAtMs: createdAt,
        });
      }
    };

    try {
      const receivedSnap = await getDocs(query(collection(this.db, 'notifications'), where('to', '==', uid), limit(100)));
      receivedSnap.docs.forEach((doc) => collectNotification(doc.data()));
    } catch (err) {
      console.warn('[Chat] Não foi possível carregar notificações recebidas:', err);
    }

    try {
      const sentSnap = await getDocs(query(collection(this.db, 'notifications'), where('from', '==', uid), limit(100)));
      sentSnap.docs.forEach((doc) => collectNotification(doc.data()));
    } catch (err) {
      console.warn('[Chat] Não foi possível carregar notificações enviadas:', err);
    }

    for (const item of byChat.values()) {
      try {
        const lastSnap = await getDocs(query(
          collection(this.db, 'chats', item.chatId, 'messages'),
          orderBy('createdAt', 'desc'),
          limit(1)
        ));

        if (!lastSnap.empty) {
          const msg = lastSnap.docs[0].data();
          const msgDate = msg.createdAt?.toDate ? msg.createdAt.toDate() : null;
          item.lastMessage = msg.text || item.lastMessage;
          item.updatedAt = msgDate ? msgDate.toISOString() : item.updatedAt;
          item.updatedAtMs = msgDate ? msgDate.getTime() : item.updatedAtMs;
        }
      } catch (err) {
        console.warn('[Chat] Não foi possível carregar última mensagem:', err);
      }
    }

    return Array.from(byChat.values()).sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0));
  }

  async acceptRequest(targetUid, targetName, requestMessage) {
    if (!this.db || !this.currentUser || !targetUid) return;

    const chatId = this.getChatId(this.currentUser.uid, targetUid);
    this.currentChatId = chatId;

    const { collection, addDoc, serverTimestamp } =
      await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    await addDoc(collection(this.db, 'chats', chatId, 'messages'), {
      uid: this.currentUser.uid,
      name: this.getName(),
      text: `✅ Olá! Sou ${this.getName()} e posso te ajudar com: "${requestMessage}". Onde você está?`,
      createdAt: serverTimestamp(),
    });

    await addDoc(collection(this.db, 'notifications'), {
      to: targetUid,
      from: this.currentUser.uid,
      fromName: this.getName(),
      accepterName: this.getName(),
      type: 'accept',
      preview: requestMessage,
      chatId,
      createdAt: serverTimestamp(),
      read: false,
    });

    if (typeof window.openChatWith === 'function') {
      await window.openChatWith(targetUid, targetName || 'Piloto');
    }
  }

  _escHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
  }
}

export const chat = new ChatManager();
