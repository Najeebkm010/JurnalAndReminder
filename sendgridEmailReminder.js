const mongoose = require('mongoose');
const sgMail = require('@sendgrid/mail');

class SendGridEmailReminder {
  constructor(ChequeModel) {
    // Set SendGrid API Key
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    // Sender email (verified in SendGrid)
    this.sender = process.env.SENDGRID_SENDER_EMAIL;

    // Store Cheque Model passed from server
    this.Cheque = ChequeModel;
  }

  // Method to send comprehensive cheque reminder email
  async sendChequeReminders(cheques) {
    try {
      console.log('Sending reminders for ' + cheques.length + ' cheques');
      console.log('Recipient Email: ' + process.env.RECIPIENT_EMAIL);

      const msg = {
        to: process.env.RECIPIENT_EMAIL,
        from: this.sender,
        subject: 'Cheque Reminders - ' + cheques.length + ' Upcoming Cheques',
        html: this.generateEmailHTML(cheques)
      };

      const response = await sgMail.send(msg);
      console.log('Email sent successfully: ' + response[0].statusCode);

      return response;
    } catch (error) {
      console.error('SendGrid Email Error: ', error);
      if (error.response) {
        console.error('Detailed Error: ', error.response.body);
      }
      throw error;
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
          body { 
            font-family: Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px; 
          }
          .container { 
            background-color: #f9f9f9; 
            border-radius: 8px; 
            padding: 20px; 
          }
          .cheque-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 20px; 
            background-color: white; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
          }
          .cheque-table th, .cheque-table td { 
            border: 1px solid #ddd; 
            padding: 12px; 
            text-align: left; 
          }
          .cheque-table th { 
            background-color: #f4f4f4; 
            font-weight: bold; 
          }
          .header { 
            text-align: center; 
            color: #2c3e50; 
            border-bottom: 2px solid #3498db; 
            padding-bottom: 10px; 
          }
          .footer {
            margin-top: 20px;
            text-align: center;
            font-size: 0.9em;
            color: #777;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Upcoming Cheque Reminders</h2>
            <p>Prepare for the following cheque releases</p>
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
              ${cheques.map(function(cheque) {
                return `
                  <tr>
                    <td>${cheque.chequeNumber}</td>
                    <td>AED ${cheque.amount.toFixed(2)}</td>
                    <td>${new Date(cheque.signedDate).toLocaleDateString()}</td>
                    <td>${new Date(cheque.releaseDate).toLocaleDateString()}</td>
                    <td>${cheque.remark}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="footer">
            <p>This is an automated reminder. Please review the upcoming cheques carefully.</p>
            <p>Generated on: ${new Date().toLocaleString()}</p>
          </div>
        </div>
      </body>
    </html>
    `;
  }

  // Check and send reminders
  async checkAndSendReminders() {
    try {
      const today = new Date();
      const reminderDate = new Date(today);
      reminderDate.setDate(today.getDate() + 2);
      reminderDate.setHours(0, 0, 0, 0);

      const cheques = await this.Cheque.find({
        releaseDate: {
          $gte: reminderDate,
          $lt: new Date(reminderDate.getTime() + 24 * 60 * 60 * 1000)
        }
      });

      if (cheques.length > 0) {
        await this.sendChequeReminders(cheques);
        console.log('Sent reminders for ' + cheques.length + ' cheques');
      } else {
        console.log('No cheques found for reminder today.');
      }
    } catch (error) {
      console.error('Error checking cheque reminders: ', error);
      throw error;
    }
  }
}

module.exports = SendGridEmailReminder;
