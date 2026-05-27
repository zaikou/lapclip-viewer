const Scraper = {
  BASE: 'https://matrix-sports.jp/lap',
  CONCURRENCY: 6,
  _abort: false,
  _cache: {},

  abort() { this._abort = true; },
  resetAbort() { this._abort = false; },

  async _nativeFetch(url) {
    if (window.Capacitor?.isNativePlatform?.()) {
      try {
        const res = await CapacitorHttp.request({ url, method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36' }, connectTimeout: 10000, readTimeout: 15000 });
        return res.data;
      } catch (e) {
        if (typeof CapacitorHttp === 'undefined') throw e;
      }
    }
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  },

  async fetchUrl(url) {
    if (this._cache[url]) return this._cache[url];
    if (this._abort) throw new Error('aborted');
    const html = await this._nativeFetch(url);
    this._cache[url] = html;
    return html;
  },

  clearCache() { this._cache = {}; },

  async fetchEvents(year) {
    const url = year === 2026 ? `${this.BASE}/index.php` : `${this.BASE}/${year}/`;
    let html;
    try { html = await this.fetchUrl(url); } catch (e) { return []; }
    let events = Parser.parseEventList(html);
    let page = 2;
    while (true) {
      const nextUrl = `${this.BASE}/nextevents.php?year=${year}&page=${page}`;
      let nextHtml;
      try { nextHtml = await this.fetchUrl(nextUrl); } catch { break; }
      const nextEvents = Parser.parseEventList(nextHtml);
      if (nextEvents.length === 0) break;
      events = events.concat(nextEvents);
      page++;
    }
    return events;
  },

  async fetchCategories(evtId) {
    const url = `${this.BASE}/result.php?evt=${evtId}`;
    let html;
    try { html = await this.fetchUrl(url); } catch { return []; }
    const title = Parser.parseEventTitle(html);
    const cats = Parser.parseCategories(html);
    return { title, categories: cats };
  },

  async fetchAllRiders(evtId, ctgId) {
    const url = `${this.BASE}/result.php?evt=${evtId}&ctg=${ctgId}`;
    let html;
    try { html = await this.fetchUrl(url); } catch { return []; }
    let riders = Parser.parseRiders(html);
    let page = 2;
    while (true) {
      const nextUrl = `${this.BASE}/nextresults.php?evt=${evtId}&ctg=${ctgId}&page=${page}`;
      let nextHtml;
      try { nextHtml = await this.fetchUrl(nextUrl); } catch { break; }
      if (!Parser.hasMoreResults(nextHtml)) break;
      const nextRiders = Parser.parseRiders(nextHtml);
      if (nextRiders.length === 0) break;
      riders = riders.concat(nextRiders);
      page++;
    }
    return riders;
  },

  async fetchLapData(evtId, ctgId, num) {
    const url = `${this.BASE}/laptimes.php?evt=${evtId}&ctg=${ctgId}&num=${num}`;
    let html;
    try { html = await this.fetchUrl(url); } catch { return []; }
    const laps = Parser.parseLapData(html);
    const team = Parser.parseRiderTeamName(html);
    return { laps, team };
  },

  async fetchAllLapData(evtId, ctgId, riders, onProgress) {
    this._abort = false;
    const map = {};
    let completed = 0;
    const total = riders.length;
    const queue = [...riders];
    const worker = async () => {
      while (queue.length > 0 && !this._abort) {
        const rider = queue.shift();
        try {
          const result = await this.fetchLapData(evtId, ctgId, rider.number);
          map[rider.number] = result.laps || [];
          rider.team = result.team || rider.team || '';
        } catch (e) {
          map[rider.number] = [];
        }
        completed++;
        if (onProgress) onProgress(completed, total, rider);
      }
    };
    const workers = Array(Math.min(this.CONCURRENCY, total)).fill().map(() => worker());
    await Promise.all(workers);
    return map;
  }
};
