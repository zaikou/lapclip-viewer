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
        const evtId = card.dataset.evt;
        AppState.selectedEvt = evtId;
        showScreen('screen-category');
        Views.loadCategories(evtId);
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
    this.renderLapTab(data);
    this.renderCumulativeTab(data);
    this.renderOverallTab(data);
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

  renderOverallTab(data) {
    const el = document.getElementById('tab-overall');
    const rankings = data.getOverallRankings();
    let html = '<table><thead><tr><th>Pos</th><th>No.</th><th>名前</th>';
    for (let lap = 1; lap <= data.totalLaps; lap++) html += `<th>L${lap}</th>`;
    html += '<th>Total</th><th>Best</th><th>Gap</th></tr></thead><tbody>';
    rankings.forEach(r => {
      const laps = data.riderLapMap[r.number] || [];
      html += `<tr><td class="pos">${r.position}</td><td class="num">${r.number}</td><td class="name-cell">${r.name}</td>`;
      for (let lap = 1; lap <= data.totalLaps; lap++) {
        const l = laps.find(x => x.lapNumber === lap);
        let cls = '', txt = '-';
        if (l && isFinite(l.lapTimeSec)) {
          txt = Parser.secondsToLapTime(l.lapTimeSec);
          if (l.lapTimeSec === data.overallBest) cls = 'overall-best';
          else if (l.lapTimeSec === data.personalBestMap[r.number]) cls = 'personal-best';
        }
        html += `<td class="time-cell td-lap ${cls}">${txt}</td>`;
      }
      const best = data.personalBestMap[r.number];
      const totalSec = Parser.parseTimeToSeconds(r.totalTime);
      const topSec = Parser.parseTimeToSeconds(rankings[0].totalTime);
      html += `<td class="time-cell">${r.totalTime}</td>
        <td class="time-cell" style="color:${isFinite(best)?'var(--accent-green)':'inherit'}">${isFinite(best)?Parser.secondsToLapTime(best):'-'}</td>
        <td class="gap-cell">${Parser.formatGap(totalSec - topSec)}</td></tr>`;
    });
    html += '</tbody></table>';
    el.innerHTML = html;
  },

  renderChartTab(data) {
    if (window.chartInstance) {
      chartInstance.setData(data);
      chartInstance.draw();
    }
  }
};
