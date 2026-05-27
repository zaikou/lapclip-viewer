const Scraper = {
  BASE: 'https://matrix-sports.jp/lap',
  CONCURRENCY: 6,
  _abort: false,
  _cache: {},

  abort() { this._abort = true; },
  resetAbort() { this._abort = false; },
  clearCache() { this._cache = {}; },

  async fetchUrl(url) {
    if (this._cache[url]) return this._cache[url];
    if (this._abort) throw new Error('aborted');

    const ua = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36';

    // Try Capacitor native HTTP via Plugins API (canonical Capacitor 8 way)
    try {
      if (window.Capacitor?.Plugins?.CapacitorHttp) {
        const res = await Capacitor.Plugins.CapacitorHttp.request({
          url, method: 'GET',
          headers: { 'User-Agent': ua },
          connectTimeout: 15000,
          readTimeout: 30000,
        });
        if (res && res.data) {
          this._cache[url] = res.data;
          return res.data;
        }
      }
    } catch (e) { console.warn('[scraper] CapacitorHttp plugin failed:', e.message || e); }

    // Try global CapacitorHttp (also Capacitor 8)
    try {
      if (typeof CapacitorHttp !== 'undefined') {
        const res = await CapacitorHttp.request({
          url, method: 'GET',
          headers: { 'User-Agent': ua },
          connectTimeout: 15000,
          readTimeout: 30000,
        });
        if (res && res.data) {
          this._cache[url] = res.data;
          return res.data;
        }
      }
    } catch (e) { console.warn('[scraper] CapacitorHttp global failed:', e.message || e); }

    // Fallback: plain fetch() (works in browser dev, may fail on Android due to CORS)
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': ua },
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      this._cache[url] = text;
      return text;
    } catch (e) {
      console.error('[scraper] All HTTP methods failed for', url, e.message || e);
      throw new Error('Failed to fetch: ' + url + ' (' + (e.message || e) + ')');
    }
  },

  async fetchEvents(year) {
    // Year-specific index pages: /lap/index.php (2026) or /lap/2025 etc.
    const url = year === 2026 ? `${this.BASE}/index.php` : `${this.BASE}/${year}`;
    let html;
    try { html = await this.fetchUrl(url); } catch { return []; }
    let events = Parser.parseEventList(html);
    // Load more events for the selected year via infinite scroll
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
    // Remove duplicates by evtId
    const seen = new Set();
    events = events.filter(e => {
      if (seen.has(e.evtId)) return false;
      seen.add(e.evtId);
      return true;
    });
    return events;
  },

  async fetchCategories(evtId) {
    const url = `${this.BASE}/result.php?evt=${evtId}`;
    let html;
    try { html = await this.fetchUrl(url); } catch { return { title: '', categories: [] }; }
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
    try { html = await this.fetchUrl(url); } catch { return { laps: [], team: '' }; }
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
