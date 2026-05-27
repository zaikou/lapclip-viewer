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
  AppState.screenStack.pop();
  const prev = AppState.screenStack[AppState.screenStack.length - 1] || 'screen-event';
  showScreen(prev);
  // Scraper.abort() to cancel any in-flight requests
  Scraper.abort();
}

function loadEvents(year) {
  const list = document.getElementById('event-list');
  list.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:20px;">読み込み中...</p>';
  Scraper.fetchEvents(year).then(events => {
    if (events.length === 0) { list.innerHTML = '<p style="text-align:center;color:var(--accent-yellow);padding:20px;">イベントが見つかりません<br><span style="font-size:0.8rem;color:var(--text-muted)">通信エラーか、サーバーに接続できません</span></p>'; return; }
    Views.renderEvents(events);
  }).catch(e => {
    list.innerHTML = '<p style="text-align:center;color:var(--accent-red);padding:20px;">読み込みエラー<br><span style="font-size:0.8rem;">' + (e.message || '') + '</span></p>';
  });
}

async function startDataLoad(evtId, ctgId, ctgName) {
  Scraper.resetAbort();
  AppState.screenStack.push('screen-loading');
  showScreen('screen-loading');
  document.getElementById('progress-list').innerHTML = '';
  try {
    const riders = await Scraper.fetchAllRiders(evtId, ctgId);
    if (Scraper._abort) return;
    if (riders.length === 0) { document.getElementById('progress-text').textContent = '選手が見つかりません'; goBack(); return; }
    const lapDataMap = await Scraper.fetchAllLapData(evtId, ctgId, riders, (c, t, r) => Views.renderProgress(c, t, r));
    if (Scraper._abort) return;
    const data = Processor.process(riders, lapDataMap);
    AppState.currentData = data; AppState.currentRiders = riders; AppState.currentLapDataMap = lapDataMap;
    // Remove loading from stack before pushing timing
    if (AppState.screenStack[AppState.screenStack.length - 1] === 'screen-loading') AppState.screenStack.pop();
    AppState.screenStack.push('screen-timing');
    showScreen('screen-timing');
    Views.renderTiming(data, ctgName);
  } catch (e) {
    if (e.message === 'aborted') return;
    document.getElementById('progress-text').textContent = 'エラーが発生しました: ' + e.message;
  }
}

function loadURL() {
  const raw = document.getElementById('url-input').value.trim();
  if (!raw) return;
  const qs = raw.includes('?') ? raw.split('?')[1] : raw;
  const params = new URLSearchParams(qs);
  const evt = params.get('evt');
  if (!evt) { document.getElementById('url-input').placeholder = 'evtパラメータが見つかりません'; return; }
  document.getElementById('url-input').value = '';
  AppState.selectedEvt = evt;
  if (params.has('ctg')) {
    AppState.selectedCtg = params.get('ctg');
    AppState.ctgName = params.get('ctg');
    startDataLoad(evt, AppState.selectedCtg, AppState.ctgName);
  } else {
    goToCategories(evt);
  }
}

async function goToCategories(evtId) {
  AppState.screenStack.push('screen-category');
  showScreen('screen-category');
  await Views.loadCategories(evtId);
}

function refreshData() {
  if (!AppState.selectedEvt || !AppState.selectedCtg) return;
  window._overallSortLap = 0;
  window._overallCTSortLap = 0;
  Scraper.clearCache();
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

function waitForCapacitor() {
  return new Promise(resolve => {
    if (window.Capacitor && (window.Capacitor.isNativePlatform?.() || window.Capacitor.Plugins?.CapacitorHttp)) {
      resolve();
    } else {
      // Capacitor may inject bridge after page load; poll up to 5s
      let tries = 0;
      const check = setInterval(() => {
        tries++;
        if (window.Capacitor && (window.Capacitor.isNativePlatform?.() || window.Capacitor.Plugins?.CapacitorHttp)) {
          clearInterval(check);
          resolve();
        } else if (tries > 50) {
          clearInterval(check);
          console.warn('[app] Capacitor bridge not detected, continuing anyway');
          resolve();
        }
      }, 100);
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await waitForCapacitor();
  console.log('[app] Capacitor ready, platform:', window.Capacitor?.getPlatform?.());
  loadYearsAndEvents();
  setupNavigation();
  setTimeout(() => {
    showScreen('screen-event');
    AppState.screenStack = ['screen-event'];
  }, 800);
});
