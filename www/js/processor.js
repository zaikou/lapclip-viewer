const Processor = {
  process(riders, lapDataMap) {
    const allLaps = [];
    const personalBestMap = {};
    const riderLapMap = {};
    for (const r of riders) {
      const laps = lapDataMap[r.number] || [];
      riderLapMap[r.number] = laps;
      // Resolve FINISH sentinel: update lap count from actual data
      if (laps.length > 0) {
        r.laps = Math.max(...laps.map(l => l.lapNumber));
      } else if (r.laps === -1) {
        // FINISH but no lap data available; treat as 1 lap completed
        r.laps = 1;
      }
      let pb = Infinity;
      laps.forEach(l => {
        if (l.lapTimeSec < pb) pb = l.lapTimeSec;
        allLaps.push({ riderNo: r.number, lap: l });
      });
      personalBestMap[r.number] = pb;
    }
    const overallBest = allLaps.length > 0 ? Math.min(...allLaps.filter(x => isFinite(x.lap.lapTimeSec)).map(x => x.lap.lapTimeSec)) : 0;
    const maxLaps = Math.max(...riders.filter(r => r.laps > 0).map(r => r.laps), 0);
    const totalLaps = Math.max(...allLaps.map(x => x.lap.lapNumber), 0);
    return {
      riders, lapDataMap, riderLapMap, personalBestMap, overallBest, maxLaps, totalLaps,
      getLapRankings(lapN) {
        const entries = [];
        for (const r of riders) {
          const laps = riderLapMap[r.number] || [];
          const lap = laps.find(l => l.lapNumber === lapN);
          if (lap && isFinite(lap.lapTimeSec)) {
            entries.push({ rider: r, lap, isOverallBest: lap.lapTimeSec === overallBest, isPersonalBest: lap.lapTimeSec === personalBestMap[r.number] });
          }
        }
        entries.sort((a, b) => a.lap.lapTimeSec - b.lap.lapTimeSec);
        let prevTime = Infinity;
        entries.forEach((e, i) => {
          e.position = i + 1;
          e.gap = e.lap.lapTimeSec - entries[0].lap.lapTimeSec;
        });
        return entries;
      },
      getCumulativeRankings(lapN) {
        const entries = [];
        for (const r of riders) {
          const laps = riderLapMap[r.number] || [];
          const lap = laps.find(l => l.lapNumber === lapN);
          if (lap && isFinite(lap.totalTimeSec)) {
            entries.push({ rider: r, lap, isOverallBest: false, isPersonalBest: false });
          }
        }
        entries.sort((a, b) => a.lap.totalTimeSec - b.lap.totalTimeSec);
        entries.forEach((e, i) => {
          e.position = i + 1;
          e.gap = e.lap.totalTimeSec - entries[0].lap.totalTimeSec;
        });
        return entries;
      },
      getOverallRankings() {
        return riders.filter(r => r.laps > 0).sort((a, b) => {
          if (b.laps !== a.laps) return b.laps - a.laps;
          return Parser.parseTimeToSeconds(a.totalTime) - Parser.parseTimeToSeconds(b.totalTime);
        }).map((r, i) => ({ ...r, position: i + 1 }));
      }
    };
  }
};
