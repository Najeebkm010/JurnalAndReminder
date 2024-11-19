const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const path = require("path");
const session = require("express-session");

const cron = require("node-cron");

// Initialize the app
const app = express();

// MongoDB connection URI
const mongoURI = "mongodb+srv://Najeeb010:NajeebHoor123@cluster0.matgq.mongodb.net/?retryWrites=true&w=majority";

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
    secret: "mysecret", // Secret for signing session cookies
    resave: false, // Don't save unmodified sessions
    saveUninitialized: true, // Save a session that is new but not modified
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
  // Simple validation (Replace with actual authentication logic)
  if (username === "admin" && password === "password") {
    req.session.user = username; // Store user in session
    res.redirect("/cheque-management"); // Redirect after successful login
  } else {
    res.status(401).send("Invalid credentials");
  }
});

// Route for the dashboard (after login)
app.get("/cheque-management", (req, res) => {
  if (req.session.user) {
    // Check if user is logged in
    res.sendFile(path.join(__dirname, "public", "cheque-management.html"));
  } else {
    res.redirect("/login"); // If not logged in, redirect to login page
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
      res.redirect("/get-cheque"); // After saving, redirect to /get-cheque to view cheques
    })
    .catch((err) => {
      console.log("Error adding cheque:", err);
      res.status(500).send("Server error");
    });
});

// Route to get cheques with optional date filter
app.post("/get-cheque", (req, res) => {
  const { startDate, endDate } = req.body;

  // Create a query object based on signed date
  const query = {};
  if (startDate && endDate) {
    query.signedDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  // Query the database for cheques within the filtered date range
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
    // Check if user is logged in
    res.sendFile(path.join(__dirname, "public", "add-cheque.html"));
  } else {
    res.redirect("/login"); // If not logged in, redirect to login page
  }
});

// Route to view cheques page
app.get("/get-cheque", (req, res) => {
  if (req.session.user) {
    // Check if user is logged in
    res.sendFile(path.join(__dirname, "public", "get-cheque.html"));
  } else {
    res.redirect("/login"); // If not logged in, redirect to login page
  }
});

// Cron job for sending notifications 2 days before cheque release
cron.schedule("0 9 * * *", () => {
  console.log("Running scheduled task to check for cheque reminders");

  const today = new Date();
  today.setDate(today.getDate() + 2); // Get the date two days from now
  today.setHours(0, 0, 0, 0); // Set the time to midnight for accurate comparison

  Cheque.find({ releaseDate: today })
    .then((cheques) => {
      cheques.forEach((cheque) => {
        // Logic to send notifications (you can add a push notification or SMS service here)
        console.log(`Reminder: Cheque number ${cheque.chequeNumber} will be released in two days.`);
      });
    })
    .catch((err) => {
      console.log("Error fetching cheques for reminders:", err);
    });
});

// Connect to MongoDB
mongoose
  .connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 50000, // Increased timeout
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Server setup
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
