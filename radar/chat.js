// ═══════════════════════════════════════════════════════════════
//  AgroMetrix Radar — chat.js v14 FINAL
//  Chat em tempo real via Firestore (WhatsApp style)
//  v14: Reset diário + abertura bilateral + carregamento rápido
// ═══════════════════════════════════════════════════════════════

import { audio } from './audio.js';

class ChatManager {
  constructor() {
    this.db = null;
    this.currentUser = null;
    this.currentProfile = null;
    
    // Listeners únicos
    this.messageUnsub = null;
    
    // Estado do chat atual
    this.currentChatId = null;
    this.currentTargetUid = null;
  }

  init(db, user, profile) {
    console.log('[CHAT INIT]', { uid: user?.uid, name: profile?.nickname || user?.displayName });
    this.db = db;
    this.currentUser = user;
    this.currentProfile = profile;
  }

  // ═══════════════════════════════════════════════════════════════
  // GERA CHAT ID COM DATA (RESET DIÁRIO)
  // ═══════════════════════════════════════════════════════════════
  getChatId(uid1, uid2) {
    // Formato: uid_a_uid_b_YYYY-MM-DD
    // A cada dia, um novo chatId é gerado
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
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

    // Inicia listener de mensagens
    await this.listenMessages(chatId);
  }

  // ═══════════════════════════════════════════════════════════════
  // LISTENER DE MENSAGENS (ÚNICO)
  // ═══════════════════════════════════════════════════════════════
  async listenMessages(chatId) {
    console.log('[LISTEN MESSAGES START]', chatId);

    // Cancela listener anterior se existir
    if (this.messageUnsub) {
      console.log('[UNSUB MESSAGES OLD]', this.currentChatId);
      this.messageUnsub();
      this.messageUnsub = null;
    }

    const { collection, query, orderBy, onSnapshot } =
      await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    const container = document.getElementById('chatMsgs');
    if (!container) {
      console.error('[LISTEN MESSAGES] Container #chatMsgs não encontrado');
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
        console.log('[SNAPSHOT MESSAGES]', {
          chatId,
          size: snap.size,
          fromCache: snap.metadata.fromCache,
        });

        // Se chat mudou enquanto snapshot chegava, ignora
        if (this.currentChatId !== chatId) {
          console.log('[SNAPSHOT IGNORED] Chat mudou para', this.currentChatId);
          return;
        }

        // Se vazio, mostra mensagem
        if (snap.empty) {
          container.innerHTML = '<div class="chat-empty">💬 Novo chat do dia!<br><span style="font-size:10px;opacity:.7">Diga olá para iniciar a conversa!</span></div>';
          console.log('[MESSAGES EMPTY]');
          return;
        }

        // Renderiza mensagens
        const messages = snap.docs.map(doc => doc.data());
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
    
    // Auto-scroll para o final (sem delay)
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

      console.log('[SEND MESSAGE]', { text: msgData.text.substring(0, 30), chatId: this.currentChatId });

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
      // 1. Salva mensagem inicial
      await addDoc(collection(this.db, `chats/${chatId}/messages`), {
        uid: this.currentUser.uid,
        name: this.getName(),
        text: `✅ Olá! Sou ${this.getName()} e posso te ajudar com: "${requestMessage}". Onde você está?`,
        createdAt: serverTimestamp(),
        createdAtMs: Date.now(),
      });

      console.log('[ACCEPT MESSAGE SAVED]', chatId);

      // 2. Salva notificação de aceite para abrir chat no outro lado
      await addDoc(collection(this.db, 'notifications'), {
        to: targetUid,
        from: this.currentUser.uid,
        fromName: this.getName(),
        accepterName: this.getName(),
        type: 'accept', // ← TRIGGER BILATERAL
        message: requestMessage,
        createdAt: serverTimestamp(),
        createdAtMs: Date.now(),
        read: false,
      });

      console.log('[ACCEPT NOTIFICATION SENT]', { to: targetUid, chatId });

      // 3. Abre chat para quem aceitou (já feito no radartest.html via window.openChatWith)
      console.log('[ACCEPT COMPLETE]', chatId);
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
