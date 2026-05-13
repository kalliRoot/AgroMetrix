// ═══════════════════════════════════════════════════════════════
//  AgroMetrix Radar — chat.js v4
//  Chat em tempo real via Firestore
//  v4: Abertura bilateral automática via Chat Popup (salta na tela)
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

  // Abre chat com um piloto (Painel Principal)
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

    const { collection, query, orderBy, onSnapshot, limit, serverTimestamp } =
      await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    const msgs = document.getElementById('chatMsgs');
    if (msgs) msgs.innerHTML = '<div style="text-align:center;color:var(--mt);padding:16px;font-size:11px">Carregando…</div>';

    const q = query(
      collection(this.db, `chats/${chatId}/messages`),
      orderBy('createdAt'),
      limit(100)
    );

    let firstLoad = true;

    const unsub = onSnapshot(q, snap => {
      const container = document.getElementById('chatMsgs');
      if (!container) return;

      if (firstLoad) {
        firstLoad = false;
        if (snap.empty) {
          container.innerHTML = '<div data-placeholder style="text-align:center;color:var(--mt);padding:20px;font-size:11px">Nenhuma mensagem ainda. Diga olá! 👋</div>';
        } else {
          container.innerHTML = snap.docs.map(d => this._renderMsg(d.data())).join('');
        }
      } else {
        snap.docChanges().forEach(change => {
          if (change.type !== 'added') return;
          const m = change.doc.data();
          container.querySelector('[data-placeholder]')?.remove();
          const div = document.createElement('div');
          div.innerHTML = this._renderMsg(m);
          container.appendChild(div.firstElementChild);
          if (m.uid !== this.currentUser.uid) {
            audio.play('message');
            this._showMsgNotification(m);
          }
        });
      }
      container.scrollTop = container.scrollHeight;
    }, err => {
      console.error('[Chat] Erro:', err);
    });

    this.activeChats.set(chatId, { uid: targetUid, unsub });
  }

  _renderMsg(m) {
    const isMe = m.uid === this.currentUser?.uid;
    const time = m.createdAt?.toDate?.()?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) || '';
    const text = this._escHtml(m.text || '');
    return `<div class="chat-msg ${isMe ? 'me' : 'them'}">
      ${!isMe ? `<div class="chat-msg-name">${m.name || 'Piloto'}</div>` : ''}
      <div>${text}</div>
      <div style="font-size:9px;color:${isMe ? 'rgba(255,255,255,.5)' : 'var(--mt)'};margin-top:3px;text-align:right">${time}</div>
    </div>`;
  }

  _showMsgNotification(m) {
    const preview = (m.text || '').substring(0, 50);
    window.showToast?.(`💬 ${m.name || 'Piloto'}: ${preview}`, 5000);
    const chatBtn = document.querySelector('.chat-float .ico-btn');
    if (chatBtn) {
      let dot = chatBtn.querySelector('.chat-notif-dot');
      if (!dot) {
        dot = document.createElement('div');
        dot.className = 'chat-notif-dot notif-dot';
        chatBtn.appendChild(dot);
      }
      dot.textContent = '!';
      dot.classList.add('on');
    }
  }

  // Envia mensagem
  async send(text) {
    if (!text?.trim() || !this.currentChatId || !this.db) return false;
    const { collection, addDoc, serverTimestamp } =
      await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    try {
      await addDoc(collection(this.db, `chats/${this.currentChatId}/messages`), {
        uid: this.currentUser.uid,
        name: this.getName(),
        text: text.trim(),
        createdAt: serverTimestamp(),
      });
      audio.play('message');

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

  // ─────────────────────────────────────────────────────────────
  // Abre o Chat Popup (salta na tela) para garantir abertura bilateral
  // ─────────────────────────────────────────────────────────────
  async _abrirChatPopup(uid, name) {
    if (typeof window.openChatPopup === 'function') {
      await window.openChatPopup(uid, name);
    } else {
      // Fallback para o painel principal se o popup não existir
      if (window.AgroRadar) window.AgroRadar.chatTarget = { uid, name };
      window.openSheet?.('shChat');
      await this.openWith(uid, name);
    }
  }

  // Escuta notificações recebidas
  async listenNotifications() {
    if (!this.db || !this.currentUser) return;
    const { collection, query, where, onSnapshot, orderBy, limit, updateDoc, doc, serverTimestamp } =
      await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    const q = query(
      collection(this.db, 'notifications'),
      where('to', '==', this.currentUser.uid),
      where('read', '==', false),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    onSnapshot(q, snap => {
      snap.docChanges().forEach(async change => {
        if (change.type !== 'added') return;
        const n = { id: change.doc.id, ...change.doc.data() };

        if (n.type === 'message') {
          audio.play('message');
          window.showToast?.(`💬 ${n.fromName}: ${n.preview}`, 5000);
        } else if (n.type === 'accept') {
          // ── LADO DO SOLICITANTE ──
          audio.play('accept');
          audio.stopLoop();
          window.showToast?.(`✅ ${n.fromName} aceitou seu chamado!`, 6000);

          // Salta o chat na tela do solicitante
          setTimeout(async () => {
            await this._abrirChatPopup(n.from, n.fromName);
          }, 300);
        }

        try {
          await updateDoc(doc(this.db, 'notifications', n.id), { read: true });
        } catch {}
      });
    });
  }

  // Carrega conversas ativas reais
  async loadActiveChats() {
    if (!this.db || !this.currentUser) return [];
    const { collection, query, getDocs } =
      await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    try {
      const snap = await getDocs(collection(this.db, 'chats'));
      const myChats = [];
      snap.forEach(d => {
        if (d.id.includes(this.currentUser.uid)) {
          const otherId = d.id.replace(this.currentUser.uid + '_', '').replace('_' + this.currentUser.uid, '');
          if (otherId && otherId !== this.currentUser.uid) {
            myChats.push({ chatId: d.id, otherId });
          }
        }
      });
      return myChats;
    } catch {
      return [];
    }
  }

  _escHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ─────────────────────────────────────────────────────────────
  // Aceita chamado: envia msg automática e abre popup bilateral
  // ─────────────────────────────────────────────────────────────
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

    // 2. Notifica o solicitante (tipo 'accept')
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

    // 3. ── LADO DO ACEITANTE ──
    // Abre o popup imediatamente para quem aceitou
    await this._abrirChatPopup(targetUid, targetName);
  }
}

export const chat = new ChatManager();
