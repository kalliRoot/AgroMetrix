// ═══════════════════════════════════════════════════════════════
//  AgroMetrix Radar — chat.js v11
//  Chat em tempo real via Firestore (WhatsApp/Discord style)
//  v11: Abertura bilateral + createdAtMs + logs + renderização otimizada
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

  // Abre chat com um piloto (Painel Principal shChat)
  async openWith(targetUid, targetName) {
    if (!this.db || !this.currentUser) return;
    const chatId = this.getChatId(this.currentUser.uid, targetUid);
    
    // Se já for o chat atual, não reinicia tudo
    if (this.currentChatId === chatId) return;
    
    this.currentChatId = chatId;
    console.log('[CHAT OPEN]', { chatId, targetUid, targetName });

    // Atualiza UI do painel principal
    const nameEl = document.getElementById('chatName');
    if (nameEl) nameEl.textContent = targetName || 'Piloto';

    // Inicia escuta em tempo real
    await this.listenMessages(chatId, targetUid);
  }

  // Escuta mensagens em tempo real
  async listenMessages(chatId, targetUid) {
    // Cancela qualquer escuta anterior para este chat
    const existing = this.activeChats.get(chatId);
    if (existing?.unsub) {
      console.log('[CHAT UNSUB]', chatId);
      existing.unsub();
    }

    const { collection, query, orderBy, onSnapshot, limit } =
      await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    const container = document.getElementById('chatMsgs');
    if (container) container.innerHTML = '<div style="text-align:center;color:var(--mt);padding:16px;font-size:11px">🔄 Carregando…</div>';

    // Ordena por createdAt (todas as mensagens têm este campo)
    // createdAtMs é apenas para novas mensagens (otimização)
    const q = query(
      collection(this.db, `chats/${chatId}/messages`),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    const unsub = onSnapshot(q, snap => {
      if (!container || this.currentChatId !== chatId) {
        console.log('[CHAT IGNORED] Listener disparou para chat inativo');
        return;
      }

      console.log('[CHAT SNAP]', {
        chatId,
        docsCount: snap.docs.length,
        fromCache: snap.metadata.fromCache,
      });

      // Se o snapshot vier do cache local enquanto o servidor ainda não confirmou,
      // e já tivermos renderizado algo, podemos esperar o snapshot do servidor
      // para evitar "pulos" ou repetições visuais.
      if (snap.metadata.fromCache && this._lastRenderedHtml !== '') {
        console.log('[CHAT CACHE] Aguardando snapshot do servidor');
        return;
      }

      if (snap.empty) {
        container.innerHTML = '<div class="chat-empty">💬 Nenhuma mensagem ainda.<br><span style="font-size:10px;opacity:.7">Diga olá para iniciar a conversa!</span></div>';
        this._lastRenderedHtml = '';
        return;
      }

      // Renderização COMPLETA apenas se houver mudança real no conteúdo
      const messagesHtml = snap.docs.map(doc => this._renderMsg(doc.data())).join('');
      
      if (this._lastRenderedHtml !== messagesHtml) {
        console.log('[CHAT RENDER]', {
          chatId,
          messagesCount: snap.docs.length,
          htmlLength: messagesHtml.length,
        });
        container.innerHTML = messagesHtml;
        this._lastRenderedHtml = messagesHtml;
        container.scrollTop = container.scrollHeight;

        // Tocar som apenas para mensagens RECEBIDAS que acabaram de chegar do servidor
        if (!snap.metadata.hasPendingWrites && !snap.metadata.fromCache) {
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
            });
            audio.play('message');
          }
        }
      }
    }, err => {
      console.error('[CHAT ERROR]', { chatId, error: err.message });
      if (container && this.currentChatId === chatId) {
        container.innerHTML = '<div class="chat-empty">⚠️ Erro ao carregar mensagens.</div>';
      }
    });

    this.activeChats.set(chatId, { uid: targetUid, unsub });
    console.log('[CHAT LISTEN STARTED]', chatId);
  }

  _renderMsg(m) {
    const isMe = m.uid === this.currentUser?.uid;
    let time = '';
    
    // Fallback robusto: tenta createdAtMs primeiro, depois createdAt
    let date = null;
    if (m.createdAtMs) {
      date = new Date(m.createdAtMs);
    } else if (m.createdAt?.toDate) {
      date = m.createdAt.toDate();
    } else if (m.createdAt) {
      date = new Date(m.createdAt);
    }
    
    if (date && !Number.isNaN(date.getTime())) {
      time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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
        createdAtMs: Date.now(), // Timestamp local para ordenação imediata
      };

      console.log('[CHAT SEND]', msgData);

      // 1. Salva a mensagem
      await addDoc(collection(this.db, `chats/${this.currentChatId}/messages`), msgData);
      
      console.log('[CHAT SENT OK]', this.currentChatId);

      // 2. Notifica o outro lado
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

  _escHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
  }

  async acceptRequest(targetUid, targetName, requestMessage) {
    if (!this.db || !this.currentUser) return;
    const chatId = this.getChatId(this.currentUser.uid, targetUid);
    this.currentChatId = chatId;

    console.log('[ACCEPT REQUEST]', { targetUid, targetName, chatId });

    const { collection, addDoc, serverTimestamp } =
      await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    // 1. Salva mensagem inicial no chat
    await addDoc(collection(this.db, `chats/${chatId}/messages`), {
      uid: this.currentUser.uid,
      name: this.getName(),
      text: `✅ Olá! Sou ${this.getName()} e posso te ajudar com: "${requestMessage}". Onde você está?`,
      createdAt: serverTimestamp(),
      createdAtMs: Date.now(),
    });

    // 2. Envia notificação de aceite para abrir chat no outro usuário
    await addDoc(collection(this.db, 'notifications'), {
      to: targetUid,
      from: this.currentUser.uid,
      fromName: this.getName(),
      type: 'accept',
      preview: requestMessage,
      chatId,
      createdAt: serverTimestamp(),
      createdAtMs: Date.now(),
      read: false,
    });

    console.log('[ACCEPT SENT]', { to: targetUid, chatId });

    // 3. Abre chat para quem aceitou
    if (typeof window.openChatWith === 'function') {
      await window.openChatWith(targetUid, targetName || 'Piloto');
    }
  }

  // Carrega lista de conversas ativas
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
            collection(this.db, `chats/${item.chatId}/messages`),
            orderBy('createdAt', 'desc'),
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
}

export const chat = new ChatManager();
