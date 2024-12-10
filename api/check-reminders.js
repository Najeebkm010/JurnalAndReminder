export default async function handler(req, res) {
    try {
      // Send the GET request to your reminder endpoint
      const response = await fetch("https://jurnal-and-reminder.vercel.app/check-reminders");
      const data = await response.text();
  
      // Send a success response
      res.status(200).json({ success: true, message: "Reminder triggered successfully", data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
