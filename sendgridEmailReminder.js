const mongoose = require('mongoose');
const sgMail = require('@sendgrid/mail');
const schedule = require('node-schedule');

class SendGridEmailReminder {
  constructor(ChequeModel) {
    // Validate required environment variables
    this.validateEnvironmentVariables();

    // Set SendGrid API Key
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    // Sender email (verified in SendGrid)
    this.sender = process.env.SENDGRID_SENDER_EMAIL;

    // Store Cheque Model passed from server
    this.Cheque = ChequeModel;
  }

  // Validate required environment variables
  validateEnvironmentVariables() {
    const requiredEnvVars = [
      'SENDGRID_API_KEY', 
      'SENDGRID_SENDER_EMAIL', 
      'RECIPIENT_EMAIL'
    ];

    requiredEnvVars.forEach(varName => {
      if (!process.env[varName]) {
        console.error(`Missing required environment variable: ${varName}`);
        throw new Error(`Missing required environment variable: ${varName}`);
      }
    });
  }

  // Method to send comprehensive cheque reminder email
  async sendChequeReminders(cheques) {
    try {
      // Additional logging for debugging
      console.log('Sending reminders for cheques:', cheques.length);
      console.log('Recipient Email:', process.env.RECIPIENT_EMAIL);

      // Prepare email message
      const msg = {
        to: process.env.RECIPIENT_EMAIL, // Recipient email
        from: this.sender, // Verified sender
        subject: `Cheque Reminders - ${cheques.length} Upcoming Cheques`,
        html: this.generateEmailHTML(cheques)
      };

      // Send email
      const response = await sgMail.send(msg);
      console.log('Email sent successfully:', response[0].statusCode);
    } catch (error) {
      console.error('SendGrid Email Error:', error);
      
      // Log detailed error for debugging
      if (error.response) {
        console.error('Detailed Error:', error.response.body);
      }
    }
  }

  // Generate HTML email template
  generateEmailHTML(cheques) {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .cheque-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .cheque-table th, .cheque-table td { 
          border: 1px solid #ddd; 
          padding: 10px; 
          text-align: left; 
        }
        .header { background-color: #f4f4f4; padding: 10px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Upcoming Cheque Reminders</h2>
        </div>
        
        <table class="cheque-table">
          <thead>
            <tr>
              <th>Cheque Number</th>
              <th>Amount</th>
              <th>Signed Date</th>
              <th>Release Date</th>
              <th>Remark</th>
            </tr>
          </thead>
          <tbody>
            ${cheques.map(cheque => `
              <tr>
                <td>${cheque.chequeNumber}</td>
                <td>$${cheque.amount.toFixed(2)}</td>
                <td>${new Date(cheque.signedDate).toLocaleDateString()}</td>
                <td>${new Date(cheque.releaseDate).toLocaleDateString()}</td>
                <td>${cheque.remark}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <p style="margin-top: 20px; text-align: center;">
          Please prepare for the upcoming cheque releases.
        </p>
      </div>
    </body>
    </html>
    `;
  }

  // Check and send reminders
  async checkAndSendReminders() {
    try {
      // Get current date
      const today = new Date();
      
      // Calculate the date 2 days from now
      const reminderDate = new Date(today);
      reminderDate.setDate(today.getDate() + 2);
      
      // Find cheques with release date matching 2 days from now
      const cheques = await this.Cheque.find({
        releaseDate: {
          $gte: new Date(reminderDate.setHours(0, 0, 0, 0)),
          $lt: new Date(reminderDate.setHours(23, 59, 59, 999))
        }
      });
      
      // Send reminders if cheques found
      if (cheques.length > 0) {
        await this.sendChequeReminders(cheques);
      } else {
        console.log('No cheques found for reminder today.');
      }
    } catch (error) {
      console.error('Error checking cheque reminders:', error);
    }
  }

  // Start reminder scheduler
  startScheduler() {
    // Schedule job to run daily at 9:00 AM
    schedule.scheduleJob('0 9 * * *', async () => {
      console.log('Running daily cheque reminder check...');
      await this.checkAndSendReminders();
    });

    console.log('Cheque reminder scheduler started. Will run daily at 9:00 AM.');
  }
}

module.exports = SendGridEmailReminder;
