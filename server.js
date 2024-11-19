const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const path = require("path");
const session = require("express-session");

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

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, "public")));

// Route for login (GET method to serve the login page)
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Route to handle login POST request
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "password") {
    req.session.user = username;
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

// Route to add a cheque page
app.get("/add-cheque", (req, res) => {
  if (req.session.user) {
    res.sendFile(path.join(__dirname, "public", "add-cheque.html"));
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
      res.redirect("/get-cheque"); // After saving, redirect to /get-cheque
    })
    .catch((err) => {
      console.log("Error adding cheque:", err);
      res.status(500).send("Server error");
    });
});

// Route to get cheques with optional date filter
app.get("/get-cheque", (req, res) => {
  if (req.session.user) {
    // Query for cheques in the database
    Cheque.find() // You can also apply filters like startDate and endDate if needed
      .then((cheques) => {
        if (cheques.length > 0) {
          res.json(cheques); // Return the cheques as JSON if they exist
        } else {
          res.status(404).send("No cheques found.");
        }
      })
      .catch((err) => {
        console.error("Error fetching cheques:", err); // Log the error details for debugging
        res.status(500).send("Error fetching cheques.");
      });
  } else {
    res.redirect("/login"); // If not logged in, redirect to login page
  }
});


// Route to logout
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send("Error logging out.");
    }
    res.redirect("/login"); // Redirect to login after logout
  });
});

// Connect to MongoDB
mongoose
  .connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Server setup
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
