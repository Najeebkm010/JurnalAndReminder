const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const session = require("express-session");
const path = require("path");
require('dotenv').config();

// Import SendGrid Email Reminder
const SendGridEmailReminder = require('./sendgridEmailReminder');

// Initialize Express App
const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Session Middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_secret_key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using https
}));

// Cheque Schema (if not in separate file)
const mongoose = require('mongoose');
const chequeSchema = new mongoose.Schema({
  signedDate: { type: Date, required: true },
  chequeNumber: { type: String, required: true },
  amount: { type: Number, required: true },
  releaseDate: { type: Date, required: true },
  remark: { type: String, required: true }
});
const Cheque = mongoose.model("Cheque", chequeSchema);

// Authentication Route
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    req.session.user = username;
    res.redirect("/cheque-management");
  } else {
    res.status(401).send("Invalid credentials");
  }
});

// Add other routes from previous implementation
// (add-cheque, get-cheque, download-cheques, etc.)

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

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
