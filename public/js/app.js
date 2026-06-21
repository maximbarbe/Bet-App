import { betsApi as api } from './api.js';
import { calculateProfit, proportionalDevig, resultOf } from './calculations.js';
import { $, $$, escapeHtml, formatDate, formatDateTime, money, signedMoney } from './utils.js';

const STORAGE_KEY = 'edge-bets-v1';
let bets = [];
let activeFilter = 'all';

async function loadBets() {
  bets = await api();
  const legacy = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  if (!bets.length && legacy.length) {
    for (const old of legacy) {
      const outcome = old.profit == null ? 'pending' : Number(old.profit) > 0 ? 'win' : Number(old.profit) < 0 ? 'loss' : 'push';
      await api('', { method: 'POST', body: JSON.stringify({ ...old, selection: old.selection || old.line, line: old.market || 'Unspecified market', outcome }) });
    }
    localStorage.removeItem(STORAGE_KEY);
    bets = await api();
    showToast('Existing bets moved to SQLite');
  }
  renderAll();
}

// Re-render every view that depends on the in-memory bet list.
function renderAll() {
  renderStats();
  renderChart();
  renderPerformanceHistory();
  renderRecent();
  renderBetsTable();
}

function renderStats() {
  const settled = bets.filter(b => resultOf(b) !== 'pending');
  const profit = settled.reduce((sum, b) => sum + Number(b.profit), 0);
  const staked = bets.reduce((sum, b) => sum + Number(b.stake), 0);
  const settledStake = settled.reduce((sum, b) => sum + Number(b.stake), 0);
  const counts = { win: 0, loss: 0, push: 0 };
  settled.forEach(b => {
    const result = resultOf(b);
    if (result === 'win' || result === 'half-win') counts.win++;
    else if (result === 'loss' || result === 'half-loss') counts.loss++;
    else counts.push++;
  });
  $('#netProfit').textContent = signedMoney(profit);
  $('#netProfitHint').textContent = settled.length ? `${settled.length} settled bet${settled.length === 1 ? '' : 's'}` : 'No settled bets yet';
  $('#totalStaked').textContent = money(staked);
  $('#stakedHint').textContent = `Across ${bets.length} bet${bets.length === 1 ? '' : 's'}`;
  $('#roi').textContent = settledStake ? `${profit >= 0 ? '+' : ''}${((profit / settledStake) * 100).toFixed(1)}%` : '—';
  $('#record').textContent = `${counts.win}–${counts.loss}–${counts.push}`;
}

function settledBetsInStartOrder() {
  return bets
    .filter(bet => resultOf(bet) !== 'pending')
    .sort((left, right) => new Date(left.date) - new Date(right.date));
}

function resultTone(result) {
  if (result.includes('win')) return 'win';
  if (result.includes('loss')) return 'loss';
  return 'push';
}

function resultColorClass(result) {
  if (result === 'half-win') return 'half-positive';
  if (result === 'half-loss') return 'half-negative';
  if (result === 'win') return 'positive';
  if (result === 'loss') return 'negative';
  return 'neutral';
}

function populateTimeSelectors() {
  $('#betHour').innerHTML = Array.from({ length: 24 }, (_, hour) => {
    const value = String(hour).padStart(2, '0');
    return `<option value="${value}">${value}</option>`;
  }).join('');

  $('#betMinute').innerHTML = Array.from({ length: 60 }, (_, minute) => {
    const value = String(minute).padStart(2, '0');
    return `<option value="${value}">${value}</option>`;
  }).join('');
}

function setBetDateTime(value) {
  const [date, time = '00:00'] = value.slice(0, 16).split('T');
  const [hour = '00', minute = '00'] = time.split(':');
  $('#betDate').value = date;
  $('#betHour').value = hour;
  $('#betMinute').value = minute;
}

function getBetDateTime() {
  return `${$('#betDate').value}T${$('#betHour').value}:${$('#betMinute').value}`;
}

