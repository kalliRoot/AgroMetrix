// ════════════════════════════════════════════════════════════════════════════
//  AgroMetrix Radar — chat.js v17 BILATERAL
//  Correções aplicadas:
//
//  PROBLEMA 1 — listenConversations() escutava só where('to', '==', uid)
//    → Fix: também escuta where('from', '==', uid) via listener duplo (dois onSnapshot)
//      e faz merge no Map local. Assim quem ENVIOU também vê a conversa.
//
//  PROBLEMA 2 — send() criava notif espelho, mas com fromName do alvo (string fixa).
//    → Fix: fromName do espelho agora vem de this.currentTargetName (nome real do alvo).
//      preview do espelho mostra "Você: <texto>" para ficar igual WhatsApp.
//
//  PROBLEMA 3 — acceptRequest() abria chat mas listenConversations() não captava
//    o lado de quem aceitou porque a notificação espelho tinha type:'accept' e
//    o renderConversationsList não filtrava por type, mas agora garantimos que
//    o campo 'from' na notificação espelho seja sempre o UID do interlocutor.
//
//  ARQUITETURA (não muda):
//    chats/{chatId}/messages  → mensagens (bilaterais, mesmo doc)
//    notifications            → lista de conversas (espelho bilateral)
//    chatId = [uid1,uid2].sort().join('_') + '_' + data  (diário)
// ════════════════════════════════════════════════════════════════════════════

import { audio } from './audio.js';

class ChatManager {
  constructor() {
    this.db = null;
    this.currentUser = null;
    this.currentProfile = null;

    this.messageUnsub = null;

    // BILATERAL: dois listeners de conversas — um como destinatário, outro como remetente
    this.conversationsUnsubTo   = null; // where('to',   '==', uid)
    this.conversationsUnsubFrom = null; // where('from', '==', uid) — NOVO

    this.currentChatId      = null;
    this.currentTargetUid   = null;
    this.currentTargetName  = null;

    // Map de conversas: chave = UID do interlocutor, valor = notif mais recente
    this.conversations = new Map();
  }

  // ─────────────────────────────────────────────
  init(db, user, profile) {
    console.log('[CHAT v17 INIT]', { uid: user?.uid });
    this.db             = db;
    this.currentUser    = user;
    this.currentProfile = profile;

    if (this.db && this.currentUser) {
      this.listenConversations();
    }
  }

  // chatId diário: ordena os dois UIDs → consistente para ambos os lados
  getChatId(uid1, uid2) {
    const today = new Date().toISOString().split('T')[0];
    const ids   = [uid1, uid2].sort();
    return `${ids[0]}_${ids[1]}_${today}`;
  }

  getName() {
    const p    = this.currentProfile;
    const u    = this.currentUser;
    const name = p?.nickname || p?.name || u?.displayName || 'Piloto';
    return name && String(name).startsWith('http') ? 'Piloto' : name;
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  LISTENER DE CONVERSAS — BILATERAL
  //  Escuta DOIS queries em paralelo e faz merge no Map local:
  //    1) where('to',   '==', uid)  → conversas onde sou destinatário
  //    2) where('from', '==', uid)  → conversas onde sou remetente  ← FIX
  //
  //  Para cada notificação, a chave do Map é sempre o UID do INTERLOCUTOR:
  //    - se eu sou 'to'   → interlocutor = notif.from
  //    - se eu sou 'from' → interlocutor = notif.to   ← FIX
  //
  //  Isso garante que quem enviou e quem recebeu enxergam a mesma entrada.
  // ════════════════════════════════════════════════════════════════════════════
  async listenConversations() {
    if (!this.db || !this.currentUser) return;

    // Cancela listeners anteriores
    this.conversationsUnsubTo?.();
    this.conversationsUnsubFrom?.();
    this.conversationsUnsubTo   = null;
    this.conversationsUnsubFrom = null;

    const { collection, query, where, onSnapshot } =
      await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    const myUid = this.currentUser.uid;

    // ── Helper: aplica snapshot ao Map e re-renderiza ──────────────────────
    const applySnapshot = (snap, role) => {
      // role: 'to' (sou destinatário) | 'from' (sou remetente)
      snap.docs.forEach((doc) => {
        const notif = doc.data();

        // Interlocutor = quem está do outro lado
        const interlocutorUid  = role === 'to' ? notif.from : notif.to;
        const interlocutorName = role === 'to' ? (notif.fromName || 'Piloto')
                                               : (notif.toName   || this.currentTargetName || 'Piloto');

        if (!interlocutorUid) return;

        // Guarda a notificação mais recente por interlocutor
        const existing = this.conversations.get(interlocutorUid);
        if (!existing || (notif.createdAtMs || 0) > (existing.createdAtMs || 0)) {
          this.conversations.set(interlocutorUid, {
            ...notif,
            _interlocutorUid:  interlocutorUid,
            _interlocutorName: interlocutorName,
          });
        }
      });

      // Ordena por data mais recente e renderiza
      const sorted = Array.from(this.conversations.values())
        .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));

      this.renderConversationsList(sorted);
    };

