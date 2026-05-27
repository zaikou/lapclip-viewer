class LapChart {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.data = null;
    this.selectedRiders = [];
    this.COLORS = ['#42a5f5','#ef5350','#66bb6a','#ffd740','#ab47bc','#26c6da','#ff7043','#78909c','#ec407a','#7e57c2'];
    this.dpr = window.devicePixelRatio || 1;
    this.zoom = { xMin: 0, xMax: 0, yMin: 0, yMax: 0 };
    this._touchStart = null;
    this._pinchStart = null;
    this._setupEvents();
  }

  _setupEvents() {
    const c = this.canvas;
    c.addEventListener('wheel', e => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1.15 : 0.87;
      const rect = c.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width;
      const my = (e.clientY - rect.top) / rect.height;
      this._zoomAt(mx, my, delta);
    }, { passive: false });
    c.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        this._touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, xMin: this.zoom.xMin, xMax: this.zoom.xMax, yMin: this.zoom.yMin, yMax: this.zoom.yMax };
      } else if (e.touches.length === 2) {
        this._pinchStart = { d: this._dist(e.touches), xMin: this.zoom.xMin, xMax: this.zoom.xMax, yMin: this.zoom.yMin, yMax: this.zoom.yMax, mx: 0, my: 0 };
        const rect = c.getBoundingClientRect();
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        this._pinchStart.mx = (cx - rect.left) / rect.width;
        this._pinchStart.my = (cy - rect.top) / rect.height;
      }
    }, { passive: true });
    c.addEventListener('touchmove', e => {
      if (e.touches.length === 1 && this._touchStart) {
        const rect = c.getBoundingClientRect();
        const dx = (e.touches[0].clientX - this._touchStart.x) / rect.width;
        const dy = (e.touches[0].clientY - this._touchStart.y) / rect.height;
        const rangeX = this._touchStart.xMax - this._touchStart.xMin;
        const rangeY = this._touchStart.yMax - this._touchStart.yMin;
        this.zoom.xMin = this._touchStart.xMin - dx * rangeX;
        this.zoom.xMax = this._touchStart.xMax - dx * rangeX;
        this.zoom.yMin = this._touchStart.yMin + dy * rangeY;
        this.zoom.yMax = this._touchStart.yMax + dy * rangeY;
        this.draw();
      } else if (e.touches.length === 2 && this._pinchStart) {
        const d = this._dist(e.touches);
        const scale = this._pinchStart.d / d;
        this._zoomAt(this._pinchStart.mx, this._pinchStart.my, scale);
      }
    }, { passive: true });
    c.addEventListener('touchend', () => { this._touchStart = null; this._pinchStart = null; });
    // Double-tap to reset
    let lastTap = 0;
    c.addEventListener('touchend', e => {
      const now = Date.now();
      if (now - lastTap < 400) { this.resetZoom(); this.draw(); }
      lastTap = now;
    });
  }

  _dist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  _zoomAt(mx, my, factor) {
    const rangeX = this.zoom.xMax - this.zoom.xMin;
    const rangeY = this.zoom.yMax - this.zoom.yMin;
    const cx = this.zoom.xMin + mx * rangeX;
    const cy = this.zoom.yMin + (1 - my) * rangeY;
    const newRangeX = rangeX * factor;
    const newRangeY = rangeY * factor;
    this.zoom.xMin = cx - mx * newRangeX;
    this.zoom.xMax = cx + (1 - mx) * newRangeX;
    this.zoom.yMin = cy - (1 - my) * newRangeY;
    this.zoom.yMax = cy + my * newRangeY;
    this.draw();
  }

  resetZoom() {
    const maxLaps = this.data ? this.data.totalLaps : 0;
    let minTime = 0, maxTime = 1;
    if (this.data) {
      this.selectedRiders.forEach(no => {
        (this.data.riderLapMap[no] || []).forEach(l => {
          if (isFinite(l.totalTimeSec)) { if (l.totalTimeSec < minTime) minTime = l.totalTimeSec; if (l.totalTimeSec > maxTime) maxTime = l.totalTimeSec; }
        });
      });
    }
    const pad = (maxTime - minTime) * 0.15 || 30;
    this.zoom = { xMin: 1, xMax: Math.max(maxLaps, 1), yMin: Math.max(0, minTime - pad), yMax: maxTime + pad };
  }

  setData(data) {
    this.data = data;
  }

  addRider(riderNo) {
    if (!this.selectedRiders.includes(riderNo)) {
      this.selectedRiders.push(riderNo);
      this.resetZoom();
      this.draw();
    }
  }

  removeRider(riderNo) {
    this.selectedRiders = this.selectedRiders.filter(n => n !== riderNo);
    this.resetZoom();
    this.draw();
  }

  toggleRider(riderNo) {
    if (this.selectedRiders.includes(riderNo)) this.removeRider(riderNo);
    else this.addRider(riderNo);
  }

  draw() {
    const canvas = this.canvas;
    const ctx = this.ctx;
    const dpr = this.dpr;
    const rect = canvas.parentElement.getBoundingClientRect();
    const W = rect.width;
    const H = 300;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(dpr, dpr);

    const pad = { top: 20, right: 16, bottom: 36, left: 50 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;

    ctx.clearRect(0, 0, W, H);

    if (!this.data || this.selectedRiders.length === 0) {
      ctx.fillStyle = '#8888aa';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('総合タブの選手をタップしてグラフに追加', W/2, H/2);
      return;
    }

    const riderLapMap = this.data.riderLapMap;
    if (this.zoom.xMin === 0 && this.zoom.xMax === 0) this.resetZoom();

    const z = this.zoom;
    const xDomain = z.xMax - z.xMin || 1;
    const yDomain = z.yMax - z.yMin || 1;

    const xScale = (lap) => pad.left + ((lap - z.xMin) / xDomain) * chartW;
    const yScale = (t) => pad.top + chartH - ((t - z.yMin) / yDomain) * chartH;

    // grid lines (vertical, clipped to visible range)
    ctx.strokeStyle = '#2a2a44';
    ctx.lineWidth = 0.5;
    const lapStart = Math.max(1, Math.ceil(z.xMin));
    const lapEnd = Math.min(this.data.totalLaps, Math.floor(z.xMax));
    for (let lap = lapStart; lap <= lapEnd; lap++) {
      const x = xScale(lap);
      if (x >= pad.left && x <= W - pad.right) {
        ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + chartH); ctx.stroke();
      }
    }
    // y-axis grid + labels
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
      const y = pad.top + (i / ySteps) * chartH;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
      ctx.fillStyle = '#8888aa'; ctx.font = '10px monospace'; ctx.textAlign = 'right';
      const val = z.yMax - (i / ySteps) * yDomain;
      ctx.fillText(Parser.secondsToTime(val), pad.left - 4, y + 3);
    }

    // x-axis labels (visible range)
    ctx.fillStyle = '#8888aa'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    for (let lap = lapStart; lap <= lapEnd; lap++) {
      const x = xScale(lap);
      if (x >= pad.left && x <= W - pad.right) {
        ctx.fillText(`L${lap}`, x, H - 6);
      }
    }

    // series lines
    const series = [];
    this.selectedRiders.forEach((no, idx) => {
      const laps = riderLapMap[no] || [];
      const seen = new Set();
      const pts = laps.filter(l => { if (!isFinite(l.totalTimeSec)) return false; if (seen.has(l.lapNumber)) return false; seen.add(l.lapNumber); return true; }).map(l => ({ lap: l.lapNumber, time: l.totalTimeSec }));
      if (pts.length === 0) return;
      const rider = this.data.riders.find(r => r.number === no);
      series.push({ riderNo: no, name: rider ? rider.name : no, pts, color: this.COLORS[idx % this.COLORS.length] });
    });

    series.forEach(s => {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      s.pts.forEach((p, i) => {
        const x = xScale(p.lap);
        const y = yScale(p.time);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();

      s.pts.forEach(p => {
        const x = xScale(p.lap);
        const y = yScale(p.time);
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fillStyle = s.color; ctx.fill();
        ctx.fillStyle = '#e8e8f0'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(Parser.secondsToTime(p.time), x, y - 8);
      });
    });

    // zoom hint
    ctx.fillStyle = '#8888aa'; ctx.font = '9px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText('ダブルタップでリセット', W - 4, 12);
    this._renderLegend(series);
  }

  _renderLegend(series) {
    const el = document.getElementById('chart-legend');
    el.innerHTML = series.map(s => `
      <div class="chart-legend-item" data-no="${s.riderNo}">
        <span class="swatch" style="background:${s.color}"></span>
        <span>${s.name}</span>
        <span class="close" data-no="${s.riderNo}">&#x2715;</span>
      </div>
    `).join('');
    el.querySelectorAll('.close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeRider(btn.dataset.no);
      });
    });
  }
}

let chartInstance = null;
document.addEventListener('DOMContentLoaded', () => {
  chartInstance = new LapChart('lap-chart');
});