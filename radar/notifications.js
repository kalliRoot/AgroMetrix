// ═══════════════════════════════════════════════════════════════
//  AgroMetrix Radar — Sistema de Notificações
// ═══════════════════════════════════════════════════════════════

let activeToasts = [];
let activeRequests = [];

export function showToast(message, type = 'info', duration = 3000) {
  let toastContainer = document.getElementById('amx-toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'amx-toast-container';
    toastContainer.style.cssText = 'position:fixed;bottom:100px;left:20px;right:20px;z-index:1001;display:flex;flex-direction:column;gap:8px';
    document.body.appendChild(toastContainer);
  }
  
  const toastId = Date.now();
  const colors = {
    info: '#1e88d0',
    success: '#3da866',
    warning: '#f5a623',
    error: '#e03535'
  };
  
  const toast = document.createElement('div');
  toast.id = 'toast-' + toastId;
  toast.style.cssText = 'background:' + colors[type] + ';color:white;padding:12px 16px;border-radius:8px;font-family:Syne,sans-serif;font-size:13px;animation:slideUp 0.3s ease;box-shadow:0 4px 12px rgba(0,0,0,0.3)';
  toast.textContent = message;
  
  toastContainer.appendChild(toast);
  activeToasts.push(toastId);
  
  setTimeout(function() {
    var t = document.getElementById('toast-' + toastId);
    if (t) t.remove();
    activeToasts = activeToasts.filter(function(id) { return id !== toastId; });
  }, duration);
}

export function addActiveRequest(request) {
  var exists = false;
  for (var i = 0; i < activeRequests.length; i++) {
    if (activeRequests[i].id === request.id) {
      exists = true;
      break;
    }
  }
  
  if (!exists) {
    activeRequests.push({
      id: request.id,
      pilotId: request.pilotId,
      pilotName: request.pilotName,
      message: request.message,
      type: request.type,
      timestamp: Date.now()
    });
    renderActiveRequests();
  }
}

export function removeActiveRequest(requestId) {
  activeRequests = activeRequests.filter(function(r) { return r.id !== requestId; });
  renderActiveRequests();
}

export function getActiveRequests() {
  return activeRequests.slice(-4);
}

function renderActiveRequests() {
  const container = document.getElementById('active-requests-container');
  if (!container) return;
  
  const recentRequests = activeRequests.slice(-4);
  
  if (recentRequests.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:#5a8a65">Nenhum pedido ativo</div>';
    container.style.display = 'none';
    return;
  }
  
  container.style.display = 'block';
  
  let html = '';
  for (var i = 0; i < recentRequests.length; i++) {
    var req = recentRequests[i];
    html += '<div class="request-card" data-id="' + req.id + '" style="background:#1a2a1f;border-radius:8px;padding:12px;margin-bottom:8px;border-left:4px solid ' + (req.type === 'sos' ? '#e03535' : '#f5a623') + '">' +
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<div>' +
          '<span style="font-weight:700;color:white">' + req.pilotName + '</span>' +
          '<span style="font-size:10px;color:#5a8a65;margin-left:8px">' + (req.type === 'sos' ? '🚨 SOS' : '🔧 Pedido') + '</span>' +
          '<div style="font-size:12px;color:#5ec880;margin-top:4px">' + req.message + '</div>' +
        '</div>' +
        '<button class="respond-request-btn" data-id="' + req.id + '" data-pilot="' + req.pilotId + '" data-name="' + req.pilotName + '" style="padding:6px 12px;background:' + (req.type === 'sos' ? '#e03535' : '#f5a623') + ';border:none;border-radius:6px;color:white;cursor:pointer;font-size:11px">' +
          (req.type === 'sos' ? 'Responder SOS' : 'Aceitar') +
        '</button>' +
      '</div>' +
    '</div>';
  }
  container.innerHTML = html;
  
  var btns = document.querySelectorAll('.respond-request-btn');
  for (var j = 0; j < btns.length; j++) {
    var btn = btns[j];
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var id = this.dataset.id;
      var pilotId = this.dataset.pilot;
      var pilotName = this.dataset.name;
      
      window.dispatchEvent(new CustomEvent('amx:respond-from-card', {
        detail: { requestId: id, pilotId: pilotId, pilotName: pilotName }
      }));
      
      // Remover após responder
      removeActiveRequest(id);
    });
  }
}

export function initNotifications() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    @keyframes pulse {
      0%, 100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.1);
      }
    }
    .request-card {
      transition: all 0.3s ease;
    }
    .request-card:hover {
      transform: translateX(4px);
    }
  `;
  document.head.appendChild(style);
}
