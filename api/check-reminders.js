const mongoose = require('mongoose');
const SendGridEmailReminder = require('../sendgridEmailReminder');
const Cheque = require('../models/Cheque'); // Assume you have a separate model file

export default async function handler(req, res) {
  try {
    // Ensure MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
    }

    // Create email reminder instance
    const emailReminder = new SendGridEmailReminder(Cheque);

    // Directly call reminder check method
    await emailReminder.checkAndSendReminders();

    res.status(200).json({
      success: true,
      message: "Reminders processed successfully"
    });
  } catch (error) {
    console.error("Reminder processing error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
