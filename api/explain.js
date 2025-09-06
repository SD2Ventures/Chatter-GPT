export default function handler(req, res) {
  const query = req.query?.q || "nothing";
  res.status(200).json({
    status: "ok",
    explanation: `You asked me to explain: ${query}`
  });
}
