// ═══════════════════════════════════════════════════════════════
//  AgroMetrix Radar — chat.js v10
//  Chat em tempo real via Firestore (WhatsApp/Messenger style)
//  v10: Usa createdAtMs (Date.now()) para ordenação imediata
//       Fallback de timestamp, logs de depuração, renderização robusta
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
    this.onNewMessage = null; // Callback para indicador discreto (dot)
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

  /**
   * Abre conversa com um piloto e inicia o listener realtime.
   * Garante que onSnapshot seja o único responsável por renderizar mensagens.
   */
  async openWith(targetUid, targetName = 'Piloto') {
    if (!this.db || !this.currentUser || !targetUid) return;

    const chatId = this.getChatId(this.currentUser.uid, targetUid);
    
    // Se já é o chat atual, não reinicia
    if (this.currentChatId === chatId) return;

    this.currentChatId = chatId;
    this._lastRenderedHtml = '';

    console.log('[CHAT OPEN]', { chatId, targetUid, targetName });

    const nameEl = document.getElementById('chatName');
    if (nameEl) nameEl.textContent = targetName || 'Piloto';

    // Inicia escuta realtime
    await this.listenMessages(chatId, targetUid, targetName);
  }

  /**
   * Listener realtime: onSnapshot dispara sempre que há mudança.
   * Renderiza DIRETAMENTE no #chatMsgs, sem intermediários.
   * Usa createdAtMs para ordenação imediata (evita delay do serverTimestamp).
   */
  async listenMessages(chatId, targetUid, targetName = 'Piloto') {
    // Cancela listener anterior se houver
    const previous = this.activeChats.get(chatId);
    if (previous?.unsub) {
      console.log('[CHAT UNSUB]', chatId);
      previous.unsub();
    }

    const { collection, query, orderBy, onSnapshot, limit } =
      await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    const container = document.getElementById('chatMsgs');
    if (container) {
      container.innerHTML = '<div class="chat-empty">🔄 Carregando histórico…</div>';
    }

    // IMPORTANTE: Ordena por createdAtMs (timestamp local) para evitar delay do serverTimestamp
    const messagesQuery = query(
      collection(this.db, 'chats', chatId, 'messages'),
      orderBy('createdAtMs', 'asc'),
      limit(100)
    );

    let isFirstSnapshot = true;

    const unsub = onSnapshot(
      messagesQuery,
      (snap) => {
        // Debug: verifica se o listener está ativo
        console.log('[ACTIVE CHAT]', {
          currentChatId: this.currentChatId,
          incomingChatId: chatId,
          match: this.currentChatId === chatId,
        });

        // Verifica se ainda é o chat ativo
        if (this.currentChatId !== chatId) {
          console.log('[CHAT IGNORED] Listener disparou para chat inativo');
          return;
        }

        const messages = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Debug: log do snapshot
        console.log('[CHAT SNAP]', {
          chatId,
          docsCount: snap.docs.length,
          messages: messages.map((m) => ({
            uid: m.uid,
            text: m.text?.substring(0, 30),
            createdAtMs: m.createdAtMs,
            createdAt: m.createdAt,
          })),
        });

        // ═══════════════════════════════════════════════════════════
        // FLUXO CORRETO: onSnapshot → renderMessages() → container
        // ═══════════════════════════════════════════════════════════
        this.renderMessages(messages, chatId);

        // Detecta mensagens RECEBIDAS (não minhas) que acabaram de chegar
        if (!isFirstSnapshot && !snap.metadata.hasPendingWrites) {
          const receivedMessages = snap.docChanges().filter((change) => {
            const msg = change.doc.data();
            return (
              change.type === 'added' &&
              msg.uid &&
              msg.uid !== this.currentUser?.uid
            );
          });

          if (receivedMessages.length > 0) {
            console.log('[CHAT RECEIVED]', {
              count: receivedMessages.length,
              messages: receivedMessages.map((r) => ({
                uid: r.doc.data().uid,
                text: r.doc.data().text?.substring(0, 30),
              })),
            });

            const lastReceived = receivedMessages[receivedMessages.length - 1];
            const msgData = lastReceived.doc.data();

            // Toca som de mensagem recebida
            audio.play('message');

            // Callback para acender indicador discreto (dot) se necessário
            if (typeof this.onNewMessage === 'function') {
              this.onNewMessage(
                msgData.uid,
                msgData.name || targetName || 'Piloto',
                msgData.text || ''
              );
            }
          }
        }

        isFirstSnapshot = false;
      },
      (err) => {
        console.error('[CHAT ERROR]', { chatId, error: err.message });
        if (container && this.currentChatId === chatId) {
          container.innerHTML =
            '<div class="chat-empty">⚠️ Erro ao carregar mensagens.</div>';
        }
      }
    );

    this.activeChats.set(chatId, { uid: targetUid, name: targetName, unsub });
    console.log('[CHAT LISTEN STARTED]', chatId);
  }

  /**
   * Renderiza mensagens DIRETAMENTE no container #chatMsgs.
   * Nunca renderiza fora deste container.
   */
  renderMessages(messages, chatId = this.currentChatId) {
    const container = document.getElementById('chatMsgs');
    if (!container || this.currentChatId !== chatId) return;

    // Se vazio, mostra placeholder
    if (!messages || messages.length === 0) {
      const emptyHtml =
        '<div class="chat-empty">💬 Nenhuma mensagem ainda.<br><span style="font-size:10px;opacity:.7">Diga olá para iniciar a conversa!</span></div>';
      if (this._lastRenderedHtml !== emptyHtml) {
        container.innerHTML = emptyHtml;
        this._lastRenderedHtml = emptyHtml;
      }
      container.scrollTop = container.scrollHeight;
      return;
    }

    // Renderiza todas as mensagens
    const messagesHtml = messages.map((msg) => this._renderMsg(msg)).join('');

    // Atualiza apenas se houver mudança real
    if (this._lastRenderedHtml !== messagesHtml) {
      console.log('[CHAT RENDER]', {
        chatId,
        messagesCount: messages.length,
        htmlLength: messagesHtml.length,
      });
      container.innerHTML = messagesHtml;
      this._lastRenderedHtml = messagesHtml;
    }

    // AUTO-SCROLL: sempre vai para a última mensagem
    container.scrollTop = container.scrollHeight;
  }

  /**
   * Renderiza uma mensagem individual em HTML.
   * Suporta tanto createdAt (serverTimestamp) quanto createdAtMs (Date.now()).
   */
  _renderMsg(m) {
    const isMe = m.uid === this.currentUser?.uid;
    let time = '';

    // Fallback robusto de timestamp
    let date = null;
    if (m.createdAt?.toDate) {
      date = m.createdAt.toDate();
    } else if (m.createdAtMs) {
      date = new Date(m.createdAtMs);
    }

    if (date && !Number.isNaN(date.getTime())) {
      time = date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
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

  /**
   * Envia mensagem: addDoc → Firestore → onSnapshot → renderMessages()
   * Inclui AMBOS createdAt (serverTimestamp) e createdAtMs (Date.now())
   * para garantir ordenação imediata e timestamp correto.
   */
  async send(text) {
    if (!text?.trim() || !this.currentChatId || !this.db || !this.currentUser) {
      return false;
    }

    const { collection, addDoc, serverTimestamp } =
      await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    try {
      const cleanText = text.trim();
      const msgData = {
        uid: this.currentUser.uid,
        name: this.getName(),
        text: cleanText,
        createdAt: serverTimestamp(),
        createdAtMs: Date.now(), // Timestamp local para ordenação imediata
      };

      console.log('[CHAT SEND]', msgData);

      // 1. Grava mensagem no Firestore
      await addDoc(
        collection(this.db, 'chats', this.currentChatId, 'messages'),
        msgData
      );

      console.log('[CHAT SENT OK]', this.currentChatId);

      // 2. Notifica o outro lado (para acender dot/toast se estiver em outro chat)
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
          createdAtMs: Date.now(),
          read: false,
        });
      }

      return true;
    } catch (err) {
      console.error('[CHAT SEND ERROR]', err);
      return false;
    }
  }

  /**
   * Carrega lista de conversas ativas (para o drawer de chats).
   */
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
      const createdAtMs = notif.createdAtMs || (notif.createdAt?.toDate ? notif.createdAt.toDate().getTime() : Date.parse(notif.createdAt || 0) || 0);
      const previous = byChat.get(chatId);

      if (!previous || createdAtMs >= previous.updatedAtMs) {
        byChat.set(chatId, {
          chatId,
          otherId,
          lastMessage: notif.message || notif.preview || 'Toque para conversar',
          updatedAt: createdAtMs ? new Date(createdAtMs).toISOString() : null,
          updatedAtMs: createdAtMs,
        });
      }
    };

    try {
      const receivedSnap = await getDocs(
        query(collection(this.db, 'notifications'), where('to', '==', uid), limit(100))
      );
      receivedSnap.docs.forEach((doc) => collectNotification(doc.data()));
    } catch (err) {
      console.warn('[CHAT LOAD NOTIF RECV]', err);
    }

    try {
      const sentSnap = await getDocs(
        query(collection(this.db, 'notifications'), where('from', '==', uid), limit(100))
      );
      sentSnap.docs.forEach((doc) => collectNotification(doc.data()));
    } catch (err) {
      console.warn('[CHAT LOAD NOTIF SENT]', err);
    }

    // Busca última mensagem de cada conversa
    for (const item of byChat.values()) {
      try {
        const lastSnap = await getDocs(
          query(
            collection(this.db, 'chats', item.chatId, 'messages'),
            orderBy('createdAtMs', 'desc'),
            limit(1)
          )
        );

        if (!lastSnap.empty) {
          const msg = lastSnap.docs[0].data();
          const msgDate = msg.createdAtMs ? new Date(msg.createdAtMs) : (msg.createdAt?.toDate ? msg.createdAt.toDate() : null);
          item.lastMessage = msg.text || item.lastMessage;
          item.updatedAt = msgDate ? msgDate.toISOString() : item.updatedAt;
          item.updatedAtMs = msgDate ? msgDate.getTime() : item.updatedAtMs;
        }
      } catch (err) {
        console.warn('[CHAT LOAD LAST MSG]', err);
      }
    }

    return Array.from(byChat.values()).sort(
      (a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0)
    );
  }

  /**
   * Aceita um pedido de ajuda e envia mensagem inicial.
   */
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
      createdAtMs: Date.now(),
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
      createdAtMs: Date.now(),
      read: false,
    });

    if (typeof window.openChatWith === 'function') {
      await window.openChatWith(targetUid, targetName || 'Piloto');
    }
  }

  /**
   * Escapa HTML para evitar XSS.
   */
  _escHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
  }
}

export const chat = new ChatManager();
