const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const path = require("path");
const session = require("express-session");


const cron = require('node-cron');


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
  }),
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



// Function to send an email to multiple recipients (notification about the added cheque)
const sendEmail = (emails, chequeDetails) => {
  const mailOptions = {
    from: "y0utubef0ry0u2@gmail.com", // Replace with your email
    to: emails.join(", "), // Join the emails array to send to multiple recipients
    subject: "New Cheque Added",
    text: `Dear User,\n\nA new cheque with the following details has been added:\n\nCheque Number: ${chequeDetails.chequeNumber}\nSigned Date: ${chequeDetails.signedDate}\nAmount: ${chequeDetails.amount}\nRelease Date: ${chequeDetails.releaseDate}\nRemark: ${chequeDetails.remark}\n\nBest Regards,\nYour App`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log("Error sending email:", error);  // Error logging
    } else {
      console.log("Email sent:", info.response);  // Success logging
    }
  });
};


// Route to get cheques with optional date filter
// Route to get cheques with optional signed date filter
// Route to get cheques with filtering based on signed date
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

// Function to send an email to multiple recipients
const sendEmailReminder = (emails, chequeDetails) => {
  const mailOptions = {
    from: "y0utubef0ry0y2@gmail.com", // Replace with your email
    to: emails.join(", "), // Join the emails array to send to multiple recipients
    subject: "Cheque Release Reminder",
    text: `Dear User, this is a reminder that the cheque with number ${chequeDetails.chequeNumber} and amount ${chequeDetails.amount} is scheduled to be released on ${chequeDetails.releaseDate}.`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log("Error sending email:", error);
    } else {
      console.log("Email sent:", info.response);
    }
  });
};

// Modify the scheduled task to send email to two recipients
cron.schedule("0 9 * * *", () => {
  console.log("Running scheduled task to check for cheque reminders");

  const today = new Date();
  today.setDate(today.getDate() + 2); // Get the date two days from now

  Cheque.find({ releaseDate: today })
    .then((cheques) => {
      cheques.forEach((cheque) => {
        // Send email to two different addresses
        const emails = ["noufalriyas88@gmail.com", "hooralbhar.foodstufftrading@gmail.com"];
        sendEmailReminder(emails, cheque);
      });
    })
    .catch((err) => {
      console.log("Error fetching cheques for reminders:", err);
    });
});



cron.schedule("0 9 * * *", () => {
  console.log("Cron job running at 9:00 AM every day.");
  // Place your scheduled task logic here (e.g., sending reminders)
});

mongoose
  .connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 50000,  // Increased timeout
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Server setup
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
