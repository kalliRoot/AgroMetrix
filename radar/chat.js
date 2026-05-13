// ═══════════════════════════════════════════════════════════════
//  AgroMetrix Radar — chat.js v15 FINAL
//  Chat em tempo real via Firestore (WhatsApp style)
//  v15: Carregamento instantâneo + lista de conversas organizada
// ═══════════════════════════════════════════════════════════════

import { audio } from './audio.js';

class ChatManager {
  constructor() {
    this.db = null;
    this.currentUser = null;
    this.currentProfile = null;
    
    // Listeners únicos
    this.messageUnsub = null;
    this.conversationsUnsub = null;
    
    // Estado do chat atual
    this.currentChatId = null;
    this.currentTargetUid = null;
    
    // Cache de conversas
    this.conversations = new Map();
  }

  init(db, user, profile) {
    console.log('[CHAT INIT]', { uid: user?.uid, name: profile?.nickname || user?.displayName });
    this.db = db;
    this.currentUser = user;
    this.currentProfile = profile;
    
    // Inicia listener de conversas
    if (this.db && this.currentUser) {
      this.listenConversations();
    }
  }

  getChatId(uid1, uid2) {
    // Formato: uid_a_uid_b_YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];
    const ids = [uid1, uid2].sort();
    return `${ids[0]}_${ids[1]}_${today}`;
  }

  getName() {
    const p = this.currentProfile;
    const u = this.currentUser;
    const name = p?.nickname || p?.name || u?.displayName || 'Piloto';
    return name && String(name).startsWith('http') ? 'Piloto' : name;
  }

