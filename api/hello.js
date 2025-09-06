export default function handler(req, res) {
  res.status(200).json({ hello: "world", ts: new Date().toISOString() });
}
