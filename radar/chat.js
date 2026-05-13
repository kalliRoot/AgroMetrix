// ═══════════════════════════════════════════════════════════════
//  AgroMetrix Radar — chat.js v12 REFATORADO
//  Chat em tempo real via Firestore (WhatsApp style)
//  v12: Fluxo limpo, listeners únicos, sem duplicidade, sem popups
// ═══════════════════════════════════════════════════════════════

import { audio } from './audio.js';

class ChatManager {
  constructor() {
    this.db = null;
    this.currentUser = null;
    this.currentProfile = null;
    
    // Listeners únicos (não Map complexo)
    this.messageUnsub = null;
    this.notifUnsub = null;
    
    // Estado do chat atual
    this.currentChatId = null;
    this.currentTargetUid = null;
  }

  init(db, user, profile) {
    console.log('[INIT]', { uid: user?.uid, name: profile?.nickname || user?.displayName });
    this.db = db;
    this.currentUser = user;
    this.currentProfile = profile;
    
    // Inicia listener de notificações AQUI, uma única vez
    if (this.db && this.currentUser) {
      this.listenNotifications();
    }
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

  // ═══════════════════════════════════════════════════════════════
  // ABRE CHAT COM OUTRO USUÁRIO
  // ═══════════════════════════════════════════════════════════════
  async openWith(targetUid, targetName) {
    if (!this.db || !this.currentUser) {
      console.error('[OPEN WITH] DB ou user não inicializado');
      return;
    }

    const chatId = this.getChatId(this.currentUser.uid, targetUid);
    
    // Se já é o chat atual, não reinicia
    if (this.currentChatId === chatId) {
      console.log('[OPEN WITH] Já está no chat', chatId);
      return;
    }

    console.log('[OPEN WITH]', { chatId, targetUid, targetName });

    this.currentChatId = chatId;
    this.currentTargetUid = targetUid;

    // Atualiza UI
    const nameEl = document.getElementById('chatName');
    if (nameEl) nameEl.textContent = targetName || 'Piloto';

    // Inicia listener de mensagens
    await this.listenMessages(chatId);
  }

  // ═══════════════════════════════════════════════════════════════
  // LISTENER DE MENSAGENS (ÚNICO)
  // ═══════════════════════════════════════════════════════════════
  async listenMessages(chatId) {
    console.log('[LISTEN START]', chatId);

    // Cancela listener anterior se existir
    if (this.messageUnsub) {
      console.log('[UNSUB OLD]', this.currentChatId);
      this.messageUnsub();
      this.messageUnsub = null;
    }

    const { collection, query, orderBy, onSnapshot } =
      await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    const container = document.getElementById('chatMsgs');
    if (!container) {
      console.error('[LISTEN] Container #chatMsgs não encontrado');
      return;
    }

    // Mostra "carregando" apenas inicialmente
    container.innerHTML = '<div style="text-align:center;color:var(--mt);padding:16px;font-size:11px">🔄 Carregando…</div>';

    // Query: ordena por createdAtMs (todas as mensagens novas têm)
    const q = query(
      collection(this.db, `chats/${chatId}/messages`),
      orderBy('createdAtMs', 'asc')
    );

    // Listener ÚNICO
    this.messageUnsub = onSnapshot(
      q,
      (snap) => {
        console.log('[SNAPSHOT RECEIVED]', {
          chatId,
          size: snap.size,
          fromCache: snap.metadata.fromCache,
          hasPendingWrites: snap.metadata.hasPendingWrites,
        });

        // Se chat mudou enquanto snapshot chegava, ignora
        if (this.currentChatId !== chatId) {
          console.log('[SNAPSHOT IGNORED] Chat mudou para', this.currentChatId);
          return;
        }

        // Se vazio, mostra mensagem
        if (snap.empty) {
          container.innerHTML = '<div class="chat-empty">💬 Nenhuma mensagem ainda.<br><span style="font-size:10px;opacity:.7">Diga olá para iniciar a conversa!</span></div>';
          console.log('[MESSAGES] Vazio');
          return;
        }

        // Renderiza mensagens
        const messages = snap.docs.map(doc => doc.data());
        console.log('[MESSAGES]', {
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

    console.log('[LISTEN REGISTERED]', chatId);
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDERIZA MENSAGENS NO CONTAINER
  // ═══════════════════════════════════════════════════════════════
  renderMessages(container, messages) {
    console.log('[RENDER]', { count: messages.length });

    const html = messages
      .map((m) => this.renderMessage(m))
      .join('');

    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
  }

  renderMessage(m) {
    const isMe = m.uid === this.currentUser?.uid;
    let time = '';

    // Fallback robusto para timestamp
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
        createdAtMs: Date.now(), // OBRIGATÓRIO para ordenação rápida
      };

      console.log('[SEND]', msgData);

      // Salva mensagem
      await addDoc(
        collection(this.db, `chats/${this.currentChatId}/messages`),
        msgData
      );

      console.log('[SEND OK]', this.currentChatId);

      // Notifica outro usuário
      if (this.currentTargetUid) {
        await addDoc(collection(this.db, 'notifications'), {
          to: this.currentTargetUid,
          from: this.currentUser.uid,
          fromName: this.getName(),
          type: 'message',
          preview: text.trim().substring(0, 60),
          chatId: this.currentChatId,
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
      // 1. Salva mensagem inicial
      await addDoc(collection(this.db, `chats/${chatId}/messages`), {
        uid: this.currentUser.uid,
        name: this.getName(),
        text: `✅ Olá! Sou ${this.getName()} e posso te ajudar com: "${requestMessage}". Onde você está?`,
        createdAt: serverTimestamp(),
        createdAtMs: Date.now(),
      });

      console.log('[ACCEPT MESSAGE SAVED]', chatId);

      // 2. Salva notificação de abertura bilateral
      await addDoc(collection(this.db, 'notifications'), {
        to: targetUid,
        from: this.currentUser.uid,
        fromName: this.getName(),
        type: 'open_chat', // ← TRIGGER BILATERAL
        preview: requestMessage,
        chatId,
        createdAtMs: Date.now(),
        read: false,
      });

      console.log('[ACCEPT NOTIFICATION SENT]', { to: targetUid, chatId });

      // 3. Abre chat para quem aceitou
      if (typeof window.openChatWith === 'function') {
        console.log('[ACCEPT OPENING CHAT]', { targetUid, targetName });
        await window.openChatWith(targetUid, targetName || 'Piloto');
      } else {
        console.warn('[ACCEPT] window.openChatWith não existe');
      }
    } catch (err) {
      console.error('[ACCEPT ERROR]', err);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // LISTENER DE NOTIFICAÇÕES (ÚNICO, INICIA NO INIT)
  // ═══════════════════════════════════════════════════════════════
  async listenNotifications() {
    if (!this.db || !this.currentUser) {
      console.warn('[LISTEN NOTIF] DB ou user não inicializado');
      return;
    }

    console.log('[LISTEN NOTIF START]');

    // Cancela listener anterior se existir
    if (this.notifUnsub) {
      console.log('[UNSUB NOTIF OLD]');
      this.notifUnsub();
      this.notifUnsub = null;
    }

    const { collection, query, where, orderBy, onSnapshot } =
      await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    const q = query(
      collection(this.db, 'notifications'),
      where('to', '==', this.currentUser.uid),
      orderBy('createdAtMs', 'desc')
    );

    this.notifUnsub = onSnapshot(
      q,
      (snap) => {
        console.log('[NOTIF SNAPSHOT]', { size: snap.size });

        snap.docChanges().forEach(async (change) => {
          if (change.type !== 'added') return;

          const notif = change.doc.data();
          console.log('[NOTIFICATION]', {
            type: notif.type,
            from: notif.from,
            chatId: notif.chatId,
          });

          // Trigger de abertura bilateral
          if (notif.type === 'open_chat' && notif.chatId) {
            console.log('[OPEN CHAT TRIGGER]', notif.chatId);

            // Evita loop: se já está neste chat, não reabre
            if (this.currentChatId === notif.chatId) {
              console.log('[ALREADY IN CHAT]', notif.chatId);
              return;
            }

            // Abre chat automaticamente
            if (typeof window.openChatWith === 'function') {
              console.log('[OPENING CHAT AUTO]', {
                from: notif.from,
                fromName: notif.fromName,
              });
              await window.openChatWith(notif.from, notif.fromName || 'Piloto');
            } else {
              console.warn('[OPEN CHAT] window.openChatWith não existe');
            }

            return;
          }

          // Notificação de mensagem (apenas log, renderização é via onSnapshot)
          if (notif.type === 'message') {
            console.log('[MESSAGE NOTIF]', {
              from: notif.from,
              preview: notif.preview?.substring(0, 30),
            });
            // Som já toca no onSnapshot das mensagens
            return;
          }
        });
      },
      (err) => {
        console.error('[NOTIF ERROR]', err);
      }
    );

    console.log('[LISTEN NOTIF REGISTERED]');
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
