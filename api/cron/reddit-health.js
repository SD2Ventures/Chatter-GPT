export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    route: "/api/cron/reddit-health",
    query: req.query || null,
    ts: new Date().toISOString()
  });
}
