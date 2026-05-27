const Views = {
  renderEvents(events) {
    const el = document.getElementById('event-list');
    el.innerHTML = events.map(e => `
      <div class="event-card" data-evt="${e.evtId}">
        <div class="date">${e.date}</div>
        <div class="name">${e.name}</div>
      </div>
    `).join('');
    el.querySelectorAll('.event-card').forEach(card => {
      card.addEventListener('click', () => {
        AppState.selectedEvt = card.dataset.evt;
        goToCategories(AppState.selectedEvt);
      });
    });
  },

  async loadCategories(evtId) {
    const el = document.getElementById('category-grid');
    const titleEl = document.getElementById('category-title');
    el.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:20px;">読み込み中...</p>';
    try {
      const result = await Scraper.fetchCategories(evtId);
      titleEl.textContent = result.title || 'カテゴリ選択';
      if (result.categories.length === 0) { el.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:20px;">カテゴリが見つかりません</p>'; return; }
      el.innerHTML = result.categories.map(c => `<button class="cat-btn" data-ctg="${c.ctgId}">${c.name}</button>`).join('');
      el.querySelectorAll('.cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          AppState.selectedCtg = btn.dataset.ctg;
          AppState.ctgName = btn.textContent;
          startDataLoad(evtId, btn.dataset.ctg, btn.textContent);
        });
      });
    } catch (e) {
      el.innerHTML = '<p style="text-align:center;color:var(--accent-red);padding:20px;">読み込みエラー</p>';
    }
  },

  renderProgress(completed, total, rider) {
    const pct = total > 0 ? Math.round(completed / total * 100) : 0;
    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('progress-text').textContent = `${completed} / ${total} 選手`;
    const list = document.getElementById('progress-list');
    if (rider && list.children.length < 200) {
      const div = document.createElement('div');
      div.className = 'progress-item done';
      div.textContent = `No.${rider.number} ${rider.name}`;
      list.appendChild(div);
      list.scrollTop = list.scrollHeight;
    }
  },

  renderTiming(data, categoryName) {
    document.getElementById('timing-title').textContent = categoryName;
    const hasLapData = data.totalLaps > 0;
    // Show/hide tabs based on whether lap data exists
    document.querySelectorAll('.tab-btn').forEach((btn, i) => {
      btn.style.display = (!hasLapData && (i === 0 || i === 1 || i === 3 || i === 4)) ? 'none' : '';
    });
    if (!hasLapData) {
      // No lap data: show only overall tab
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      document.querySelector('.tab-btn[data-tab="tab-overall"]')?.classList.add('active');
      document.getElementById('tab-overall')?.classList.add('active');
    }
    this.renderLapTab(data);
    this.renderCumulativeTab(data);
    this.renderOverallTab(data);
    this.renderOverallCTTab(data);
    this.renderChartTab(data);
  },

  renderLapTab(data) {
    const el = document.getElementById('tab-lap');
    let html = '';
    for (let lap = 1; lap <= data.totalLaps; lap++) {
      const rankings = data.getLapRankings(lap);
      if (rankings.length === 0) continue;
      const isOpen = lap <= 3;
      html += `<div class="lap-group">
        <div class="lap-group-header ${isOpen?'open':''}" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('open')">
          <span>Lap ${lap}</span>
          <span class="arrow">&#x25B6;</span>
        </div>
        <div class="lap-group-body ${isOpen?'open':''}">
          <table><thead><tr><th>Pos</th><th>No.</th><th>名前</th><th>Lap</th><th>Gap</th></tr></thead><tbody>`;
      rankings.forEach(r => {
        let cls = '';
        if (r.isOverallBest) cls = 'overall-best';
        else if (r.isPersonalBest) cls = 'personal-best';
        html += `<tr class="${cls}"><td class="pos">${r.position}</td><td class="num">${r.rider.number}</td>
          <td class="name-cell">${r.rider.name}</td>
          <td class="time-cell td-lap">${Parser.secondsToLapTime(r.lap.lapTimeSec)}</td>
          <td class="gap-cell">${Parser.formatGap(r.gap)}</td></tr>`;
      });
      html += '</tbody></table></div></div>';
    }
    el.innerHTML = html;
  },

  renderCumulativeTab(data) {
    const el = document.getElementById('tab-cumulative');
    let html = '';
    for (let lap = 1; lap <= data.totalLaps; lap++) {
      const rankings = data.getCumulativeRankings(lap);
      if (rankings.length === 0) continue;
      const isOpen = lap <= 3;
      html += `<div class="lap-group">
        <div class="lap-group-header ${isOpen?'open':''}" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('open')">
          <span>After Lap ${lap}</span>
          <span class="arrow">&#x25B6;</span>
        </div>
        <div class="lap-group-body ${isOpen?'open':''}">
          <table><thead><tr><th>Pos</th><th>No.</th><th>名前</th><th>Total</th><th>Gap</th></tr></thead><tbody>`;
      rankings.forEach(r => {
        html += `<tr><td class="pos">${r.position}</td><td class="num">${r.rider.number}</td>
          <td class="name-cell">${r.rider.name}</td>
          <td class="time-cell">${Parser.secondsToTime(r.lap.totalTimeSec)}</td>
          <td class="gap-cell">${Parser.formatGap(r.gap)}</td></tr>`;
      });
      html += '</tbody></table></div></div>';
    }
    el.innerHTML = html;
  },

  _resolveEntry(entry) {
    return entry.rider || entry;
  },

  renderOverallTab(data) {
    const el = document.getElementById('tab-overall');
    const sortLap = window._overallSortLap || 0;
    let rankings;
    if (sortLap > 0 && sortLap <= data.totalLaps) {
      rankings = data.getCumulativeRankings(sortLap);
    } else {
      rankings = data.getOverallRankings();
    }
    let html = '<table><thead><tr><th class="th-sort" data-sort="0">Pos</th><th>No.</th><th>名前</th>';
    for (let lap = 1; lap <= data.totalLaps; lap++) {
      const active = sortLap === lap ? ' sort-active' : '';
      html += `<th class="th-sort${active}" data-sort="${lap}">L${lap}</th>`;
    }
    html += '<th>Total</th><th>Best</th><th>Gap</th></tr></thead><tbody>';
    const topEntry = rankings[0];
    const topRider = topEntry ? this._resolveEntry(topEntry) : null;
    const topTotalSec = topRider ? Parser.parseTimeToSeconds(topRider.totalTime) : 0;
    rankings.forEach(entry => {
      const rider = this._resolveEntry(entry);
      const laps = data.riderLapMap[rider.number] || [];
      html += `<tr><td class="pos">${entry.position}</td><td class="num">${rider.number}</td><td class="name-cell">${rider.name}</td>`;
      for (let lap = 1; lap <= data.totalLaps; lap++) {
        const l = laps.find(x => x.lapNumber === lap);
        let cls = '', txt = '-';
        if (l && isFinite(l.lapTimeSec)) {
          txt = Parser.secondsToLapTime(l.lapTimeSec);
          if (l.lapTimeSec === data.overallBest) cls = 'overall-best';
          else if (l.lapTimeSec === data.personalBestMap[rider.number]) cls = 'personal-best';
        }
        html += `<td class="time-cell td-lap ${cls}">${txt}</td>`;
      }
      const best = data.personalBestMap[rider.number];
      const totalSec = Parser.parseTimeToSeconds(rider.totalTime);
      html += `<td class="time-cell">${rider.totalTime}</td>
        <td class="time-cell" style="color:${isFinite(best)?'var(--accent-green)':'inherit'}">${isFinite(best)?Parser.secondsToLapTime(best):'-'}</td>
        <td class="gap-cell">${Parser.formatGap(totalSec - topTotalSec)}</td></tr>`;
    });
    html += '</tbody></table>';
    el.innerHTML = html;
    el.querySelectorAll('.th-sort').forEach(th => {
      th.addEventListener('click', () => {
        const lap = parseInt(th.dataset.sort);
        if (window._overallSortLap === lap) {
          window._overallSortLap = 0;
        } else {
          window._overallSortLap = lap;
        }
        this.renderOverallTab(data);
      });
    });
  },

  renderOverallCTTab(data) {
    const el = document.getElementById('tab-overall-ct');
    const sortLap = window._overallCTSortLap || 0;
    let rankings;
    if (sortLap > 0 && sortLap <= data.totalLaps) {
      rankings = data.getCumulativeRankings(sortLap);
    } else {
      rankings = data.getOverallRankings();
    }
    let html = '<table><thead><tr><th class="th-sort" data-sort="0">Pos</th><th>No.</th><th>名前</th>';
    for (let lap = 1; lap <= data.totalLaps; lap++) {
      const active = sortLap === lap ? ' sort-active' : '';
      html += `<th class="th-sort${active}" data-sort="${lap}">CT${lap}</th>`;
    }
    html += '<th class="th-sort" data-sort="0">Total</th><th>Gap</th></tr></thead><tbody>';
    const topEntry = rankings[0];
    const topRider = topEntry ? this._resolveEntry(topEntry) : null;
    const topTotalSec = topRider ? Parser.parseTimeToSeconds(topRider.totalTime) : 0;
    rankings.forEach(entry => {
      const rider = this._resolveEntry(entry);
      const laps = data.riderLapMap[rider.number] || [];
      html += `<tr><td class="pos">${entry.position}</td><td class="num">${rider.number}</td><td class="name-cell">${rider.name}</td>`;
      for (let lap = 1; lap <= data.totalLaps; lap++) {
        const l = laps.find(x => x.lapNumber === lap);
        let txt = '-';
        if (l && isFinite(l.totalTimeSec)) txt = Parser.secondsToTime(l.totalTimeSec);
        html += `<td class="time-cell">${txt}</td>`;
      }
      const totalSec = Parser.parseTimeToSeconds(rider.totalTime);
      html += `<td class="time-cell">${rider.totalTime}</td>
        <td class="gap-cell">${Parser.formatGap(totalSec - topTotalSec)}</td></tr>`;
    });
    html += '</tbody></table>';
    el.innerHTML = html;
    el.querySelectorAll('.th-sort').forEach(th => {
      th.addEventListener('click', () => {
        const lap = parseInt(th.dataset.sort);
        if (window._overallCTSortLap === lap) {
          window._overallCTSortLap = 0;
        } else {
          window._overallCTSortLap = lap;
        }
        this.renderOverallCTTab(data);
      });
    });
  },

  renderChartTab(data) {
    if (window.chartInstance) {
      chartInstance.setData(data);
      chartInstance.draw();
    }
  }
};
