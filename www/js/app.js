const AppState = {
  selectedEvt: null, selectedCtg: null, ctgName: '',
  currentData: null, currentRiders: null, currentLapDataMap: null,
  screenStack: ['splash'],
};

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function goBack() {
  const prev = AppState.screenStack[AppState.screenStack.length - 2] || 'screen-event';
  showScreen(prev);
}

function loadEvents(year) {
  const list = document.getElementById('event-list');
  list.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:20px;">読み込み中...</p>';
  Scraper.fetchEvents(year).then(events => {
    if (events.length === 0) { list.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:20px;">イベントが見つかりません</p>'; return; }
    Views.renderEvents(events);
  }).catch(() => {
    list.innerHTML = '<p style="text-align:center;color:var(--accent-red);padding:20px;">読み込みエラー<br>端末で再度お試しください</p>';
  });
}

async function startDataLoad(evtId, ctgId, ctgName) {
  showScreen('screen-loading');
  Scraper.resetAbort();
  document.getElementById('progress-list').innerHTML = '';
  try {
    const riders = await Scraper.fetchAllRiders(evtId, ctgId);
    if (riders.length === 0) { document.getElementById('progress-text').textContent = '選手が見つかりません'; return; }
    const lapDataMap = await Scraper.fetchAllLapData(evtId, ctgId, riders, (c, t, r) => Views.renderProgress(c, t, r));
    const data = Processor.process(riders, lapDataMap);
    AppState.currentData = data; AppState.currentRiders = riders; AppState.currentLapDataMap = lapDataMap;
    showScreen('screen-timing');
    Views.renderTiming(data, ctgName);
  } catch (e) {
    if (e.message === 'aborted') return;
    document.getElementById('progress-text').textContent = 'エラーが発生しました: ' + e.message;
  }
}

function refreshData() {
  if (!AppState.selectedEvt || !AppState.selectedCtg) return;
  startDataLoad(AppState.selectedEvt, AppState.selectedCtg, AppState.ctgName);
}

function chartFilter() {
  const q = document.getElementById('chart-search').value.trim();
  if (!q || !AppState.currentData || !chartInstance) return;
  const rider = AppState.currentData.riders.find(r => r.name.includes(q) || r.number === q);
  if (rider) { chartInstance.addRider(rider.number); document.getElementById('chart-search').value = ''; }
}

function loadYearsAndEvents() {
  const tabs = document.getElementById('year-tabs');
  const years = [2026, 2025, 2024, 2023];
  tabs.innerHTML = years.map(y => `<button data-year="${y}" class="${y===2026?'active':''}">${y}</button>`).join('');
  tabs.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadEvents(parseInt(btn.dataset.year));
    });
  });
  loadEvents(2026);
}

function setupNavigation() {
  document.getElementById('tab-nav').querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'tab-chart' && chartInstance && AppState.currentData) {
        setTimeout(() => { chartInstance.setData(AppState.currentData); chartInstance.draw(); }, 100);
      }
    });
  });

  document.addEventListener('click', (e) => {
    const row = e.target.closest('tr');
    if (!row || !chartInstance || !AppState.currentData) return;
    const numCell = row.querySelector('.num');
    if (!numCell) return;
    const no = numCell.textContent.trim();
    if (AppState.currentData.riders.some(r => r.number === no)) {
      document.querySelector('.tab-btn[data-tab="tab-chart"]')?.click();
      chartInstance.toggleRider(no);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadYearsAndEvents();
  setupNavigation();
  setTimeout(() => {
    showScreen('screen-event');
    AppState.screenStack = ['screen-event'];
  }, 1200);
});
