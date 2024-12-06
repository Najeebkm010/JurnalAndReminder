const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const session = require("express-session");
const path = require("path");
require('dotenv').config();

// Import SendGrid Email Reminder
const SendGridEmailReminder = require('./sendgridEmailReminder');

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

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, "public")));

// Session Middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your_secret_key",
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false, // Use true only with HTTPS
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
    },
  })
);

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/login.html");
  }
  next();
};

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Authentication Route
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    req.session.user = username;
    res.redirect("/cheque-management.html");
  } else {
    res.status(401).send("Invalid credentials");
  }
});

app.post("/login", (req, res) => {
  console.log("Login request received:", req.body);
});

// Cheque Management Page Route
app.get("/cheque-management.html", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "cheque-management.html"));
});

// Add Cheque Page Route
app.get("/add-cheque.html", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "add-cheque.html"));
});

// Get Cheque Page Route
app.get("/get-cheque.html", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "get-cheque.html"));
});

// Serve Login Page
app.get("/logout.html", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
    }
    res.redirect("/login.html");
  });
});

// Add Cheque Route (POST)
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

// Get Cheque Route (POST)
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

// Download Cheques Route
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

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log("Connected to MongoDB");
  
  // Initialize SendGrid Email Reminder
  const emailReminder = new SendGridEmailReminder();
  emailReminder.startScheduler();
})
.catch((err) => console.error("MongoDB connection error:", err));

module.exports = app;

// Start Server if not using a separate index.js
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