function renderProfitChart(svgSelector, emptySelector) {
  const settled = settledBetsInStartOrder();
  const svg = $(svgSelector);
  const emptyState = $(emptySelector);
  if (!svg || !emptyState) return;

  emptyState.classList.toggle('hidden', settled.length > 0);
  svg.classList.toggle('hidden', settled.length === 0);
  if (!settled.length) return;

  const width = 800, height = 270, pad = { t: 20, r: 20, b: 30, l: 55 };
  let running = 0;
  const data = [{ label: 'Start', value: 0 }, ...settled.map(b => ({ label: formatDate(b.date, true), value: running += Number(b.profit) }))];
  let min = Math.min(0, ...data.map(d => d.value));
  let max = Math.max(0, ...data.map(d => d.value));

  // A flat chart needs a real vertical range or midpoint ticks render outside the SVG.
  if (max === min) {
    const padding = Math.max(Math.abs(max) * 0.1, 1);
    min -= padding;
    max += padding;
  }

  const range = max - min;
  const x = i => pad.l + (i / Math.max(data.length - 1, 1)) * (width - pad.l - pad.r);
  const y = v => pad.t + ((max - v) / range) * (height - pad.t - pad.b);
  const points = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  const gridValues = [max, min + range * .5, min];
  const grids = gridValues.map(v => `<line class="chart-grid" x1="${pad.l}" x2="${width-pad.r}" y1="${y(v)}" y2="${y(v)}"/><text class="chart-label" x="0" y="${y(v)+3}">${escapeHtml(signedMoney(v))}</text>`).join('');
  const labels = data.map((d,i) => (i === 0 || i === data.length-1 || (data.length > 5 && i === Math.floor(data.length/2))) ? `<text class="chart-label" text-anchor="middle" x="${x(i)}" y="${height-5}">${escapeHtml(d.label)}</text>` : '').join('');
  const zero = min < 0 && max > 0 ? `<line class="chart-zero" x1="${pad.l}" x2="${width-pad.r}" y1="${y(0)}" y2="${y(0)}"/>` : '';
  const gradientId = `${svg.id}Gradient`;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.innerHTML = `<defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8f36a" stop-opacity=".22"/><stop offset="1" stop-color="#c8f36a" stop-opacity="0"/></linearGradient></defs>${grids}${zero}<polygon class="chart-area" style="fill:url(#${gradientId})" points="${points} ${x(data.length-1)},${height-pad.b} ${x(0)},${height-pad.b}"/><polyline class="chart-line" points="${points}"/>${labels}`;
}

function renderChart() {
  renderProfitChart('#profitChart', '#chartEmpty');
  renderProfitChart('#performanceChart', '#performanceChartEmpty');
}

function renderPerformanceHistory() {
  const settled = settledBetsInStartOrder();
  $('#completedBetCount').textContent = `${settled.length} BET${settled.length === 1 ? '' : 'S'}`;
  $('#completedHistoryEmpty').classList.toggle('hidden', settled.length > 0);
  $('#completedBetHistory').classList.toggle('hidden', settled.length === 0);
  $('#completedBetHistory').innerHTML = settled.map((bet, index) => {
    const result = resultOf(bet);
    const tone = resultTone(result);
    return `<article class="completed-bet-card ${tone} ${result}" data-edit="${bet.id}"><div class="history-sequence">${String(index + 1).padStart(2, '0')}</div><div class="history-match"><span>${escapeHtml(bet.sport)}</span><h3>${escapeHtml(bet.teamA)} <small>vs</small> ${escapeHtml(bet.teamB)}</h3><p>${formatDateTime(bet.date)}</p></div><div class="history-selection"><span>BET</span><strong>${escapeHtml(bet.selection)}</strong><p>${escapeHtml(bet.line)} · ${Number(bet.odds).toFixed(3)}</p></div><div class="history-stake"><span>STAKE</span><strong>${money(bet.stake)}</strong></div><div class="history-result"><span class="status ${result}">${result.replace('-', ' ')}</span><strong>${signedMoney(Number(bet.profit))}</strong></div></article>`;
  }).join('');
}

