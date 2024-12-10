app.get('/check-reminders', async (req, res) => {
  // Add a secret key check
  const secretKey = req.query.secret;
  
  if (secretKey !== process.env.REMINDER_SECRET_KEY) {
    return res.status(403).send('Unauthorized');
  }

  try {
    const emailReminder = new SendGridEmailReminder(Cheque);
    await emailReminder.checkAndSendReminders();
    res.status(200).send('Reminders checked successfully');
  } catch (error) {
    console.error('Reminder check error:', error);
    res.status(500).send('Error checking reminders');
  }
});
