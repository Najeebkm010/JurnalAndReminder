const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

// Create a transporter using SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail', // or your preferred email service
  auth: {
    user: process.env.EMAIL_USER, // Your email
    pass: process.env.EMAIL_PASS  // Your email password or app-specific password
  }
});

// Function to send email reminder
async function sendChequeReminderEmails() {
  try {
    // Get current date
    const today = new Date();
    
    // Calculate the date 2 days from now
    const reminderDate = new Date(today);
    reminderDate.setDate(today.getDate() + 2);
    
    // Find cheques with release date matching 2 days from now
    const cheques = await mongoose.model('Cheque').find({
      releaseDate: {
        $gte: new Date(reminderDate.setHours(0, 0, 0, 0)),
        $lt: new Date(reminderDate.setHours(23, 59, 59, 999))
      }
    });
    
    // Send email for each cheque
    for (const cheque of cheques) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.PREDEFINED_EMAIL,
        subject: 'Upcoming Cheque Release Reminder',
        html: `
        <h2>Cheque Reminder</h2>
        <p><strong>Cheque Number:</strong> ${cheque.chequeNumber}</p>
        <p><strong>Amount:</strong> ${cheque.amount}</p>
        <p><strong>Release Date:</strong> ${cheque.releaseDate.toDateString()}</p>
        <p><strong>Remark:</strong> ${cheque.remark}</p>
        <p>Please prepare for the upcoming cheque release.</p>
        `
      };
      
      // Send email
      await transporter.sendMail(mailOptions);
      console.log(`Reminder email sent for cheque ${cheque.chequeNumber}`);
    }
  } catch (error) {
    console.error('Error in sending cheque reminder emails:', error);
  }
}

// Function to check and send reminders
async function checkAndSendReminders() {
  try {
    console.log('Checking for cheque reminders...');
    await sendChequeReminderEmails();
  } catch (error) {
    console.error('Error in checking reminders:', error);
  }
}

module.exports = { checkAndSendReminders };
