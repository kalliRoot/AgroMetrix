// ═══════════════════════════════════════════════════════════════
//  AgroMetrix — history.js  |  Histórico de Operações
//  Registro de GPS + clima + exportação CSV/PDF
// ═══════════════════════════════════════════════════════════════

import {
  saveOperation, getAllOperations, deleteOperation,
  exportOperationsCSV, getStats
} from './db.js';
import { showToast } from './pwa.js';

// Referência ao estado global do app (injetado externamente)
let _getWeatherState = null;

export function setWeatherStateGetter(fn) { _getWeatherState = fn; }

// ═══════════════════════════════════════════════════════════════
//  REGISTRAR OPERAÇÃO
// ═══════════════════════════════════════════════════════════════

export async function registerOperation(formData) {
  const weather = _getWeatherState ? _getWeatherState() : {};
  const op = await saveOperation({
    ...formData,
    weather,
    timestamp: Date.now(),
    syncStatus: navigator.onLine ? 'synced' : 'pending',
  });
  showToast('✅ Operação registrada!', 'success');
  window.dispatchEvent(new CustomEvent('agrometrix:operation-saved', { detail: op }));
  return op;
}

// ═══════════════════════════════════════════════════════════════
//  RENDERIZAR PAINEL DE HISTÓRICO
// ═══════════════════════════════════════════════════════════════

export async function renderHistoryPanel() {
  const ops  = await getAllOperations();
  const stats = await getStats();

  ops.sort((a, b) => b.timestamp - a.timestamp);

  const panel = document.getElementById('historyPanel');
  if (!panel) return;

  panel.innerHTML = `
    <div class="hist-header">
      <div class="hist-title">📋 Histórico de Operações</div>
      <div class="hist-stats">
        <span class="hist-stat"><strong>${stats.total}</strong> ops</span>
        <span class="hist-stat"><strong>${stats.totalArea.toFixed(1)}</strong> ha</span>
        ${stats.lastOp ? `<span class="hist-stat">Última: ${formatDate(stats.lastOp.timestamp)}</span>` : ''}
      </div>
      <div class="hist-actions">
        <button class="btn-hist-csv"  onclick="window.AgroHistory.downloadCSV()">⬇ CSV</button>
        <button class="btn-hist-pdf"  onclick="window.AgroHistory.downloadPDF()">⬇ PDF</button>
        <button class="btn-hist-new"  onclick="window.AgroHistory.openForm()">＋ Nova</button>
      </div>
    </div>

    ${ops.length === 0 ? `
      <div class="hist-empty">
        <div style="font-size:40px;margin-bottom:10px">🌱</div>
        <div>Nenhuma operação registrada ainda.</div>
        <div style="font-size:12px;margin-top:6px;opacity:.6">Clique em "＋ Nova" para registrar sua primeira aplicação.</div>
      </div>
    ` : `
      <div class="hist-list">
        ${ops.map(op => renderOpCard(op)).join('')}
      </div>
    `}
  `;
}

function renderOpCard(op) {
  const d = new Date(op.timestamp);
  const w = op.weather || {};
  const appColors = {
    fungicida: '#5ec880', herbicida: '#1e88d0',
    inseticida: '#c47c2a', adubacao: '#e03535',
  };
  const color = appColors[op.appType] || '#6b8573';
  const syncIcon = op.syncStatus === 'synced' ? '☁️' : '⏳';

  return `
    <div class="op-card" id="op-${op.id}">
      <div class="op-card-accent" style="background:${color}"></div>
      <div class="op-card-body">
        <div class="op-card-row1">
          <div class="op-type-badge" style="background:${color}22;color:${color}">
            ${appTypeLabel(op.appType)}
          </div>
          <div class="op-meta">${syncIcon} ${formatDate(op.timestamp)} ${formatTime(op.timestamp)}</div>
        </div>
        <div class="op-card-title">${op.product || 'Sem produto'}</div>
        <div class="op-card-sub">
          ${op.crop ? `🌾 ${op.crop}` : ''}
          ${op.area ? `· ${op.area} ha` : ''}
          ${op.locName ? `· 📍 ${op.locName}` : ''}
        </div>
        ${w.temp != null ? `
        <div class="op-weather-row">
          <span>🌡 ${w.temp}°C</span>
          <span>💧 ${w.humidity}%</span>
          <span>💨 ${w.wind}km/h</span>
          <span>ΔT ${w.deltaT}°</span>
          ${w.appScore != null ? `<span style="color:${w.appScore>=70?'#3da866':w.appScore>=40?'#e07a00':'#e03535'}">★ ${w.appScore}%</span>` : ''}
        </div>` : ''}
        ${op.notes ? `<div class="op-notes">${op.notes}</div>` : ''}
        <div class="op-card-actions">
          ${op.lat ? `<a href="https://maps.google.com/?q=${op.lat},${op.lon}" target="_blank" class="btn-op-sm">🗺 Ver no mapa</a>` : ''}
          <button class="btn-op-sm btn-op-delete" onclick="window.AgroHistory.deleteOp('${op.id}')">🗑 Excluir</button>
        </div>
      </div>
    </div>`;
}

