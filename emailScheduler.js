const nodemailer = require('nodemailer');
const cron = require('node-cron');
const Cheque = require('./models/Cheque'); // Assuming you've moved the Cheque model to a separate file

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
    const cheques = await Cheque.find({
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
        text: `Cheque Reminder:
        
Cheque Number: ${cheque.chequeNumber}
Amount: ${cheque.amount}
Release Date: ${cheque.releaseDate.toDateString()}
Remark: ${cheque.remark}

Please prepare for the upcoming cheque release.`,
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

// Schedule the task to run daily at midnight
function initializeEmailScheduler() {
  // Run at midnight every day
  cron.schedule('0 0 * * *', () => {
    console.log('Running daily cheque release reminder check');
    sendChequeReminderEmails();
  });
}

module.exports = { initializeEmailScheduler };