function betRow(bet) {
  const result = resultOf(bet);
  const tone = resultColorClass(result);
  return `<tr><td class="matchup"><strong>${escapeHtml(bet.teamA)} <span>vs</span> ${escapeHtml(bet.teamB)}</strong><span>${escapeHtml(bet.sport)}</span></td><td>${formatDate(bet.date)}</td><td><strong>${escapeHtml(bet.selection)}</strong><br><span class="neutral">${escapeHtml(bet.line)}</span></td><td>${Number(bet.odds).toFixed(3)}</td><td>${money(bet.stake)}</td><td><span class="status ${result}">${result.replace('-', ' ')}</span></td><td class="${tone}">${result === 'pending' ? '—' : signedMoney(Number(bet.profit))}</td><td><button class="edit-button" data-edit="${bet.id}">Edit</button></td></tr>`;
}

function renderBetsTable() {
  const query = $('#betSearch').value.trim().toLowerCase();
  const filtered = [...bets].sort((a,b) => new Date(b.date)-new Date(a.date)).filter(b => {
    const result = resultOf(b);
    const filterMatch = activeFilter === 'all' || (activeFilter === 'settled' ? result !== 'pending' : result === 'pending');
    const searchMatch = `${b.teamA} ${b.teamB} ${b.sport} ${b.selection} ${b.line}`.toLowerCase().includes(query);
    return filterMatch && searchMatch;
  });
  $('#betsTableBody').innerHTML = filtered.map(betRow).join('');
  $('#betsEmpty').classList.toggle('hidden', filtered.length > 0);
  $('.bets-table').classList.toggle('hidden', filtered.length === 0);
}

function renderRecent() {
  const recent = [...bets].sort((a,b) => new Date(b.date)-new Date(a.date)).slice(0, 4);
  $('#recentBets').innerHTML = recent.length ? recent.map(b => {
    const result = resultOf(b);
    const initial = b.sport.trim().charAt(0).toUpperCase();
    const tone = resultColorClass(result);
    return `<div class="recent-item" data-edit="${b.id}"><div class="sport-badge">${escapeHtml(initial)}</div><div><h3>${escapeHtml(b.teamA)} vs ${escapeHtml(b.teamB)}</h3><p>${formatDate(b.date, true)} · ${escapeHtml(b.selection)} · ${escapeHtml(b.line)}</p></div><span class="recent-profit ${tone}">${result === 'pending' ? 'PENDING' : signedMoney(Number(b.profit))}</span></div>`;
  }).join('') : '<div class="empty-mini">Your latest bets will appear here.</div>';
}

function openModal(id = null) {
  $('#betForm').reset();
  $('#betId').value = '';
  setOutcome('pending');
  $('#deleteBet').classList.add('hidden');
  $('#modalTitle').textContent = 'Add a new bet';
  const localNow = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16);
  setBetDateTime(localNow);
  if (id) {
    const bet = bets.find(b => String(b.id) === String(id));
    if (!bet) return;
    $('#modalTitle').textContent = 'Edit bet';
    $('#betId').value = bet.id;
    setBetDateTime(bet.date);
    $('#betSport').value = bet.sport;
    $('#teamA').value = bet.teamA;
    $('#teamB').value = bet.teamB;
    $('#betSelection').value = bet.selection;
    $('#betLine').value = bet.line;
    $('#betOdds').value = bet.odds;
    $('#betStake').value = bet.stake;
    setOutcome(bet.outcome || 'pending');
    $('#deleteBet').classList.remove('hidden');
  }
  $('#betModal').classList.remove('hidden');
  setTimeout(() => $('#betSport').focus(), 50);
}

function closeModal() { $('#betModal').classList.add('hidden'); }
function showToast(message) { const el=$('#toast'); el.textContent=message; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2200); }

function setOutcome(outcome) {
  $('#betOutcome').value = outcome;
  $$('#resultPicker button').forEach(button => button.classList.toggle('selected', button.dataset.outcome === outcome));
}

$('#betForm').addEventListener('submit', async event => {
  event.preventDefault();
  const id = $('#betId').value;
  const odds = Number($('#betOdds').value), stake = Number($('#betStake').value), outcome = $('#betOutcome').value;
  const bet = { date: getBetDateTime(), sport: $('#betSport').value.trim(), teamA: $('#teamA').value.trim(), teamB: $('#teamB').value.trim(), selection: $('#betSelection').value.trim(), line: $('#betLine').value.trim(), odds, stake, outcome, profit: calculateProfit(outcome, odds, stake) };
  try {
    if (id) await api(`/${id}`, { method: 'PUT', body: JSON.stringify(bet) });
    else await api('', { method: 'POST', body: JSON.stringify(bet) });
    bets = await api(); renderAll(); closeModal(); showToast(id ? 'Bet updated' : 'Bet added');
  } catch (error) { showToast(error.message); }
});

