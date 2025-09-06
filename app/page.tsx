'use client';

import { useEffect, useState } from 'react';

export default function Home() {
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(setHealth).catch(() => setHealth({ ok:false }));
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1>Chatter GPT — Core</h1>
      <p>Phase 1 backbone (DB + APIs). Sources come in Phase 2.</p>
      <pre style={{ background:'#111', color:'#0f0', padding:12, borderRadius:8 }}>
        {JSON.stringify(health, null, 2)}
      </pre>
      <p>Try: <code>/api/chatter</code> (will be empty until ingestion is added).</p>
    </main>
  );
}
