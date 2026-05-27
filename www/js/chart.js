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
    this._xMinEl = document.getElementById('z-x-min');
    this._xMaxEl = document.getElementById('z-x-max');
    this._yMinEl = document.getElementById('z-y-min');
    this._yMaxEl = document.getElementById('z-y-max');
    this._xLabel = document.getElementById('z-x-label');
    this._yLabel = document.getElementById('z-y-label');
    this._xFill = document.getElementById('x-range').querySelector('.range-fill');
    this._yFill = document.getElementById('y-range').querySelector('.range-fill');
    this._setupEvents();
    this._setupSliderListeners();
  }

  _setupSliderListeners() {
    const slide = () => {
      if (this._sliderBusy) return;
      let xMin = parseFloat(this._xMinEl.value);
      let xMax = parseFloat(this._xMaxEl.value);
      let yMin = parseFloat(this._yMinEl.value);
      let yMax = parseFloat(this._yMaxEl.value);
      if (xMin > xMax) { xMin = xMax; this._xMinEl.value = xMin; }
      if (yMin > yMax) { yMin = yMax; this._yMinEl.value = yMin; }
      this.zoom = { xMin, xMax, yMin, yMax };
      this._updateSliderUI();
      this.draw();
    };
    this._xMinEl.addEventListener('input', slide);
    this._xMaxEl.addEventListener('input', slide);
    this._yMinEl.addEventListener('input', slide);
    this._yMaxEl.addEventListener('input', slide);
  }

  _syncSliders() {
    if (this._sliderBusy) return;
    this._sliderBusy = true;
    const b = this._dataBounds();
    const xM = Math.max(b.maxPos, 1);
    const pad = (b.maxTime - b.minTime) * 0.15 || 30;
    const yLo = Math.max(0, b.minTime - pad);
    const yHi = b.maxTime + pad;

    this._xMinEl.min = 0; this._xMinEl.max = xM;
    this._xMaxEl.min = 0; this._xMaxEl.max = xM;
    this._yMinEl.min = yLo; this._yMinEl.max = yHi;
    this._yMaxEl.min = yLo; this._yMaxEl.max = yHi;

    this.zoom.xMin = Math.max(0, Math.min(this.zoom.xMin, xM));
    this.zoom.xMax = Math.max(0, Math.min(this.zoom.xMax, xM));
    this.zoom.yMin = Math.max(yLo, Math.min(this.zoom.yMin, yHi));
    this.zoom.yMax = Math.max(yLo, Math.min(this.zoom.yMax, yHi));

    this._updateSliderUI();
    this._sliderBusy = false;
  }

  _updateSliderUI() {
    const z = this.zoom;
    this._xMinEl.value = z.xMin;
    this._xMaxEl.value = z.xMax;
    this._yMinEl.value = z.yMin;
    this._yMaxEl.value = z.yMax;
    this._xLabel.textContent = `L${z.xMin.toFixed(1)} – L${z.xMax.toFixed(1)}`;
    this._yLabel.textContent = `${Parser.secondsToTime(z.yMin)} – ${Parser.secondsToTime(z.yMax)}`;
    const xPct = ((z.xMin - parseFloat(this._xMinEl.min)) / (parseFloat(this._xMinEl.max) - parseFloat(this._xMinEl.min) || 1)) * 100;
    const xPct2 = ((z.xMax - parseFloat(this._xMinEl.min)) / (parseFloat(this._xMinEl.max) - parseFloat(this._xMinEl.min) || 1)) * 100;
    this._xFill.style.left = xPct + '%';
    this._xFill.style.width = (xPct2 - xPct) + '%';
    const yLo = parseFloat(this._yMinEl.min);
    const yRng = parseFloat(this._yMinEl.max) - yLo || 1;
    this._yFill.style.bottom = ((z.yMin - yLo) / yRng * 100) + '%';
    this._yFill.style.height = ((z.yMax - z.yMin) / yRng * 100) + '%';
  }

  _dataBounds() {
    let maxPos = 0, minTime = 0, maxTime = 1;
    if (this.data) {
      this.selectedRiders.forEach(no => {
        (this.data.riderLapMap[no] || []).forEach(l => {
          if (isFinite(l.totalTimeSec)) {
            if (l.lapPosition > maxPos) maxPos = l.lapPosition;
            if (l.totalTimeSec < minTime) minTime = l.totalTimeSec;
            if (l.totalTimeSec > maxTime) maxTime = l.totalTimeSec;
          }
        });
      });
    }
    return { maxPos, minTime, maxTime };
  }

  resetZoom() {
    const b = this._dataBounds();
    const pad = (b.maxTime - b.minTime) * 0.15 || 30;
    this.zoom = { xMin: 0, xMax: Math.max(b.maxPos, 1), yMin: Math.max(0, b.minTime - pad), yMax: b.maxTime + pad };
    this._syncSliders();
  }

  setData(data) {
    this.data = data;
    this.resetZoom();
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
        this._syncSliders();
        this.draw();
      } else if (e.touches.length === 2 && this._pinchStart) {
        const d = this._dist(e.touches);
        const scale = this._pinchStart.d / d;
        this._zoomAt(this._pinchStart.mx, this._pinchStart.my, scale);
      }
    }, { passive: true });
    c.addEventListener('touchend', () => { this._touchStart = null; this._pinchStart = null; });
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
    this._syncSliders();
    this.draw();
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

    // grid lines & x-axis labels at integer lap positions
    ctx.strokeStyle = '#2a2a44';
    ctx.lineWidth = 0.5;
    const lapStart = Math.max(1, Math.ceil(z.xMin));
    const lapEnd = Math.floor(z.xMax);
    ctx.fillStyle = '#8888aa'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    for (let lap = lapStart; lap <= lapEnd; lap++) {
      const x = xScale(lap);
      if (x >= pad.left && x <= W - pad.right) {
        ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + chartH); ctx.stroke();
        ctx.fillText(`L${lap}`, x, H - 6);
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

    // series lines
    const series = [];
    this.selectedRiders.forEach((no, idx) => {
      const laps = riderLapMap[no] || [];
      const pts = laps.filter(l => isFinite(l.totalTimeSec)).map(l => ({ lap: l.lapPosition, time: l.totalTimeSec }));
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

var chartInstance = new LapChart('lap-chart');