  // ═══════════════════════════════════════════════════════════════
  // LISTENER DE CONVERSAS (para lista no ícone do chat)
  // ═══════════════════════════════════════════════════════════════
  async listenConversations() {
    if (!this.db || !this.currentUser) {
      console.warn('[LISTEN CONVERSATIONS] DB ou user não inicializado');
      return;
    }

    console.log('[LISTEN CONVERSATIONS START]', this.currentUser.uid);

    if (this.conversationsUnsub) {
      this.conversationsUnsub();
      this.conversationsUnsub = null;
    }

    const { collection, query, where, onSnapshot } =
      await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    // Query SEM orderBy para evitar erro de índice
    // Ordena em memória depois
    const q = query(
      collection(this.db, 'notifications'),
      where('to', '==', this.currentUser.uid)
    );

    this.conversationsUnsub = onSnapshot(
      q,
      (snap) => {
        console.log('[CONVERSATIONS SNAPSHOT]', { size: snap.size });

        // Extrai conversas únicas
        const convMap = new Map();
        snap.docs.forEach((doc) => {
          const notif = doc.data();
          if (notif.from) {
            const key = notif.from;
            if (!convMap.has(key) || (notif.createdAtMs || 0) > (convMap.get(key).createdAtMs || 0)) {
              convMap.set(key, notif);
            }
          }
        });

        // Ordena por data (mais recente primeiro)
        const sorted = Array.from(convMap.values()).sort(
          (a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0)
        );

        this.conversations = convMap;
        console.log('[CONVERSATIONS SORTED]', { count: sorted.length });

        // Renderiza lista
        this.renderConversationsList(sorted);
      },
      (err) => {
        console.error('[CONVERSATIONS ERROR]', err);
      }
    );

    console.log('[LISTEN CONVERSATIONS REGISTERED]');
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDERIZA LISTA DE CONVERSAS (estilo WhatsApp)
  // ═══════════════════════════════════════════════════════════════
  renderConversationsList(conversations) {
    const container = document.getElementById('chatList');
    if (!container) {
      console.warn('[RENDER CONVERSATIONS] Container #chatList não encontrado');
      return;
    }

    if (conversations.length === 0) {
      container.innerHTML = '<div style="text-align:center;color:var(--mt);padding:20px;font-size:12px">💬 Nenhuma conversa ainda</div>';
      return;
    }

    const html = conversations
      .map((conv) => {
        const fromName = conv.fromName || 'Piloto';
        const preview = conv.message || conv.preview || '(sem mensagem)';
        const time = this.formatTime(conv.createdAtMs || 0);

        return `
          <div class="chat-list-item" onclick="window.openChatWith('${conv.from}','${this.escapeHtml(fromName)}')">
            <div class="chat-list-av">👨‍✈️</div>
            <div class="chat-list-info">
              <div class="chat-list-name">${this.escapeHtml(fromName)}</div>
              <div class="chat-list-last">${this.escapeHtml(preview.substring(0, 50))}</div>
            </div>
            <div class="chat-list-time">${time}</div>
          </div>
        `;
      })
      .join('');

    container.innerHTML = html;
    console.log('[RENDER CONVERSATIONS]', { count: conversations.length });
  }

  formatTime(ms) {
    if (!ms) return '';
    const date = new Date(ms);
    const now = new Date();
    const diff = now - date;

    // Se foi hoje, mostra hora
    if (diff < 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    // Se foi ontem
    if (diff < 48 * 60 * 60 * 1000) {
      return 'Ontem';
    }

    // Se foi esta semana
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      return date.toLocaleDateString('pt-BR', { weekday: 'short' });
    }

    // Se foi há mais tempo
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  // ═══════════════════════════════════════════════════════════════
  // ABRE CHAT COM OUTRO USUÁRIO
  // ═══════════════════════════════════════════════════════════════
  async openWith(targetUid, targetName) {
    if (!this.db || !this.currentUser) {
      console.error('[OPEN WITH] DB ou user não inicializado');
      return;
    }

    const chatId = this.getChatId(this.currentUser.uid, targetUid);
    
    if (this.currentChatId === chatId) {
      console.log('[OPEN WITH] Já está no chat', chatId);
      return;
    }

    console.log('[OPEN WITH]', { chatId, targetUid, targetName });

    this.currentChatId = chatId;
    this.currentTargetUid = targetUid;

    await this.listenMessages(chatId);
  }

  // ═══════════════════════════════════════════════════════════════
  // LISTENER DE MENSAGENS (SEM orderBy para evitar erro de índice)
  // ═══════════════════════════════════════════════════════════════
  async listenMessages(chatId) {
    console.log('[LISTEN MESSAGES START]', chatId);

    if (this.messageUnsub) {
      console.log('[UNSUB MESSAGES OLD]', this.currentChatId);
      this.messageUnsub();
      this.messageUnsub = null;
    }

    const { collection, query, onSnapshot } =
      await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    const container = document.getElementById('chatMsgs');
    if (!container) {
      console.error('[LISTEN MESSAGES] Container #chatMsgs não encontrado');
      return;
    }

    container.innerHTML = '<div style="text-align:center;color:var(--mt);padding:16px;font-size:11px">🔄 Carregando…</div>';

    // Query SEM orderBy para evitar erro de índice
    // Ordena em memória depois
    const q = query(collection(this.db, `chats/${chatId}/messages`));

    this.messageUnsub = onSnapshot(
      q,
      (snap) => {
        console.log('[SNAPSHOT MESSAGES]', {
          chatId,
          size: snap.size,
          fromCache: snap.metadata.fromCache,
        });

        if (this.currentChatId !== chatId) {
          console.log('[SNAPSHOT IGNORED] Chat mudou para', this.currentChatId);
          return;
        }

        if (snap.empty) {
          container.innerHTML = '<div class="chat-empty">💬 Novo chat do dia!<br><span style="font-size:10px;opacity:.7">Diga olá para iniciar a conversa!</span></div>';
          console.log('[MESSAGES EMPTY]');
          return;
        }

        // Ordena em memória por createdAtMs
        const messages = snap.docs
          .map(doc => doc.data())
          .sort((a, b) => (a.createdAtMs || 0) - (b.createdAtMs || 0));

        console.log('[MESSAGES LOADED]', {
          count: messages.length,
          first: messages[0]?.text?.substring(0, 30),
          last: messages[messages.length - 1]?.text?.substring(0, 30),
        });

        this.renderMessages(container, messages);

        // Toca som apenas se recebeu mensagem NOVA de outro usuário
        const changes = snap.docChanges();
        const newReceivedMessages = changes.filter(
          (c) =>
            c.type === 'added' &&
            c.doc.data().uid !== this.currentUser?.uid &&
            !snap.metadata.fromCache
        );

        if (newReceivedMessages.length > 0) {
          console.log('[PLAY SOUND] Mensagem recebida');
          audio.play('message');
        }
      },
      (err) => {
        console.error('[SNAPSHOT ERROR]', { chatId, error: err.message });
        if (this.currentChatId === chatId) {
          container.innerHTML = '<div class="chat-empty">⚠️ Erro ao carregar mensagens.<br><span style="font-size:10px;opacity:.7">' + err.message + '</span></div>';
        }
      }
    );

    console.log('[LISTEN MESSAGES REGISTERED]', chatId);
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDERIZA MENSAGENS NO CONTAINER
  // ═══════════════════════════════════════════════════════════════
  renderMessages(container, messages) {
    console.log('[RENDER MESSAGES]', { count: messages.length });

    const html = messages
      .map((m) => this.renderMessage(m))
      .join('');

    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
  }

  renderMessage(m) {
    const isMe = m.uid === this.currentUser?.uid;
    let time = '';

    if (m.createdAtMs) {
      const date = new Date(m.createdAtMs);
      if (!Number.isNaN(date.getTime())) {
        time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      }
    } else if (m.createdAt?.toDate) {
      try {
        const date = m.createdAt.toDate();
        time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      } catch (e) {
        console.warn('[RENDER TIME ERROR]', e);
      }
    }

    const text = this.escapeHtml(m.text || '');
    const name = this.escapeHtml(m.name || 'Piloto');

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

  // ═══════════════════════════════════════════════════════════════
  // ENVIA MENSAGEM
  // ═══════════════════════════════════════════════════════════════
  async send(text) {
    if (!text?.trim() || !this.currentChatId || !this.db) {
      console.warn('[SEND] Dados inválidos', { text: !!text?.trim(), chatId: !!this.currentChatId, db: !!this.db });
      return false;
    }

    const { collection, addDoc, serverTimestamp } =
      await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    try {
      const msgData = {
        uid: this.currentUser.uid,
        name: this.getName(),
        text: text.trim(),
        createdAt: serverTimestamp(),
        createdAtMs: Date.now(),
      };

      console.log('[SEND MESSAGE]', { text: msgData.text.substring(0, 30), chatId: this.currentChatId });

      await addDoc(
        collection(this.db, `chats/${this.currentChatId}/messages`),
        msgData
      );

      console.log('[SEND OK]', this.currentChatId);

      if (this.currentTargetUid) {
        await addDoc(collection(this.db, 'notifications'), {
          to: this.currentTargetUid,
          from: this.currentUser.uid,
          fromName: this.getName(),
          type: 'new_message',
          message: text.trim().substring(0, 60),
          createdAt: serverTimestamp(),
          createdAtMs: Date.now(),
          read: false,
        });
      }

      return true;
    } catch (err) {
      console.error('[SEND ERROR]', err);
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ACEITA PEDIDO (BILATERAL)
  // ═══════════════════════════════════════════════════════════════
  async acceptRequest(targetUid, targetName, requestMessage) {
    if (!this.db || !this.currentUser) {
      console.error('[ACCEPT] DB ou user não inicializado');
      return;
    }

    const chatId = this.getChatId(this.currentUser.uid, targetUid);
    console.log('[ACCEPT REQUEST]', { chatId, targetUid, targetName });

    const { collection, addDoc, serverTimestamp } =
      await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    try {
      await addDoc(collection(this.db, `chats/${chatId}/messages`), {
        uid: this.currentUser.uid,
        name: this.getName(),
        text: `✅ Olá! Sou ${this.getName()} e posso te ajudar com: "${requestMessage}". Onde você está?`,
        createdAt: serverTimestamp(),
        createdAtMs: Date.now(),
      });

      console.log('[ACCEPT MESSAGE SAVED]', chatId);

      await addDoc(collection(this.db, 'notifications'), {
        to: targetUid,
        from: this.currentUser.uid,
        fromName: this.getName(),
        accepterName: this.getName(),
        type: 'accept',
        message: requestMessage,
        createdAt: serverTimestamp(),
        createdAtMs: Date.now(),
        read: false,
      });

      console.log('[ACCEPT NOTIFICATION SENT]', { to: targetUid, chatId });
    } catch (err) {
      console.error('[ACCEPT ERROR]', err);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // UTILITÁRIOS
  // ═══════════════════════════════════════════════════════════════
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
  }
}

export const chat = new ChatManager();
