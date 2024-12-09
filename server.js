const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const path = require("path");
const sgMail = require('@sendgrid/mail');
const SendGridEmailReminder = require('./sendgridEmailReminder');
require('dotenv').config();

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
    
    await newCheque.save();
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
    const query = {};
    
    if (startDate && endDate) {
      query.signedDate = { 
        $gte: new Date(startDate), 
        $lte: new Date(endDate) 
      };
    }
    const cheques = await Cheque.find(query).sort({ releaseDate: 1 });
    res.json(cheques);
  } catch (error) {
    console.error("Error fetching cheques:", error);
    res.status(500).send("Server error");
  }
});

app.get("/download-cheques", requireAuth, async (req, res) => {
  try {
    const cheques = await Cheque.find().sort({ releaseDate: 1 });
    
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

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log("Connected to MongoDB");
  
  // Initialize and start email reminder scheduler
  const emailReminder = new SendGridEmailReminder(Cheque);
  emailReminder.startScheduler();
})
.catch((err) => console.error("MongoDB connection error:", err));

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
