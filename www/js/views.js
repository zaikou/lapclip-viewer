const Views = {
  // HTML escape utility function
  _escape(text) {
    if (typeof text !== 'string') return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
    };
    return text.replace(/[&<>"']/g, c => map[c]);
  },

  renderEvents(events) {
    const el = document.getElementById('event-list');
    el.innerHTML = events.map(e => `
      <div class="event-card" data-evt="${this._escape(String(e.evtId))}">
        <div class="date">${this._escape(e.date)}</div>
        <div class="name">${this._escape(e.name)}</div>
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
      el.innerHTML = result.categories.map(c => `<button class="cat-btn" data-ctg="${this._escape(String(c.ctgId))}">${this._escape(c.name)}</button>`).join('');
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
      div.textContent = `No.${rider.number} ${this._escape(rider.name)}`;
      list.appendChild(div);
      list.scrollTop = list.scrollHeight;
    }
  },

  renderTiming(data, categoryName) {
    document.getElementById('timing-title').textContent = categoryName;
    const hasLapData = data.totalLaps > 0;
    // Show/hide tabs based on whether lap data exists
    ['tab-overall-ct','tab-chart'].forEach(id => {
      document.querySelector(`.tab-btn[data-tab="${id}"]`).style.display = hasLapData ? '' : 'none';
    });
    if (!hasLapData) {
      // No lap data: show only overall tab
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      document.querySelector('.tab-btn[data-tab="tab-overall"]')?.classList.add('active');
      document.getElementById('tab-overall')?.classList.add('active');
    }
    this.renderOverallTab(data);
    this.renderOverallCTTab(data);
    this.renderChartTab(data);
  },

  _resolveEntry(entry) {
    return entry.rider || entry;
  },

  renderOverallTab(data) {
    const el = document.getElementById('tab-overall');
    const sortLap = window._overallSortLap || 0;
    const tp = data.timingPoints || [];
    let rankings;
    if (sortLap > 0 && tp.includes(sortLap)) {
      rankings = data.getCumulativeRankings(sortLap);
    } else {
      rankings = data.getOverallRankings();
    }
    let html = '<table><thead><tr><th class="th-sort" data-sort="0">Pos</th><th>No.</th><th>名前</th>';
    tp.forEach(pos => {
      const active = sortLap === pos ? ' sort-active' : '';
      const label = data.timingPointLabels?.[pos] || String(pos);
      html += `<th class="th-sort${active}" data-sort="${pos}">L${this._escape(label)}</th>`;
    });
    html += '<th class="th-sort" data-sort="0">Total</th><th>Best</th><th>Gap</th></tr></thead><tbody>';
    const topEntry = rankings[0];
    const topRider = topEntry ? this._resolveEntry(topEntry) : null;
    const topTotalSec = topRider ? Parser.parseTimeToSeconds(topRider.totalTime) : 0;
    rankings.forEach(entry => {
      const rider = this._resolveEntry(entry);
      const laps = data.riderLapMap[rider.number] || [];
      html += `<tr><td class="pos">${entry.position}</td><td class="num">${rider.number}</td><td class="name-cell">${this._escape(rider.name)}</td>`;
      tp.forEach(pos => {
        const l = laps.find(x => x.lapPosition === pos);
        let cls = '', txt = '-';
        if (l && isFinite(l.lapTimeSec)) {
          txt = Parser.secondsToLapTime(l.lapTimeSec);
          if (l.lapTimeSec === (data.timingPointBest?.[pos] ?? data.overallBest)) cls = 'tp-best';
          else if (l.lapTimeSec === data.personalBestMap[rider.number]) cls = 'pb-best';
          else cls = 'slower';
        }
        html += `<td class="time-cell td-lap ${cls}">${txt}</td>`;
      });
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
        const lap = parseFloat(th.dataset.sort);
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
    const tp = data.timingPoints || [];
    let rankings;
    if (sortLap > 0 && tp.includes(sortLap)) {
      rankings = data.getCumulativeRankings(sortLap);
    } else {
      rankings = data.getOverallRankings();
    }
    let html = '<table><thead><tr><th class="th-sort" data-sort="0">Pos</th><th>No.</th><th>名前</th>';
    tp.forEach(pos => {
      const active = sortLap === pos ? ' sort-active' : '';
      const label = data.timingPointLabels?.[pos] || String(pos);
      html += `<th class="th-sort${active}" data-sort="${pos}">CT${this._escape(label)}</th>`;
    });
    html += '<th class="th-sort" data-sort="0">Total</th><th>Gap</th></tr></thead><tbody>';
    const topEntry = rankings[0];
    const topRider = topEntry ? this._resolveEntry(topEntry) : null;
    const topTotalSec = topRider ? Parser.parseTimeToSeconds(topRider.totalTime) : 0;
    rankings.forEach(entry => {
      const rider = this._resolveEntry(entry);
      const laps = data.riderLapMap[rider.number] || [];
      html += `<tr><td class="pos">${entry.position}</td><td class="num">${rider.number}</td><td class="name-cell">${this._escape(rider.name)}</td>`;
      tp.forEach(pos => {
        const l = laps.find(x => x.lapPosition === pos);
        let txt = '-', cls = '';
        if (l && isFinite(l.totalTimeSec)) {
          txt = Parser.secondsToTime(l.totalTimeSec);
          if (isFinite(l.lapTimeSec) && l.lapTimeSec === (data.timingPointBest?.[pos] ?? data.overallBest)) cls = 'tp-best';
          else if (isFinite(l.lapTimeSec) && l.lapTimeSec === data.personalBestMap[rider.number]) cls = 'pb-best';
          else if (isFinite(l.lapTimeSec)) cls = 'slower';
        }
        html += `<td class="time-cell ${cls}">${txt}</td>`;
      });
      const totalSec = Parser.parseTimeToSeconds(rider.totalTime);
      html += `<td class="time-cell">${rider.totalTime}</td>
        <td class="gap-cell">${Parser.formatGap(totalSec - topTotalSec)}</td></tr>`;
    });
    html += '</tbody></table>';
    el.innerHTML = html;
    el.querySelectorAll('.th-sort').forEach(th => {
      th.addEventListener('click', () => {
        const lap = parseFloat(th.dataset.sort);
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
      window.chartInstance.setData(data);
      window.chartInstance.draw();
    }
  }
};
