const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const path = require("path");
const session = require("express-session");
require('dotenv').config();
// Initialize the app
const app = express();

// MongoDB connection URI
const mongoURI = process.env.MONGO_URI;

// Define a Cheque Schema
const chequeSchema = new mongoose.Schema({
  signedDate: { type: Date, required: true },
  chequeNumber: { type: String, required: true },
  amount: { type: Number, required: true },
  releaseDate: { type: Date, required: true },
  remark: { type: String, required: true },
});

const Cheque = mongoose.model("Cheque", chequeSchema);

// Middleware for session handling
app.use(
  session({
    secret: "mysecret",
    resave: false,
    saveUninitialized: true,
  })
);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve static files (HTML, CSS)
app.use(express.static(path.join(__dirname, "public")));

// Route for login (GET method to serve the login page)
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Route to handle login POST request
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    req.session.user = username; // Store user in session
    res.redirect("/cheque-management"); // Redirect after successful login
  } else {
    res.status(401).send("Invalid credentials");
  }
});

// Route for the dashboard (after login)
app.get("/cheque-management", (req, res) => {
  if (req.session.user) {
    res.sendFile(path.join(__dirname, "public", "cheque-management.html"));
  } else {
    res.redirect("/login");
  }
});

// Route to add a cheque
app.post("/add-cheque", (req, res) => {
  const { signedDate, chequeNumber, amount, releaseDate, remark } = req.body;

  const newCheque = new Cheque({
    signedDate,
    chequeNumber,
    amount,
    releaseDate,
    remark,
  });

  newCheque
    .save()
    .then(() => {
      res.redirect("/get-cheque");
    })
    .catch((err) => {
      console.log("Error adding cheque:", err);
      res.status(500).send("Server error");
    });
});

// Route to get cheques with filtering based on signed date
app.post("/get-cheque", (req, res) => {
  const { startDate, endDate } = req.body;
  const query = {};
  if (startDate && endDate) {
    query.signedDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  Cheque.find(query)
    .then((cheques) => {
      res.json(cheques);
    })
    .catch((err) => {
      console.log("Error fetching cheques:", err);
      res.status(500).send("Server error");
    });
});

// Route to download cheques as CSV
app.get("/download-cheques", (req, res) => {
  Cheque.find()
    .then((cheques) => {
      let csv = "Cheque Number,Signed Date,Amount,Release Date,Remark\n";
      cheques.forEach((cheque) => {
        csv += `${cheque.chequeNumber},${cheque.signedDate},${cheque.amount},${cheque.releaseDate},${cheque.remark}\n`;
      });

      res.header("Content-Type", "text/csv");
      res.attachment("cheques.csv");
      res.send(csv);
    })
    .catch((err) => {
      console.log("Error downloading cheques:", err);
      res.status(500).send("Server error");
    });
});

// Route for the home page and redirect to login page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "welcome.html"));
});

// Route to add cheque page
app.get("/add-cheque", (req, res) => {
  if (req.session.user) {
    res.sendFile(path.join(__dirname, "public", "add-cheque.html"));
  } else {
    res.redirect("/login");
  }
});

// Route to view cheques page
app.get("/get-cheque", (req, res) => {
  if (req.session.user) {
    res.sendFile(path.join(__dirname, "public", "get-cheque.html"));
  } else {
    res.redirect("/login");
  }
});

//Mail
const { initializeEmailScheduler } = require('./emailScheduler');

// After your mongoose connection
mongoose.connect(mongoURI, {...}).then(() => {
  console.log("Connected to MongoDB");
  initializeEmailScheduler(); // Add this line to start the email scheduler
}).catch((err) => console.error("MongoDB connection error:", err));

mongoose
  .connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 50000,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Server setup
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
