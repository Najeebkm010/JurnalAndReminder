const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const path = require("path");
const sgMail = require('@sendgrid/mail');
const SendGridEmailReminder = require('./sendgridEmailReminder');
require('dotenv').config();
import { SpeedInsights } from "@vercel/speed-insights/next"

// Cheque Schema
const chequeSchema = new mongoose.Schema({
  signedDate: { type: Date, required: true },
  chequeNumber: { type: String, required: true, unique: true },
  amount: { 
    type: Number, 
    required: true, 
    min: [0, 'Amount must be a positive number'] 
  },
  releaseDate: { type: Date, required: true },
  remark: { type: String, required: true, maxlength: 500 }
});

const Cheque = mongoose.model("Cheque", chequeSchema);

// Initialize Express App
const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Authentication State
let isAuthenticated = false;

// SendGrid Email Utility Function
const sendChequeAdditionEmail = async (cheque) => {
  try {
    // Configure SendGrid
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    // Prepare email message
    const msg = {
      to: process.env.RECIPIENT_EMAIL,
      from: process.env.SENDGRID_SENDER_EMAIL,
      subject: 'New Cheque Added to System',
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; }
            .container { padding: 20px; background-color: #f4f4f4; }
            .details { background-color: white; padding: 15px; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>New Cheque Added</h2>
            <div class="details">
              <p><strong>Cheque Number:</strong> ${cheque.chequeNumber}</p>
              <p><strong>Amount:</strong> AED${cheque.amount.toFixed(2)}</p>
              <p><strong>Signed Date:</strong> ${new Date(cheque.signedDate).toLocaleDateString()}</p>
              <p><strong>Release Date:</strong> ${new Date(cheque.releaseDate).toLocaleDateString()}</p>
              <p><strong>Remark:</strong> ${cheque.remark}</p>
            </div>
            <p>A new cheque has been added to the system. Please review the details.</p>
          </div>
        </body>
        </html>
      `
    };

    // Send email
    await sgMail.send(msg);
    console.log('Cheque addition notification email sent successfully');
  } catch (error) {
    console.error('Error sending cheque addition email:', error);
  }
};

// Authentication Middleware
const requireAuth = (req, res, next) => {
  if (!isAuthenticated) {
    return res.redirect("/login.html");
  }
  next();
};

// Root Route - Always redirects to login
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Authentication Routes
app.get("/login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  
  // Use environment variables for credentials
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    isAuthenticated = true;
    res.redirect("/cheque-management.html");
  } else {
    res.status(401).send("Invalid credentials");
  }
});

// Logout Route
app.get("/logout", (req, res) => {
  isAuthenticated = false;
  res.redirect("/login.html");
});


app.get("/cheque-management.html", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "cheque-management.html"));
});

app.get("/cheque-management", requireAuth, (req, res) => {
  res.redirect("/cheque-management.html");
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
    
    // Validate input
    if (new Date(signedDate) > new Date(releaseDate)) {
      return res.status(400).send("Signed date cannot be after release date");
    }

    const newCheque = new Cheque({
      signedDate,
      chequeNumber,
      amount: parseFloat(amount),
      releaseDate,
      remark
    });
    
    // Save cheque
    await newCheque.save();

    // Send email notification about new cheque
    await sendChequeAdditionEmail(newCheque);

    res.redirect("/get-cheque.html");
  } catch (error) {
    console.error("Error adding cheque:", error);
    
    // Handle duplicate cheque number
    if (error.code === 11000) {
      return res.status(400).send("Cheque number must be unique");
    }
    
    res.status(500).send("Server error: " + error.message);
  }
});

app.post("/get-cheque", requireAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    console.log("Received dates:", startDate, endDate); // Server-side logging

    if (!startDate || !endDate) {
      return res.status(400).send("Start and end dates are required");
    }

    const query = {
      signedDate: { 
        $gte: new Date(startDate), 
        $lte: new Date(endDate) 
      }
    };

    const cheques = await Cheque.find(query).sort({ releaseDate: 1 });
    console.log("Found cheques:", cheques.length); // Server-side logging

    res.json(cheques);
  } catch (error) {
    console.error("Error fetching cheques:", error);
    res.status(500).send("Server error: " + error.message);
  }
});
app.get("/download-cheques", requireAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = {};
    
    if (startDate && endDate) {
      query.signedDate = { 
        $gte: new Date(startDate), 
        $lte: new Date(endDate) 
      };
    }
    
    const cheques = await Cheque.find(query).sort({ releaseDate: 1 });
    
    let csv = "Cheque Number,Signed Date,Amount,Release Date,Remark\n";
    cheques.forEach((cheque) => {
      csv += `${cheque.chequeNumber},${new Date(cheque.signedDate).toLocaleDateString()},${cheque.amount},${new Date(cheque.releaseDate).toLocaleDateString()},${cheque.remark}\n`;
    });
    
    res.header("Content-Type", "text/csv");
    res.attachment("cheques.csv");
    res.send(csv);
  } catch (error) {
    console.error("Error downloading cheques:", error);
    res.status(500).send("Server error");
  }
});

app.post("/edit-cheque", requireAuth, async (req, res) => {
  try {
    const { id, signedDate, chequeNumber, amount, releaseDate, remark } = req.body;
    
    // Validate input
    if (new Date(signedDate) > new Date(releaseDate)) {
      return res.status(400).send("Signed date cannot be after release date");
    }

    const updatedCheque = await Cheque.findByIdAndUpdate(
      id, 
      {
        signedDate,
        chequeNumber,
        amount: parseFloat(amount),
        releaseDate,
        remark
      }, 
      { 
        new: true,  // Return the updated document
        runValidators: true  // Run mongoose validation
      }
    );

    if (!updatedCheque) {
      return res.status(404).send("Cheque not found");
    }

    res.json(updatedCheque);
  } catch (error) {
    console.error("Error updating cheque:", error);
    
    // Handle duplicate cheque number
    if (error.code === 11000) {
      return res.status(400).send("Cheque number must be unique");
    }
    
    res.status(500).send("Server error: " + error.message);
  }
});
// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log("Connected to MongoDB");
  // Initialize and start email reminder scheduler
 // const emailReminder = new SendGridEmailReminder(Cheque);
  //emailReminder.startScheduler();
})
.catch((err) => console.error("MongoDB connection error:", err));

app.get('/check-reminders', async (req, res) => {
  try {
    const emailReminder = new SendGridEmailReminder(Cheque);
    await emailReminder.checkAndSendReminders();
    res.status(200).send('Reminders checked successfully');
  } catch (error) {
    console.error('Reminder check error:', error);
    res.status(500).send('Error checking reminders');
  }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
