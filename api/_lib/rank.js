export function rankSymbols(rows, { wf=1.0, we=0.6, wr=0.8, halfLifeH=24 } = {}) {
  const now = Date.now();
  for (const r of rows) {
    const ageH = (now - new Date(r.latest_ts).getTime()) / 36e5;
    const decay = Math.exp(-ageH / halfLifeH);
    r.score = r.mentions*wf + (r.engagement || 0)*we + decay*wr;
  }
  return rows.sort((a,b)=>b.score-a.score);
}