    // ── Query 1: sou DESTINATÁRIO ──────────────────────────────────────────
    const qTo = query(
      collection(this.db, 'notifications'),
      where('to', '==', myUid)
    );
    this.conversationsUnsubTo = onSnapshot(qTo,
      (snap) => applySnapshot(snap, 'to'),
      (err)  => console.error('[CONV LISTENER TO]', err)
    );

    // ── Query 2: sou REMETENTE ─────────────────────────────────────────────
    //  Novo! Garante que quem ENVIOU também veja a conversa imediatamente.
    const qFrom = query(
      collection(this.db, 'notifications'),
      where('from', '==', myUid)
    );
    this.conversationsUnsubFrom = onSnapshot(qFrom,
      (snap) => applySnapshot(snap, 'from'),
      (err)  => console.error('[CONV LISTENER FROM]', err)
    );

    console.log('[CHAT v17] listenConversations bilateral registrado');
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  RENDERIZA LISTA DE CONVERSAS
  // ════════════════════════════════════════════════════════════════════════════
  renderConversationsList(conversations) {
    const container = document.getElementById('chatList');
    if (!container) return;

    if (conversations.length === 0) {
      container.innerHTML =
        '<div style="text-align:center;color:var(--mt);padding:20px;font-size:12px">' +
        '💬 Nenhuma conversa ainda.<br><span style="font-size:10px;opacity:.6">Toque em um piloto no mapa para iniciar.</span></div>';
      return;
    }

    container.innerHTML = conversations.map((conv) => {
      const uid     = conv._interlocutorUid;
      const name    = conv._interlocutorName || conv.fromName || 'Piloto';
      const preview = conv.message || conv.preview || '(sem mensagem)';
      const time    = this.formatTime(conv.createdAtMs || 0);

      // Ícone de não lida
      const unreadDot = (!conv.read)
        ? '<span style="width:8px;height:8px;border-radius:50%;background:var(--g2);display:inline-block;margin-left:4px"></span>'
        : '';

      return `
        <div class="chat-list-item"
          onclick="window.openChatWith('${uid}','${this.escapeHtml(name)}','${this.escapeHtml(conv.fromPhoto || conv.photo || '👨‍✈️')}')">
          <div class="chat-list-av">${conv.fromPhoto && conv.fromPhoto.startsWith('http')
            ? `<img src="${conv.fromPhoto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.outerHTML='👨‍✈️'">`
            : '👨‍✈️'
          }</div>
          <div class="chat-list-info" style="flex:1;min-width:0">
            <div class="chat-list-name">${this.escapeHtml(name)}${unreadDot}</div>
            <div class="chat-list-last">${this.escapeHtml(preview.substring(0, 50))}</div>
          </div>
          <div class="chat-list-time" style="font-size:9px;color:var(--mt);flex-shrink:0">${time}</div>
        </div>
      `;
    }).join('');
  }

