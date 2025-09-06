export default function handler(req, res) {
  res.status(200).json({
    status: "ok",
    data: ["AAPL", "TSLA", "MSFT"] // replace with real logic later
  });
}
