class LapChart {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.data = null;
    this.selectedRiders = [];
    this.COLORS = ['#42a5f5','#ef5350','#66bb6a','#ffd740','#ab47bc','#26c6da','#ff7043','#78909c','#ec407a','#7e57c2'];
    this.dpr = window.devicePixelRatio || 1;
  }

  setData(data) {
    this.data = data;
  }

  addRider(riderNo) {
    if (!this.selectedRiders.includes(riderNo)) {
      this.selectedRiders.push(riderNo);
      this.draw();
    }
  }

  removeRider(riderNo) {
    this.selectedRiders = this.selectedRiders.filter(n => n !== riderNo);
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
    const maxLaps = this.data.totalLaps;

    let minTime = Infinity, maxTime = 0;
    const series = [];
    this.selectedRiders.forEach((no, idx) => {
      const laps = riderLapMap[no] || [];
      const pts = laps.filter(l => isFinite(l.totalTimeSec)).map(l => ({ lap: l.lapNumber, time: l.totalTimeSec }));
      if (pts.length === 0) return;
      pts.forEach(p => { if (p.time < minTime) minTime = p.time; if (p.time > maxTime) maxTime = p.time; });
      const rider = this.data.riders.find(r => r.number === no);
      series.push({ riderNo: no, name: rider ? rider.name : no, pts, color: this.COLORS[idx % this.COLORS.length] });
    });

    if (series.length === 0) return;

    const padding = (maxTime - minTime) * 0.15 || 30;
    const yMin = Math.max(0, minTime - padding);
    const yMax = maxTime + padding;

    const xScale = (lap) => pad.left + ((lap - 1) / (maxLaps - 1 || 1)) * chartW;
    const yScale = (t) => pad.top + chartH - ((t - yMin) / (yMax - yMin)) * chartH;

    // grid lines
    ctx.strokeStyle = '#2a2a44';
    ctx.lineWidth = 0.5;
    for (let lap = 1; lap <= maxLaps; lap++) {
      const x = xScale(lap);
      ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + chartH); ctx.stroke();
    }
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
      const y = pad.top + (i / ySteps) * chartH;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
      ctx.fillStyle = '#8888aa'; ctx.font = '10px monospace'; ctx.textAlign = 'right';
      const val = yMax - (i / ySteps) * (yMax - yMin);
      ctx.fillText(Parser.secondsToTime(val), pad.left - 4, y + 3);
    }

    // x-axis labels
    ctx.fillStyle = '#8888aa'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    for (let lap = 1; lap <= maxLaps; lap++) {
      ctx.fillText(`L${lap}`, xScale(lap), H - 6);
    }

    // overall best line (purple dashed) — not shown for cumulative time

    // series lines
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

      // dots
      s.pts.forEach(p => {
        const x = xScale(p.lap);
        const y = yScale(p.time);
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fillStyle = s.color; ctx.fill();
        ctx.fillStyle = '#e8e8f0'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(Parser.secondsToTime(p.time), x, y - 8);
      });
    });

    // legend
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