$('#deleteBet').addEventListener('click', async () => {
  const id = $('#betId').value;
  if (!id || !confirm('Delete this bet permanently?')) return;
  try { await api(`/${id}`, { method: 'DELETE' }); bets = await api(); renderAll(); closeModal(); showToast('Bet deleted'); }
  catch (error) { showToast(error.message); }
});

function route() {
  const name = ['dashboard','performance','bets','kelly','devig'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'dashboard';
  $$('.page').forEach(p => p.classList.add('hidden'));
  $(`#${name}Page`).classList.remove('hidden');
  $$('.nav a').forEach(a => a.classList.toggle('active', a.dataset.route === name));
  $('.sidebar').classList.remove('open');
  if (name === 'dashboard' || name === 'performance') setTimeout(renderChart, 0);
}

function addOutcome(name='', odds='', probability='') {
  const row = document.createElement('div');
  row.className = 'kelly-outcome';
  row.innerHTML = `<label class="field outcome-name"><span>Outcome</span><input class="outcome-label" placeholder="e.g. Home win" value="${escapeHtml(name)}" required></label><label class="field"><span>Decimal odds</span><input class="outcome-odds" type="number" min="1.001" step="0.001" placeholder="2.100" value="${odds}" required></label><label class="field"><span>Your probability</span><div class="input-prefix"><input class="outcome-prob" type="number" min="0.01" max="100" step="0.01" placeholder="52" value="${probability}" required><b>%</b></div></label><button type="button" class="remove-outcome" aria-label="Remove outcome">×</button>`;
  row.querySelector('.remove-outcome').addEventListener('click', () => { if ($$('.kelly-outcome').length > 2) row.remove(); });
  $('#kellyOutcomes').appendChild(row);
}

function addDevigOutcome(name='', offered='', sharp='') {
  const row = document.createElement('div');
  row.className = 'devig-outcome-row';
  row.innerHTML = `<input class="devig-name" aria-label="Outcome" placeholder="e.g. Over 2.5" value="${escapeHtml(name)}" required><input class="devig-offered" aria-label="Offered odds" type="number" min="1.001" step="0.001" placeholder="2.100" value="${offered}" required><input class="devig-sharp" aria-label="Sharp market odds" type="number" min="1.001" step="0.001" placeholder="1.950" value="${sharp}" required><button type="button" class="remove-outcome" aria-label="Remove outcome">×</button>`;
  row.querySelector('.remove-outcome').addEventListener('click', () => { if ($$('.devig-outcome-row').length > 2) row.remove(); });
  $('#devigOutcomes').appendChild(row);
}

$('#devigForm').addEventListener('submit', event => {
  event.preventDefault();
  const bankroll = Number($('#devigBankroll').value);
  const outcomes = $$('.devig-outcome-row').map(row => ({
    name: row.querySelector('.devig-name').value.trim(),
    offered: Number(row.querySelector('.devig-offered').value),
    sharp: Number(row.querySelector('.devig-sharp').value)
  }));
  const { impliedTotal, results } = proportionalDevig(outcomes, bankroll);
  $('#marketHold').textContent = `${((impliedTotal - 1) * 100).toFixed(2)}%`;
  $('#probabilityTotal').textContent = `${(results.reduce((sum, item) => sum + item.fairProbability, 0) * 100).toFixed(2)}%`;
  const positiveCount = results.filter(item => item.expectedEdge > 0).length;
  $('#positiveEdges').textContent = `${positiveCount} / ${results.length}`;
  $('#devigResults').innerHTML = results.map(item => {
    const hasEdge = item.expectedEdge > 0;
    return `<article class="devig-result ${hasEdge ? '' : 'no-edge'}"><div class="devig-result-head"><h3>${escapeHtml(item.name)}</h3><span class="edge-label ${hasEdge ? 'positive' : 'negative'}">${hasEdge ? '+' : ''}${(item.expectedEdge * 100).toFixed(2)}% EV</span></div><div class="devig-result-grid"><div><span>FAIR PROBABILITY</span><strong>${(item.fairProbability * 100).toFixed(2)}%</strong></div><div><span>OFFERED IMPLIED</span><strong>${(item.offeredImplied * 100).toFixed(2)}%</strong></div><div><span>PROB. EDGE</span><strong class="${item.probabilityEdge > 0 ? 'positive' : 'negative'}">${item.probabilityEdge >= 0 ? '+' : ''}${(item.probabilityEdge * 100).toFixed(2)}%</strong></div></div><div class="recommended-stake"><span>Quarter Kelly · ${(item.quarterKelly * 100).toFixed(2)}% bankroll</span><strong>${money(item.stake)}</strong></div></article>`;
  }).join('');
  $('#devigSummary').classList.remove('hidden');
  $('#devigSummary').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

$('#kellyForm').addEventListener('submit', event => {
  event.preventDefault();
  const bankroll = Number($('#kellyBankroll').value);
  const outcomes = $$('.kelly-outcome').map(row => ({ name: row.querySelector('.outcome-label').value, odds: Number(row.querySelector('.outcome-odds').value), probability: Number(row.querySelector('.outcome-prob').value) / 100 }));
  $('#kellyResultCards').innerHTML = outcomes.map(item => {
    const b = item.odds - 1, q = 1 - item.probability;
    const fullKelly = (b * item.probability - q) / b;
    const quarterKelly = Math.max(0, fullKelly / 4);
    const stake = bankroll * quarterKelly;
    const implied = 1 / item.odds;
    const edge = item.probability - implied;
    return `<article class="kelly-result-card"><div class="kelly-result-top"><h3>${escapeHtml(item.name)}</h3><span class="edge-label ${edge > 0 ? 'positive' : 'negative'}">${edge >= 0 ? '+' : ''}${(edge*100).toFixed(1)}% EDGE</span></div><strong class="kelly-stake">${money(stake)}</strong><p>${(quarterKelly*100).toFixed(2)}% of bankroll · Full Kelly ${(Math.max(0,fullKelly)*100).toFixed(2)}%</p></article>`;
  }).join('');
});

$$('[data-action="new-bet"]').forEach(button => button.addEventListener('click', () => openModal()));
document.addEventListener('click', event => { const trigger = event.target.closest('[data-edit]'); if (trigger) openModal(trigger.dataset.edit); });
$('#closeModal').addEventListener('click', closeModal);
$('#cancelModal').addEventListener('click', closeModal);
$('#betModal').addEventListener('click', event => { if (event.target === $('#betModal')) closeModal(); });
$('#menuButton').addEventListener('click', () => $('.sidebar').classList.toggle('open'));
$('#betSearch').addEventListener('input', renderBetsTable);
$('#betFilters').addEventListener('click', event => { if (!event.target.dataset.filter) return; activeFilter=event.target.dataset.filter; $$('#betFilters button').forEach(b=>b.classList.toggle('active',b===event.target)); renderBetsTable(); });
$('#resultPicker').addEventListener('click', event => { if (!event.target.dataset.outcome) return; setOutcome($('#betOutcome').value === event.target.dataset.outcome ? 'pending' : event.target.dataset.outcome); });
$('#addOutcome').addEventListener('click', () => addOutcome());
$('#addDevigOutcome').addEventListener('click', () => addDevigOutcome());
window.addEventListener('hashchange', route);
window.addEventListener('resize', () => {
  const chartPageVisible = !$('#dashboardPage').classList.contains('hidden') || !$('#performancePage').classList.contains('hidden');
  if (chartPageVisible) renderChart();
});
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });

$('#todayLabel').textContent = new Date().toLocaleDateString('en-CA', { weekday:'long', month:'long', day:'numeric' }).toUpperCase();
addOutcome('Side A', '', ''); addOutcome('Side B', '', '');
addDevigOutcome('Side A', '', ''); addDevigOutcome('Side B', '', '');
populateTimeSelectors();
route();
loadBets().catch(error => { renderAll(); showToast(`Database unavailable: ${error.message}`); });
