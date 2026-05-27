const Parser = {
  parseEventList(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const events = [];
    doc.querySelectorAll('.event').forEach(el => {
      const a = el.querySelector('a');
      if (!a) return;
      const href = a.getAttribute('href') || '';
      const m = href.match(/evt=([^&]+)/);
      if (!m) return;
      const dayEl = el.querySelector('.day span');
      const nameEl = el.querySelector('.event-name');
      events.push({
        evtId: m[1],
        name: nameEl ? nameEl.textContent.trim() : '',
        date: dayEl ? dayEl.textContent.trim() : '',
      });
    });
    return events;
  },

  parseCategories(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const cats = [];
    doc.querySelectorAll('#acMenu dd a').forEach(a => {
      const href = a.getAttribute('href') || '';
      const m = href.match(/ctg=(\d+)/);
      if (!m) return;
      cats.push({
        ctgId: m[1],
        name: a.textContent.trim(),
      });
    });
    return cats;
  },

  parseEventTitle(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const h2 = doc.querySelector('.title h2 span');
    return h2 ? h2.textContent.trim() : '';
  },

  _categorizeSpan(text) {
    if (!text) return null;
    if (text === 'OPN' || text === '-' || /^\d+位$/.test(text)) return 'rank';
    if (text.startsWith('No.')) return 'number';
    if (text.endsWith('周') || text === 'FINISH') return 'laps';
    if (/^\d+(:\d+){2}\.\d+$/.test(text) || text === '-:--:--.--') return 'time';
    if (text.startsWith('+Top') || /^\+/.test(text)) return 'gap';
    if (/^\d+(\.\d+)?分$/.test(text)) return 'gap'; // e.g., "+1分" (gap shown as minutes)
    return 'name';
  },

  parseRiders(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const riders = [];
    doc.querySelectorAll('.result').forEach(el => {
      const name = el.getAttribute('name');
      if (!name) return;
      const spans = el.querySelectorAll('.nwb, .nw');
      let number, riderName, laps = 0, totalTime, gap, rankRaw;

      if (spans.length > 0) {
        spans.forEach(s => {
          const text = s.textContent.trim();
          if (!text) return;
          const cat = this._categorizeSpan(text);
          if (cat === 'rank') rankRaw = text;
          else if (cat === 'number') number = text.replace('No.','');
          else if (cat === 'laps') laps = this._parseLapCount(text);
          else if (cat === 'time') totalTime = text;
          else if (cat === 'gap') gap = text;
          else if (cat === 'name' && !riderName) riderName = text;
        });
      } else {
        // Flat text (hill climb / single-lap format)
        const lines = el.textContent.split('\n').map(s => s.trim()).filter(s => s);
        for (const line of lines) {
          const cat = this._categorizeSpan(line);
          if (cat === 'rank') rankRaw = line;
          else if (cat === 'number') number = line.replace('No.','');
          else if (cat === 'laps') laps = this._parseLapCount(line);
          else if (cat === 'time') totalTime = line;
          else if (cat === 'gap') gap = line;
          else if (cat === 'name' && !riderName) riderName = line;
        }
      }

      if (!number) return;
      // Single-lap race: if no lap count span was found but rider has a time, set laps=1
      if (laps === 0 && totalTime && totalTime !== '-:--:--.--') laps = 1;

      const isOPN = rankRaw === 'OPN';
      const isDNS = rankRaw === '-';
      const rank = isDNS ? 999 : (isOPN ? -1 : parseInt(rankRaw) || 0);
      riders.push({ number, name: riderName || '', laps, totalTime, gap, rank, isOPN, isDNS });
    });
    return riders;
  },

  _parseLapCount(text) {
    if (text === 'FINISH') return -1; // sentinel: completed, actual count from lap data
    const s = text.replace('周','').trim();
    if (s === '-' || s === '0') return 0;
    if (s.includes('/')) {
      // Fractional lap: "1/3" → 1/3 ≈ 0.333
      const parts = s.split('/').map(p => parseFloat(p.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[1] > 0) {
        return parseFloat((parts[0] / parts[1]).toFixed(3));
      }
    }
    return parseInt(s) || 0;
  },

  parseNextResultsUrl(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const script = doc.querySelector('script');
    if (!script) return null;
    const m = script.textContent.match(/path\s*:\s*\["([^"]+)"/);
    return m ? m[1] : null;
  },

  hasMoreResults(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.querySelectorAll('.result').length > 0;
  },

  parseLapData(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const rows = doc.querySelectorAll('table tr');
    const laps = [];
    const headerCells = doc.querySelectorAll('table th');
    let hasRankCol = false;
    headerCells.forEach(th => { if (th.textContent.includes('順位')) hasRankCol = true; });
    let lapIndex = 0;
    rows.forEach(tr => {
      const tds = tr.querySelectorAll('td');
      if (tds.length < 3) return;
      if (hasRankCol && tds.length < 4) return;
      let idx = 0;
      const rawCell = tds[idx++].textContent.trim();
      if (!rawCell) return;
      let lapNumber;
      if (rawCell === 'FINISH') {
        lapNumber = lapIndex + 1;
      } else {
        // Parse "1/3周", "1周", etc.
        const m = rawCell.match(/(\d+)/);
        if (!m) return;
        lapNumber = parseInt(m[1]);
      }
      lapIndex++;
      const rank = hasRankCol ? parseInt(tds[idx++].textContent.trim()) || 0 : 0;
      const lapTime = tds[idx++].textContent.trim();
      const totalTime = tds[idx].textContent.trim();
      laps.push({ lapNumber, lapRank: rank, lapTime, totalTime, lapTimeSec: this.parseTimeToSeconds(lapTime), totalTimeSec: this.parseTimeToSeconds(totalTime) });
    });
    return laps;
  },

  parseRiderTeamName(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const el = doc.querySelector('.result-box .content .row .nwb');
    const spans = doc.querySelectorAll('.result-box .content .row .nw');
    let team = '';
    spans.forEach(s => {
      const txt = s.textContent.trim();
      if (txt && !txt.includes('周') && !txt.startsWith('0:') && !txt.startsWith('+Top') && !txt.startsWith('-')) {
        team = txt;
      }
    });
    return team;
  },

  parseTimeToSeconds(t) {
    if (!t || t === '-:--:--.---') return Infinity;
    t = t.replace(',', '.');
    const parts = t.split(':');
    if (parts.length === 3) return parseInt(parts[0])*3600 + parseInt(parts[1])*60 + parseFloat(parts[2]);
    if (parts.length === 2) return parseInt(parts[0])*60 + parseFloat(parts[1]);
    return parseFloat(parts[0]) || Infinity;
  },

  secondsToTime(sec) {
    if (!isFinite(sec)) return '-:--';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${s.toFixed(3).padStart(6,'0')}`;
    return `${m}:${s.toFixed(3).padStart(6,'0')}`;
  },

  secondsToLapTime(sec) {
    if (!isFinite(sec)) return '-:--.---';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toFixed(3).padStart(6,'0')}`;
  },

  formatGap(sec) {
    if (!isFinite(sec) || sec === 0) return '–';
    if (sec < 0) return `-${this.secondsToLapTime(Math.abs(sec))}`;
    return `+${this.secondsToLapTime(sec)}`;
  }
};
