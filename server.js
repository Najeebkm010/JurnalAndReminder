const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const path = require("path");
const session = require("express-session");
//Mail and sms
const nodemailer = require("nodemailer");
const twilio = require("twilio");
const moment = require('moment-timezone');
const cron = require('node-cron');



// Initialize the app
const app = express();

// MongoDB connection URI
const mongoURI = process.env.MONGO_URI;

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('Connection error:', err));

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

  // Use environment variables for authentication
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  // Simple validation
  if (username === adminUsername && password === adminPassword) {
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

  // Check for missing fields
  if (!signedDate || !chequeNumber || !amount || !releaseDate || !remark) {
    return res.status(400).send("Missing required fields");
  }

  // Use environment variables for predefined data
  const predefinedEmail = process.env.PREDEFINED_EMAIL;
  const predefinedPhone = process.env.PREDEFINED_PHONE;

  // Create a new cheque document
  const newCheque = new Cheque({
    signedDate,
    chequeNumber,
    amount,
    releaseDate,
    remark,
    email: predefinedEmail,
    phoneNumber: predefinedPhone,
  });

  // Save the cheque to the database
  newCheque
    .save()
    .then(() => {
      res.redirect("/get-cheque");
    })
    .catch((err) => {
      console.error("Error adding cheque:", err);
      res.status(500).send("Server error");
    });
});


// Route to get cheques with optional signed date filter
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
const XLSX = require("xlsx");

app.get("/download-cheques", (req, res) => {
  const { startDate, endDate } = req.query;

  const query = {};
  if (startDate && endDate) {
    query.signedDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  Cheque.find(query)
    .then((cheques) => {
      // Prepare the data
      const data = cheques.map((cheque) => ({
        "Cheque Number": cheque.chequeNumber,
        "Signed Date": moment(cheque.signedDate).format("DD/MM/YYYY"),
        "Amount": cheque.amount,
        "Release Date": moment(cheque.releaseDate).format("DD/MM/YYYY"),
        "Remark": cheque.remark,
      }));

      // Create the worksheet
      const ws = XLSX.utils.json_to_sheet(data);

      // Apply styling: make header bold, blue, and add borders
      const range = XLSX.utils.decode_range(ws['!ref']); // Get the range of the worksheet
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cell = ws[XLSX.utils.encode_cell({ r: 0, c: col })];
        if (cell) {
          // Set bold font and blue color for headers
          cell.s = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "4F81BD" } },  // Blue background color
            border: { 
              top: { style: "thin", color: { rgb: "000000" } }, 
              left: { style: "thin", color: { rgb: "000000" } }, 
              bottom: { style: "thin", color: { rgb: "000000" } }, 
              right: { style: "thin", color: { rgb: "000000" } } 
            }
          };
        }
      }

      // Apply borders to the rest of the cells
      for (let row = range.s.r + 1; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })];
          if (cell) {
            // Add borders for all cells
            cell.s = cell.s || {};
            cell.s.border = { 
              top: { style: "thin", color: { rgb: "000000" } }, 
              left: { style: "thin", color: { rgb: "000000" } }, 
              bottom: { style: "thin", color: { rgb: "000000" } }, 
              right: { style: "thin", color: { rgb: "000000" } } 
            };
          }
        }
      }

      // Create a new workbook and append the sheet
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Cheques");

      // Write to buffer and send as download
      const fileBuffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

      // Set the headers for file download
      res.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.header("Content-Disposition", "attachment; filename=cheques.xlsx");

      res.send(fileBuffer);
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

//Rout to logout page
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send("Failed to log out");
    }
    res.redirect("/login");
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



// Your time zone (e.g., Dubai time zone)
const timezone = "Asia/Dubai";

// Function to check if it's time to send notifications
const checkForChequesToNotify = () => {
  const twoDaysFromNow = moment().add(2, 'days').startOf('day').toDate();
  
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

// Schedule the job to run at 12:00 AM in your local time zone
cron.schedule('0 0 * * *', () => {
  const localTimeNow = moment().tz(timezone).format('HH:mm');
  const targetTime = '00:00';  // 12:00 AM in local time
  
  if (localTimeNow === targetTime) {
    console.log("It's 12:00 AM in local time. Checking for cheques to notify...");
    checkForChequesToNotify();
  }
}, {
  timezone: timezone  // Set the local time zone (e.g., "Asia/Dubai")
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