  formatTime(ms) {
    if (!ms) return '';
    const date = new Date(ms);
    const now  = new Date();
    const diff = now - date;

    if (diff < 24 * 60 * 60 * 1000)
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (diff < 48 * 60 * 60 * 1000)
      return 'Ontem';
    if (diff < 7 * 24 * 60 * 60 * 1000)
      return date.toLocaleDateString('pt-BR', { weekday: 'short' });
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  ABRE CHAT COM OUTRO USUÁRIO
  // ════════════════════════════════════════════════════════════════════════════
  async openWith(targetUid, targetName) {
    if (!this.db || !this.currentUser) return;

    const chatId = this.getChatId(this.currentUser.uid, targetUid);

    // Evita reabrir o mesmo chat (mas permite se vier de outro contexto)
    if (this.currentChatId === chatId && this.messageUnsub) {
      console.log('[OPEN WITH] Já conectado ao chat', chatId);
      return;
    }

    console.log('[OPEN WITH]', { chatId, targetUid, targetName });

    this.currentChatId     = chatId;
    this.currentTargetUid  = targetUid;
    this.currentTargetName = targetName;

    await this.listenMessages(chatId);
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  LISTENER DE MENSAGENS EM TEMPO REAL
  // ════════════════════════════════════════════════════════════════════════════
  async listenMessages(chatId) {
    if (this.messageUnsub) {
      this.messageUnsub();
      this.messageUnsub = null;
    }

    const { collection, query, orderBy, onSnapshot } =
      await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    const container = document.getElementById('chatMsgs');
    if (!container) return;

    container.innerHTML =
      '<div style="text-align:center;color:var(--mt);padding:16px;font-size:11px">🔄 Carregando…</div>';

    // Ordena por createdAtMs para consistência enquanto serverTimestamp ainda é nulo
    const q = query(
      collection(this.db, `chats/${chatId}/messages`),
      orderBy('createdAtMs', 'asc')
    );

    this.messageUnsub = onSnapshot(
      q,
      (snap) => {
        if (this.currentChatId !== chatId) return; // chat mudou, ignorar

        if (snap.empty) {
          container.innerHTML =
            '<div class="chat-empty">💬 Seja o primeiro a falar!<br>' +
            '<span style="font-size:10px;opacity:.7">Diga olá para iniciar a conversa.</span></div>';
          return;
        }

        const messages = snap.docs.map(doc => doc.data());
        this.renderMessages(container, messages);

        // Som para novas mensagens recebidas (não da cache)
        const newReceived = snap.docChanges().filter(
          c => c.type === 'added'
            && c.doc.data().uid !== this.currentUser?.uid
            && !snap.metadata.fromCache
        );
        if (newReceived.length > 0 && typeof audio?.play === 'function') {
          audio.play('message');
        }
      },
      (err) => {
        console.error('[MESSAGES SNAPSHOT ERROR]', err);
        if (this.currentChatId === chatId) {
          container.innerHTML =
            '<div class="chat-empty">⚠️ Erro ao carregar mensagens.<br>' +
            '<span style="font-size:10px">' + err.message + '</span></div>';
        }
      }
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  RENDERIZA MENSAGENS
  // ════════════════════════════════════════════════════════════════════════════
  renderMessages(container, messages) {
    container.innerHTML = messages.map(m => this.renderMessage(m)).join('');
    container.scrollTop = container.scrollHeight;
  }

  renderMessage(m) {
    const isMe = m.uid === this.currentUser?.uid;
    let time = '';
    if (m.createdAtMs) {
      const d = new Date(m.createdAtMs);
      if (!Number.isNaN(d.getTime()))
        time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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

  // ════════════════════════════════════════════════════════════════════════════
  //  SEND() — BILATERAL
  //
  //  Escreve a mensagem no chat compartilhado e cria DUAS notificações:
  //    notif 1 → to: destinatário  (aparece na lista dele)
  //    notif 2 → to: remetente     (aparece na minha lista — FIX)
  //               from: UID do alvo (para agrupar corretamente no Map)
  //
  //  O campo 'to' do espelho é o próprio remetente (this.currentUser.uid).
  //  O campo 'from' do espelho é o UID do alvo (this.currentTargetUid).
  //  Assim listenConversations() query 'to == myUid' captura AMBAS as notifs,
  //  mas a chave do Map é sempre 'from' = interlocutor → sem duplicação.
  // ════════════════════════════════════════════════════════════════════════════
  async send(text) {
    if (!text?.trim() || !this.currentChatId || !this.db) return false;

    const { collection, addDoc, serverTimestamp } =
      await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    const now     = Date.now();
    const myUid   = this.currentUser.uid;
    const myName  = this.getName();
    const trimmed = text.trim();

    try {
      // ── 1. Mensagem no chat compartilhado ──────────────────────────────────
      await addDoc(collection(this.db, `chats/${this.currentChatId}/messages`), {
        uid:         myUid,
        name:        myName,
        text:        trimmed,
        createdAt:   serverTimestamp(),
        createdAtMs: now,
      });

      if (!this.currentTargetUid) return true;

      const preview = trimmed.substring(0, 60);

      // ── 2. Notificação para o DESTINATÁRIO ────────────────────────────────
      //    → aparece na lista DELE (from = meu uid, ele me vê como interlocutor)
      await addDoc(collection(this.db, 'notifications'), {
        to:          this.currentTargetUid,
        from:        myUid,
        fromName:    myName,
        toName:      this.currentTargetName || 'Piloto',
        type:        'new_message',
        message:     preview,
        createdAt:   serverTimestamp(),
        createdAtMs: now,
        read:        false,
      });

      // ── 3. Notificação ESPELHO para o REMETENTE (EU) ──────────────────────
      //    → to: meu uid  (meu listener captura)
      //    → from: uid do alvo  (chave do Map = interlocutor correto)
      //    → fromName: nome do alvo  (aparece como título da conversa)
      //    → message: "Você: <preview>"  (estilo WhatsApp)
      await addDoc(collection(this.db, 'notifications'), {
        to:          myUid,                                   // ← eu recebo minha própria notif espelho
        from:        this.currentTargetUid,                   // ← chave = interlocutor
        fromName:    this.currentTargetName || 'Piloto',      // ← nome que aparece na lista
        toName:      myName,
        type:        'new_message',
        message:     `Você: ${preview}`,                      // ← "Você: texto" estilo WhatsApp
        createdAt:   serverTimestamp(),
        createdAtMs: now,
        read:        true,                                    // ← já lida (eu enviei)
      });

      return true;
    } catch (err) {
      console.error('[SEND ERROR]', err);
      return false;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  ACCEPT REQUEST — BILATERAL
  //
  //  Quando aceita um pedido:
  //    msg auto → chat compartilhado
  //    notif 1  → to: quem PEDIU     (type: 'accept' — ele abre chat automaticamente)
  //    notif 2  → to: quem ACEITOU   (espelho — aparece na lista de quem aceitou)
  //               from: uid de quem pediu  (chave correta no Map)
  // ════════════════════════════════════════════════════════════════════════════
  async acceptRequest(targetUid, targetName, requestMessage) {
    if (!this.db || !this.currentUser) return;

    const chatId = this.getChatId(this.currentUser.uid, targetUid);
    const now    = Date.now();
    const myUid  = this.currentUser.uid;
    const myName = this.getName();

    const { collection, addDoc, serverTimestamp } =
      await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    const responseText = `✅ Olá! Sou ${myName} e posso te ajudar com: "${requestMessage}". Onde você está?`;

    try {
      // ── 1. Mensagem automática no chat compartilhado ───────────────────────
      await addDoc(collection(this.db, `chats/${chatId}/messages`), {
        uid:         myUid,
        name:        myName,
        text:        responseText,
        createdAt:   serverTimestamp(),
        createdAtMs: now,
      });

      // ── 2. Notificação para quem PEDIU (type: 'accept') ───────────────────
      //    → o listener de notificações dele dispara openChatWith automaticamente
      await addDoc(collection(this.db, 'notifications'), {
        to:           targetUid,
        from:         myUid,
        fromName:     myName,
        accepterName: myName,
        type:         'accept',
        message:      requestMessage,
        createdAt:    serverTimestamp(),
        createdAtMs:  now,
        read:         false,
      });

      // ── 3. Notificação ESPELHO para quem ACEITOU (EU) ─────────────────────
      //    → to: meu uid
      //    → from: uid de quem pediu (chave correta no Map)
      //    → type: 'accept_sent' (diferente para não disparar openChatWith novamente)
      await addDoc(collection(this.db, 'notifications'), {
        to:           myUid,
        from:         targetUid,
        fromName:     targetName || 'Piloto',
        accepterName: myName,
        type:         'accept_sent',                          // ← diferente de 'accept'!
        message:      `Você aceitou: "${requestMessage.substring(0, 40)}"`,
        createdAt:    serverTimestamp(),
        createdAtMs:  now,
        read:         true,                                   // ← já lida
      });

      // Atualiza estado interno para envios futuros neste chat
      this.currentChatId     = chatId;
      this.currentTargetUid  = targetUid;
      this.currentTargetName = targetName;

    } catch (err) {
      console.error('[ACCEPT REQUEST ERROR]', err);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  UTILITÁRIOS
  // ════════════════════════════════════════════════════════════════════════════
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
  }
}

export const chat = new ChatManager();

// Expõe globalmente para o HTML principal poder chamar diretamente
window._chatInstance = chat;
