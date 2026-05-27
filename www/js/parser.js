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

  parseRiders(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const riders = [];
    doc.querySelectorAll('.result').forEach(el => {
      const name = el.getAttribute('name');
      if (!name) return;
      const spans = el.querySelectorAll('.nwb, .nw');
      const parts = [];
      spans.forEach(s => parts.push(s.textContent.trim()));
      if (parts.length < 5) return;
      let p = 0;
      const rankRaw = parts[p++];
      const number = parts[p++].replace('No.','');
      const riderName = parts[p++];
      let laps = 0, totalTime, gap;
      if (parts.length >= 6) {
        // With lap count: [rank, no, name, lapCount, totalTime, gap]
        const lapsRaw = parts[p++].replace('周','');
        laps = lapsRaw === '-' ? 0 : parseInt(lapsRaw) || 0;
        totalTime = parts[p++];
        gap = parts[p++];
      } else {
        // Without lap count (single lap): [rank, no, name, totalTime, gap]
        totalTime = parts[p++];
        gap = parts[p++];
        laps = totalTime && totalTime !== '-:--:--.---' ? 1 : 0;
      }
      const isOPN = rankRaw === 'OPN';
      const isDNS = rankRaw === '-';
      const rank = isDNS ? 999 : (isOPN ? -1 : parseInt(rankRaw) || 0);
      riders.push({ number, name: riderName, laps, totalTime, gap, rank, isOPN, isDNS });
    });
    return riders;
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
    rows.forEach(tr => {
      const tds = tr.querySelectorAll('td');
      if (tds.length < 3) return;
      if (hasRankCol && tds.length < 4) return;
      let idx = 0;
      const lapNum = parseInt(tds[idx++].textContent.trim());
      if (isNaN(lapNum)) return;
      const rank = hasRankCol ? parseInt(tds[idx++].textContent.trim()) || 0 : 0;
      const lapTime = tds[idx++].textContent.trim();
      const totalTime = tds[idx].textContent.trim();
      laps.push({ lapNumber: lapNum, lapRank: rank, lapTime, totalTime, lapTimeSec: this.parseTimeToSeconds(lapTime), totalTimeSec: this.parseTimeToSeconds(totalTime) });
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
