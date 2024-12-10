export default async function handler(req, res) {
  try {
    console.log("Attempting to fetch from https://jurnal-and-reminder.vercel.app/check-reminders");

    const response = await fetch("https://jurnal-and-reminder.vercel.app/check-reminders");
    
    if (!response.ok) {
      throw new Error(`Fetch failed with status: ${response.status}`);
    }

    const data = await response.text();
    console.log("Response received:", data);

    res.status(200).json({
      success: true,
      message: "Reminder triggered successfully",
      data,
    });
  } catch (error) {
    console.error("Error in api/check-reminders.js:", error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
