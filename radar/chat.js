// ═══════════════════════════════════════════════════════════════
//  AgroMetrix Radar — chat.js v7
//  Chat em tempo real via Firestore (Estilo WhatsApp/Discord)
//  v7: Correção de loop de repetição e duplicidade
// ═══════════════════════════════════════════════════════════════

import { audio } from './audio.js';

class ChatManager {
  constructor() {
    this.activeChats = new Map(); // chatId -> { uid, name, unsub }
    this.currentChatId = null;
    this.db = null;
    this.currentUser = null;
    this.currentProfile = null;
    this._lastRenderedHtml = ""; // Cache para evitar re-renderização desnecessária
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
    
    // Se já for o chat atual, não reinicia tudo
    if (this.currentChatId === chatId) return;
    
    this.currentChatId = chatId;

    // Atualiza UI do painel principal
    const nameEl = document.getElementById('chatName');
    if (nameEl) nameEl.textContent = targetName;

    // Inicia escuta em tempo real
    await this.listenMessages(chatId, targetUid);
  }

  // Escuta mensagens em tempo real
  async listenMessages(chatId, targetUid) {
    // Cancela qualquer escuta anterior para este chat
    const existing = this.activeChats.get(chatId);
    if (existing?.unsub) {
      existing.unsub();
    }

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
      if (!container || this.currentChatId !== chatId) return;

      // Se o snapshot vier do cache local enquanto o servidor ainda não confirmou,
      // e já tivermos renderizado algo, podemos esperar o snapshot do servidor
      // para evitar "pulos" ou repetições visuais.
      if (snap.metadata.fromCache && this._lastRenderedHtml !== "") return;

      if (snap.empty) {
        container.innerHTML = '<div class="chat-empty">💬 Nenhuma mensagem ainda.<br><span style="font-size:10px;opacity:.7">Diga olá para iniciar a conversa!</span></div>';
        this._lastRenderedHtml = "";
        return;
      }

      // Renderização COMPLETA apenas se houver mudança real no conteúdo
      const messagesHtml = snap.docs.map(doc => this._renderMsg(doc.data())).join('');
      
      if (this._lastRenderedHtml !== messagesHtml) {
        container.innerHTML = messagesHtml;
        this._lastRenderedHtml = messagesHtml;
        container.scrollTop = container.scrollHeight;

        // Tocar som apenas para mensagens RECEBIDAS que acabaram de chegar do servidor
        if (!snap.metadata.hasPendingWrites && !snap.metadata.fromCache) {
          const lastDoc = snap.docs[snap.docs.length - 1];
          if (lastDoc) {
            const lastMsg = lastDoc.data();
            // Só toca se a mensagem for do outro e for "nova" (não do carregamento inicial)
            if (lastMsg.uid !== this.currentUser.uid && snap.docChanges().some(c => c.type === 'added')) {
              audio.play('message');
            }
          }
        }
      }
    }, err => {
      console.error('[Chat] Erro:', err);
    });

    this.activeChats.set(chatId, { uid: targetUid, unsub });
  }

  _renderMsg(m) {
    const isMe = m.uid === this.currentUser?.uid;
    let time = '';
    if (m.createdAt) {
      const date = m.createdAt.toDate ? m.createdAt.toDate() : new Date(m.createdAt);
      time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    
    const text = this._escHtml(m.text || '');
    
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

      // 1. Salva a mensagem
      await addDoc(collection(this.db, `chats/${this.currentChatId}/messages`), msgData);
      
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

    await addDoc(collection(this.db, `chats/${chatId}/messages`), {
      uid: this.currentUser.uid,
      name: this.getName(),
      text: `✅ Olá! Sou ${this.getName()} e posso te ajudar com: "${requestMessage}". Onde você está?`,
      createdAt: serverTimestamp(),
    });

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

    if (typeof window.openChatWith === 'function') {
      await window.openChatWith(targetUid, targetName);
    }
  }
}

export const chat = new ChatManager();
