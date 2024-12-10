export default function handler(req, res) {
  const now = new Date();
  res.status(200).json({ 
    serverTime: now.toISOString() 
  });
}
