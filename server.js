const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const path = require("path");
const sgMail = require('@sendgrid/mail');
require('dotenv').config();

// Cheque Schema
const chequeSchema = new mongoose.Schema({
  signedDate: { type: Date, required: true },
  chequeNumber: { type: String, required: true },
  amount: { type: Number, required: true },
  releaseDate: { type: Date, required: true },
  remark: { type: String, required: true }
});
const Cheque = mongoose.model("Cheque", chequeSchema);

// Initialize Express App
const app = express();

// SendGrid Email Reminder Setup
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Authentication State
let isAuthenticated = false;

// Authentication Middleware
const requireAuth = (req, res, next) => {
  if (!isAuthenticated) {
    return res.redirect("/login.html");
  }
  next();
};

// Authentication Routes
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    isAuthenticated = true;
    res.redirect("/cheque-management.html");
  } else {
    res.status(401).send("Invalid credentials");
  }
});

app.get("/logout.html", (req, res) => {
  isAuthenticated = false;
  res.redirect("/login.html");
});

// Protected Routes
app.get("/cheque-management.html", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "cheque-management.html"));
});

app.get("/add-cheque", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "add-cheque.html"));
});

app.get("/get-cheque", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "get-cheque.html"));
});

// Cheque Management Routes
app.post("/add-cheque", requireAuth, async (req, res) => {
  try {
    const { signedDate, chequeNumber, amount, releaseDate, remark } = req.body;
    const newCheque = new Cheque({
      signedDate,
      chequeNumber,
      amount,
      releaseDate,
      remark
    });
    await newCheque.save();
    res.redirect("/get-cheque.html");
  } catch (error) {
    console.error("Error adding cheque:", error);
    res.status(500).send("Server error");
  }
});

app.post("/get-cheque", requireAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    const query = {};
    
    if (startDate && endDate) {
      query.signedDate = { 
        $gte: new Date(startDate), 
        $lte: new Date(endDate) 
      };
    }
    const cheques = await Cheque.find(query);
    res.json(cheques);
  } catch (error) {
    console.error("Error fetching cheques:", error);
    res.status(500).send("Server error");
  }
});

app.get("/download-cheques", requireAuth, async (req, res) => {
  try {
    const cheques = await Cheque.find();
    
    let csv = "Cheque Number,Signed Date,Amount,Release Date,Remark\n";
    cheques.forEach((cheque) => {
      csv += `${cheque.chequeNumber},${cheque.signedDate},${cheque.amount},${cheque.releaseDate},${cheque.remark}\n`;
    });
    res.header("Content-Type", "text/csv");
    res.attachment("cheques.csv");
    res.send(csv);
  } catch (error) {
    console.error("Error downloading cheques:", error);
    res.status(500).send("Server error");
  }
});

// Email Reminder Function
async function checkAndSendReminders() {
  try {
    const today = new Date();
    const reminderDate = new Date(today);
    reminderDate.setDate(today.getDate() + 2);
    
    const cheques = await Cheque.find({
      releaseDate: {
        $gte: new Date(reminderDate.setHours(0, 0, 0, 0)),
        $lt: new Date(reminderDate.setHours(23, 59, 59, 999))
      }
    });
    
    if (cheques.length > 0) {
      const msg = {
        to: process.env.RECIPIENT_EMAIL,
        from: process.env.SENDGRID_SENDER_EMAIL,
        subject: `Cheque Reminders - ${cheques.length} Upcoming Cheques`,
        html: generateEmailHTML(cheques)
      };
      
      await sgMail.send(msg);
      console.log(`Sent reminder email for ${cheques.length} cheques`);
    }
  } catch (error) {
    console.error('Error checking cheque reminders:', error);
  }
}

function generateEmailHTML(cheques) {
  return `
  <!DOCTYPE html>
  <html>
  <body>
    <h2>Upcoming Cheque Reminders</h2>
    <table>
      <tr>
        <th>Cheque Number</th>
        <th>Amount</th>
        <th>Release Date</th>
        <th>Remark</th>
      </tr>
      ${cheques.map(cheque => `
        <tr>
          <td>${cheque.chequeNumber}</td>
          <td>$${cheque.amount.toFixed(2)}</td>
          <td>${cheque.releaseDate.toDateString()}</td>
          <td>${cheque.remark}</td>
        </tr>
      `).join('')}
    </table>
  </body>
  </html>
  `;
}

// Start Reminder Scheduler
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
checkAndSendReminders(); // Immediate first check
setInterval(checkAndSendReminders, TWENTY_FOUR_HOURS);

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log("Connected to MongoDB");
})
.catch((err) => console.error("MongoDB connection error:", err));

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
