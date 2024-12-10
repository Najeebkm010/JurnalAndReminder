export default function handler(req, res) {
  const now = new Date();
  
  // Log the server time to the console
  console.log("Server Time:", now.toISOString());

  res.status(200).json({ 
    serverTime: now.toISOString() 
  });
}