function appTypeLabel(t) {
  return { fungicida:'🍃 Fungicida', herbicida:'🌿 Herbicida',
           inseticida:'🐛 Inseticida', adubacao:'💧 Adubação' }[t] || t || '?';
}

// ═══════════════════════════════════════════════════════════════
//  FORMULÁRIO DE NOVA OPERAÇÃO
// ═══════════════════════════════════════════════════════════════

export function openOperationForm() {
  const existing = document.getElementById('opFormModal');
  if (existing) existing.remove();

  const weather = _getWeatherState ? _getWeatherState() : {};
  const lat  = window.currentLat  || '';
  const lon  = window.currentLon  || '';
  const loc  = window.currentLocName || '';

  const modal = document.createElement('div');
  modal.id = 'opFormModal';
  modal.className = 'op-form-modal';
  modal.innerHTML = `
    <div class="op-form-box">
      <div class="op-form-header">
        <div class="op-form-title">📝 Registrar Operação</div>
        <button class="op-form-close" onclick="this.closest('.op-form-modal').remove()">✕</button>
      </div>

      <div class="op-form-weather-snap">
        <div class="snap-label">📍 Condições atuais — ${loc || 'localização desconhecida'}</div>
        <div class="snap-row">
          ${weather.temp  != null ? `<span>🌡 ${weather.temp}°C</span>` : ''}
          ${weather.humidity != null ? `<span>💧 ${weather.humidity}%</span>` : ''}
          ${weather.wind  != null ? `<span>💨 ${weather.wind}km/h</span>` : ''}
          ${weather.deltaT  != null ? `<span>ΔT ${weather.deltaT}°C</span>` : ''}
          ${weather.condition ? `<span>${weather.condition}</span>` : ''}
        </div>
      </div>

      <div class="op-form-body">
        <div class="op-field">
          <label>Tipo de Aplicação *</label>
          <select id="fAppType">
            <option value="">Selecione…</option>
            <option value="fungicida">🍃 Fungicida</option>
            <option value="herbicida">🌿 Herbicida</option>
            <option value="inseticida">🐛 Inseticida</option>
            <option value="adubacao">💧 Adubação Foliar</option>
          </select>
        </div>
        <div class="op-field">
          <label>Produto *</label>
          <input type="text" id="fProduct" placeholder="Nome comercial do produto">
        </div>
        <div class="op-field-row">
          <div class="op-field">
            <label>Dosagem</label>
            <input type="text" id="fDosage" placeholder="Ex: 200 mL/ha">
          </div>
          <div class="op-field">
            <label>Área (ha)</label>
            <input type="number" id="fArea" placeholder="0.00" step="0.1" min="0">
          </div>
        </div>
        <div class="op-field">
          <label>Cultura</label>
          <input type="text" id="fCrop" placeholder="Ex: Soja, Milho, Cana…">
        </div>
        <div class="op-field">
          <label>Observações</label>
          <textarea id="fNotes" placeholder="Notas adicionais sobre a operação…" rows="3"></textarea>
        </div>
      </div>

      <div class="op-form-footer">
        <button class="btn-form-cancel" onclick="this.closest('.op-form-modal').remove()">Cancelar</button>
        <button class="btn-form-save" onclick="window.AgroHistory.submitForm()">💾 Salvar Operação</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('open'));

  // Fechar ao clicar fora
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

export async function submitForm() {
  const appType = document.getElementById('fAppType')?.value;
  const product = document.getElementById('fProduct')?.value?.trim();
  if (!appType || !product) {
    showToast('⚠ Preencha tipo e produto', 'warn');
    return;
  }
  const weather = _getWeatherState ? _getWeatherState() : {};
  await registerOperation({
    appType,
    product,
    dosage:  document.getElementById('fDosage')?.value?.trim(),
    area:    document.getElementById('fArea')?.value,
    crop:    document.getElementById('fCrop')?.value?.trim(),
    notes:   document.getElementById('fNotes')?.value?.trim(),
    locName: window.currentLocName || '—',
    lat:     window.currentLat,
    lon:     window.currentLon,
    weather,
  });
  document.getElementById('opFormModal')?.remove();
  await renderHistoryPanel();
}

export async function deleteOp(id) {
  if (!confirm('Excluir esta operação?')) return;
  await deleteOperation(id);
  await renderHistoryPanel();
  showToast('🗑 Operação excluída', 'info');
}

// ═══════════════════════════════════════════════════════════════
//  EXPORTAÇÃO
// ═══════════════════════════════════════════════════════════════

export async function downloadOperationsCSV() {
  const csv = await exportOperationsCSV();
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, `agrometrix_operacoes_${dateFileStr()}.csv`);
  showToast('⬇ CSV exportado com sucesso', 'success');
}

export async function downloadOperationsPDF() {
  const ops   = await getAllOperations();
  const stats = await getStats();
  const html  = buildPDFHTML(ops, stats);

  const win = window.open('', '_blank');
  if (!win) { showToast('⚠ Habilite popups para gerar PDF', 'warn'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 800);
}

function buildPDFHTML(ops, stats) {
  const now = new Date();
  const rows = ops.sort((a,b) => b.timestamp - a.timestamp).map(op => {
    const d = new Date(op.timestamp);
    const w = op.weather || {};
    return `
      <tr>
        <td>${d.toLocaleDateString('pt-BR')}</td>
        <td>${d.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})}</td>
        <td>${appTypeLabel(op.appType)}</td>
        <td>${op.product || '—'}</td>
        <td>${op.crop || '—'}</td>
        <td>${op.area ? op.area+' ha' : '—'}</td>
        <td>${op.locName || '—'}</td>
        <td>${w.temp != null ? w.temp+'°C' : '—'}</td>
        <td>${w.humidity != null ? w.humidity+'%' : '—'}</td>
        <td>${w.wind != null ? w.wind+' km/h' : '—'}</td>
        <td>${w.deltaT != null ? w.deltaT+'°C' : '—'}</td>
        <td>${op.notes || '—'}</td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>AgroMetrix — Relatório de Operações</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 20px; }
  .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding-bottom: 14px; border-bottom: 2px solid #1f5534; }
  .logo { font-size: 22px; font-weight: 800; color: #1f5534; }
  .logo span { color: #3da866; }
  .report-meta { font-size: 10px; color: #666; text-align: right; }
  .stats-row { display: flex; gap: 16px; margin-bottom: 18px; }
  .stat-box { background: #f5faf6; border: 1px solid #d0e8d8; border-radius: 8px; padding: 10px 16px; flex: 1; text-align: center; }
  .stat-val { font-size: 22px; font-weight: 700; color: #1f5534; }
  .stat-label { font-size: 10px; color: #6b8573; margin-top: 2px; }
  h2 { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #3a5240; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #1f5534; color: white; padding: 7px 8px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .05em; }
  td { padding: 6px 8px; border-bottom: 1px solid #eee; font-size: 10px; vertical-align: top; }
  tr:nth-child(even) td { background: #f9fbf9; }
  .footer { margin-top: 20px; text-align: center; font-size: 9px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
  @media print {
    body { padding: 10px; }
    .stat-box { break-inside: avoid; }
    tr { break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="header">
  <div class="logo">Agro<span>Metrix</span></div>
  <div class="report-meta">
    <div>Relatório gerado em ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div>
    <div>Clima certo, aplicação perfeita</div>
  </div>
</div>
<div class="stats-row">
  <div class="stat-box"><div class="stat-val">${stats.total}</div><div class="stat-label">Total de Operações</div></div>
  <div class="stat-box"><div class="stat-val">${stats.totalArea.toFixed(1)}</div><div class="stat-label">Hectares Registrados</div></div>
  <div class="stat-box"><div class="stat-val">${stats.byType.fungicida||0}</div><div class="stat-label">Fungicidas</div></div>
  <div class="stat-box"><div class="stat-val">${stats.byType.herbicida||0}</div><div class="stat-label">Herbicidas</div></div>
  <div class="stat-box"><div class="stat-val">${stats.byType.inseticida||0}</div><div class="stat-label">Inseticidas</div></div>
  <div class="stat-box"><div class="stat-val">${stats.byType.adubacao||0}</div><div class="stat-label">Adubações</div></div>
</div>
<h2>Registro Detalhado de Operações</h2>
<table>
  <thead>
    <tr>
      <th>Data</th><th>Hora</th><th>Tipo</th><th>Produto</th><th>Cultura</th>
      <th>Área</th><th>Local</th><th>Temp.</th><th>Umid.</th><th>Vento</th>
      <th>ΔT</th><th>Obs.</th>
    </tr>
  </thead>
  <tbody>${rows || '<tr><td colspan="12" style="text-align:center;padding:20px;color:#999">Nenhuma operação registrada</td></tr>'}</tbody>
</table>
<div class="footer">AgroMetrix — Dados locais | open-meteo.com | agrometrix-one.vercel.app</div>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════
//  ESTILOS DO PAINEL
// ═══════════════════════════════════════════════════════════════

export function injectHistoryStyles() {
  if (document.getElementById('history-styles')) return;
  const s = document.createElement('style');
  s.id = 'history-styles';
  s.textContent = `
    /* ── Panel ── */
    #historyPanel {
      max-width: 960px; margin: 0 auto 12px; padding: 0 20px;
    }
    .hist-header {
      display: flex; align-items: center; gap: 12px;
      margin-bottom: 12px; flex-wrap: wrap;
    }
    .hist-title { font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--text-secondary); }
    .hist-stats { display: flex; gap: 8px; flex: 1; }
    .hist-stat { font-size: 11px; color: var(--text-muted); padding: 3px 10px; background: var(--surface); border: 1px solid var(--border); border-radius: 20px; }
    .hist-actions { display: flex; gap: 6px; }
    .btn-hist-csv, .btn-hist-pdf, .btn-hist-new {
      padding: 7px 14px; border-radius: 10px; border: none;
      font-family: var(--font-ui); font-size: 12px; font-weight: 600;
      cursor: pointer; transition: all .2s;
    }
    .btn-hist-csv { background: var(--sky-500, #1567a0); color: white; }
    .btn-hist-pdf { background: var(--earth-600, #8c5a1e); color: white; }
    .btn-hist-new { background: var(--green-600, #286b42); color: white; }
    .btn-hist-csv:hover, .btn-hist-pdf:hover, .btn-hist-new:hover { transform: translateY(-1px); filter: brightness(1.1); }

    .hist-empty { text-align: center; padding: 40px 20px; color: var(--text-muted); font-size: 13px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg, 22px); }
    .hist-list { display: flex; flex-direction: column; gap: 7px; }

    /* ── Op Card ── */
    .op-card { display: flex; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md, 14px); overflow: hidden; box-shadow: var(--shadow-card); transition: box-shadow .2s; }
    .op-card:hover { box-shadow: var(--shadow-float); }
    .op-card-accent { width: 5px; flex-shrink: 0; }
    .op-card-body { flex: 1; padding: 12px 14px; }
    .op-card-row1 { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
    .op-type-badge { font-size: 10px; font-weight: 700; padding: 2px 9px; border-radius: 6px; }
    .op-meta { font-size: 10px; color: var(--text-muted); font-family: var(--font-mono); margin-left: auto; }
    .op-card-title { font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 2px; }
    .op-card-sub { font-size: 11px; color: var(--text-muted); margin-bottom: 6px; }
    .op-weather-row { display: flex; gap: 10px; font-size: 10px; font-family: var(--font-mono); color: var(--text-secondary); flex-wrap: wrap; padding: 5px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); margin-bottom: 6px; }
    .op-notes { font-size: 11px; color: var(--text-muted); font-style: italic; margin-bottom: 6px; }
    .op-card-actions { display: flex; gap: 6px; }
    .btn-op-sm {
      font-size: 10px; font-weight: 600; padding: 3px 9px;
      border-radius: 6px; border: 1px solid var(--border-md);
      background: var(--surface2); color: var(--text-secondary);
      cursor: pointer; text-decoration: none; transition: all .2s;
    }
    .btn-op-sm:hover { background: var(--surface3); }
    .btn-op-delete { color: var(--red-500, #e03535); }

    /* ── Form Modal ── */
    .op-form-modal {
      position: fixed; inset: 0; background: var(--modal-overlay);
      backdrop-filter: blur(8px); z-index: 600;
      display: flex; align-items: flex-end; justify-content: center;
      padding: 0; opacity: 0; transition: opacity .3s;
    }
    .op-form-modal.open { opacity: 1; }
    .op-form-box {
      background: var(--surface); border-radius: 22px 22px 0 0;
      width: 100%; max-width: 600px; max-height: 90vh;
      overflow-y: auto; box-shadow: var(--shadow-float);
      transform: translateY(40px); transition: transform .35s cubic-bezier(.34,1.2,.64,1);
    }
    .op-form-modal.open .op-form-box { transform: translateY(0); }
    .op-form-header { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px 12px; border-bottom: 1px solid var(--border); }
    .op-form-title { font-size: 15px; font-weight: 700; color: var(--text-primary); }
    .op-form-close { background: none; border: none; font-size: 18px; color: var(--text-muted); cursor: pointer; padding: 4px 8px; border-radius: 8px; }
    .op-form-close:hover { background: var(--surface2); }
    .op-form-weather-snap { padding: 10px 20px; background: var(--surface2); border-bottom: 1px solid var(--border); }
    .snap-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: var(--text-muted); margin-bottom: 5px; }
    .snap-row { display: flex; gap: 12px; font-size: 12px; font-family: var(--font-mono); color: var(--text-secondary); flex-wrap: wrap; }
    .op-form-body { padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; }
    .op-field label { display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .07em; color: var(--text-muted); margin-bottom: 5px; }
    .op-field input, .op-field select, .op-field textarea {
      width: 100%; padding: 10px 13px; background: var(--surface2);
      border: 1.5px solid var(--border-md); border-radius: 10px;
      font-family: var(--font-ui); font-size: 14px; color: var(--text-primary); outline: none;
      transition: border .2s;
    }
    .op-field input:focus, .op-field select:focus, .op-field textarea:focus { border-color: var(--green-400); }
    .op-field textarea { resize: vertical; }
    .op-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .op-form-footer { display: flex; gap: 10px; padding: 14px 20px; border-top: 1px solid var(--border); }
    .btn-form-cancel { flex: 1; padding: 12px; background: var(--surface2); border: 1px solid var(--border-md); border-radius: var(--radius-md); font-family: var(--font-ui); font-size: 14px; font-weight: 600; color: var(--text-secondary); cursor: pointer; }
    .btn-form-save { flex: 2; padding: 12px; background: var(--green-600); color: white; border: none; border-radius: var(--radius-md); font-family: var(--font-ui); font-size: 14px; font-weight: 700; cursor: pointer; transition: all .2s; }
    .btn-form-save:hover { background: var(--green-700); }

    @media (max-width: 540px) {
      .op-form-box { border-radius: 20px 20px 0 0; }
      .op-field-row { grid-template-columns: 1fr; }
      .hist-actions { width: 100%; }
    }
  `;
  document.head.appendChild(s);
}

// ═══════════════════════════════════════════════════════════════
//  API PÚBLICA (window.AgroHistory)
// ═══════════════════════════════════════════════════════════════

window.AgroHistory = {
  openForm:    openOperationForm,
  submitForm,
  deleteOp,
  downloadCSV: downloadOperationsCSV,
  downloadPDF: downloadOperationsPDF,
};

// ── Helpers ───────────────────────────────────────────────────────
function formatDate(ts) {
  return new Date(ts).toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' });
}
function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
}
function dateFileStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
