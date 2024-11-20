const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const path = require("path");
const session = require("express-session");
const xlsx = require('xlsx');
//Mail and sms
const nodemailer = require("nodemailer");
const twilio = require("twilio");
const cron = require("node-cron");
const moment = require("moment");




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
  email: { type: String, required: true },  // Predefined email
  phoneNumber: { type: String, required: true },  // Predefined phone number
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

  if (!signedDate || !chequeNumber || !amount || !releaseDate || !remark) {
    return res.status(400).send("Missing required fields");
  }

  const predefinedEmail = "najeebkm010@gmail.com";
  const predefinedPhone = "+971529536203";

  const newCheque = new Cheque({
    signedDate,
    chequeNumber,
    amount,
    releaseDate,
    remark,
    email: predefinedEmail,
    phoneNumber: predefinedPhone,
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


$.ajax({
  url: "/get-cheque",
  method: "POST",  // Ensure this is POST, not GET
  data: { startDate, endDate },
  success: function (response) {
    // Handle response
  },
  error: function () {
    alert("Error fetching cheques.");
  }
});



// Route to get cheques with optional signed date filter
// Add this route to handle POST requests to /get-cheque
app.post('/get-cheque', (req, res) => {
  const { startDate, endDate } = req.body; // Extract startDate and endDate from the request body

  // Construct the query to filter cheques based on the dates
  const query = {};
  if (startDate && endDate) {
    query.signedDate = { 
      $gte: new Date(startDate), 
      $lte: new Date(endDate) 
    };
  }

  // Fetch the cheques from the database using the query
  Cheque.find(query)
    .then((cheques) => {
      // Send the filtered cheques back as a response
      res.json(cheques);
    })
    .catch((err) => {
      console.error("Error fetching cheques:", err);
      res.status(500).send("Server error");
    });
});


// Route to download cheques as CSV
// Route to download cheques as Excel
// Route to download cheques as Excel
app.get("/download-cheques-excel", (req, res) => {
  const { startDate, endDate } = req.query;

  const query = {};
  if (startDate && endDate) {
    query.signedDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  Cheque.find(query)
    .then((cheques) => {
      const data = [];
      
      // Define styles for header cells
      const headerStyle = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        alignment: { horizontal: "center", vertical: "center" },
        fill: { fgColor: { rgb: "4F81BD" } }, // Blue background color
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } }
        }
      };

      // Add headers
      data.push([
        "Cheque No.",
        "Signed Date",
        "Cheque Amount (AED)",
        "Release Date",
        "Remark"
      ]);

      // Formatting the rows and applying border styles
      cheques.forEach((cheque) => {
        const signedDateFormatted = moment(cheque.signedDate).format("DD/MM/YYYY");
        const releaseDateFormatted = moment(cheque.releaseDate).format("DD/MM/YYYY");

        data.push([
          cheque.chequeNumber,
          signedDateFormatted,
          cheque.amount,
          releaseDateFormatted,
          cheque.remark,
        ]);
      });

      // Create a worksheet with the data
      const ws = xlsx.utils.aoa_to_sheet(data);

      // Apply styles to the header row
      for (let i = 0; i < 5; i++) {
        const cellAddress = { r: 0, c: i }; // 0th row (header row), i-th column
        if (!ws[cellAddress]) ws[cellAddress] = {}; // Initialize cell if undefined
        ws[cellAddress].s = headerStyle;
      }

      // Apply borders to all cells
      for (let row = 0; row < data.length; row++) {
        for (let col = 0; col < data[row].length; col++) {
          const cellAddress = { r: row, c: col };
          if (!ws[cellAddress]) ws[cellAddress] = {}; // Initialize cell if undefined
          if (!ws[cellAddress].s) ws[cellAddress].s = {}; // Initialize style if undefined
          ws[cellAddress].s.border = {
            top: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } }
          };
        }
      }

      // Create a workbook and append the worksheet
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "Cheques");

      // Set headers for the download response
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=cheques.xlsx");

      // Send the Excel file
      res.send(xlsx.write(wb, { bookType: "xlsx", type: "buffer" }));
    })
    .catch((err) => {
      console.log("Error downloading cheques:", err);
      res.status(500).send("Server error");
    });
});


// Setup Twilio client SMS
const client = twilio("AC68aceabef206fe8969136b5b7fce9c55", "5c396662082f78d9b5d5ef7d739d99d1");

const sendReminderSMS = (phoneNumber, chequeNumber, releaseDate, amount) => {
  client.messages
    .create({
      body: `Reminder: Your cheque ${chequeNumber} for the amount of ${amount} will be released on ${releaseDate}.`,
      from: "+12563644560",  // Replace with your Twilio phone number
      to: phoneNumber,
    })
    .then((message) => console.log("SMS sent: " + message.sid))
    .catch((error) => console.log("Error sending SMS:", error));
};

// Setup email transporter using SendGrid
const transporter = nodemailer.createTransport({
  service: "SendGrid",
  auth: {
    user: "apikey",  // Use 'apikey' as the username for SendGrid
    pass: "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",  // Replace with your SendGrid API key
  },
});

// Function to send email
const sendReminderEmail = (email, chequeNumber, releaseDate, amount) => {
  const mailOptions = {
    from: "y0utubef0ry0u2@gmail.com",
    to: email,
    subject: `Reminder: Cheque Release Date Approaching`,
    text: `This is a reminder that your cheque ${chequeNumber} for the amount of ${amount} will be released on ${releaseDate}.`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log("Error sending email:", error);
    } else {
      console.log("Email sent: " + info.response);
    }
  });
};

// Function to check for cheques and send notifications
const checkForChequesToNotify = () => {
  const twoDaysFromNow = moment().add(2, "days").startOf("day").toDate();

  Cheque.find({ releaseDate: twoDaysFromNow })
    .then((cheques) => {
      cheques.forEach((cheque) => {
        // Send email and SMS reminder for each cheque
        sendReminderEmail(cheque.email, cheque.chequeNumber, cheque.releaseDate, cheque.amount);
        sendReminderSMS(cheque.phoneNumber, cheque.chequeNumber, cheque.releaseDate, cheque.amount);
      });
    })
    .catch((err) => {
      console.log("Error fetching cheques:", err);
    });
};

// Schedule the job to run every day at midnight
cron.schedule("0 0 * * *", () => {
  console.log("Checking for cheques to notify...");
  checkForChequesToNotify();
});

const notificationSchema = new mongoose.Schema({
  email: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  chequeNumber: { type: String, required: true },
  amount: { type: Number, required: true },
  releaseDate: { type: Date, required: true },
  isNotified: { type: Boolean, default: false }, // To track if notification was sent
});

const Notification = mongoose.model("Notification", notificationSchema);

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
