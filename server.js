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
  remark: { type: String, required: true, maxlength: 500 },
  status: { 
    type: String, 
    enum: ['Pending', 'Released'], 
    default: 'Pending',
    required: true 
  }
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
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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
              <p><strong>Status:</strong> ${cheque.status}</p>
            </div>
            <p>A new cheque has been added to the system. Please review the details.</p>
          </div>
        </body>
        </html>
      `
    };

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

// Root Route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Authentication Routes
app.get("/login.html", (req, res) => {
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

app.get("/logout", (req, res) => {
  isAuthenticated = false;
  res.redirect("/login.html");
});

// Page Routes
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
    
    if (new Date(signedDate) > new Date(releaseDate)) {
      return res.status(400).send("Signed date cannot be after release date");
    }

    const newCheque = new Cheque({
      signedDate,
      chequeNumber,
      amount: parseFloat(amount),
      releaseDate,
      remark,
      status: 'Pending' // Default status
    });
    
    await newCheque.save();
    await sendChequeAdditionEmail(newCheque);
    res.redirect("/get-cheque.html");
  } catch (error) {
    console.error("Error adding cheque:", error);
    
    if (error.code === 11000) {
      return res.status(400).send("Cheque number must be unique");
    }
    
    res.status(500).send("Server error: " + error.message);
  }
});

app.post("/get-cheque", requireAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    console.log("Received dates:", startDate, endDate);

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
    console.log("Found cheques:", cheques.length);

    res.json(cheques);
  } catch (error) {
    console.error("Error fetching cheques:", error);
    res.status(500).send("Server error: " + error.message);
  }
});

// const ExcelJS = require('exceljs');

// const generateFormattedExcel = async (cheques, startDate, endDate) => {
//   const workbook = new ExcelJS.Workbook();
//   const worksheet = workbook.addWorksheet('Cheque Report');

//   // Add title and date range
//   worksheet.mergeCells('A1:F1');
//   worksheet.mergeCells('A2:F2');
//   worksheet.getCell('A1').value = 'Cheque Management Report';
//   worksheet.getCell('A2').value = `Date Range: ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`;
//   worksheet.getCell('A3').value = ''; // Free row

//   // Apply styles to title and date range
//   worksheet.getCell('A1').font = { bold: true, size: 11 };
//   worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
//   worksheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };

//   // Add headers
//   const headers = ['Cheque Number', 'Signed Date', 'Amount', 'Release Date', 'Remark', 'Status'];
//   const headerRow = worksheet.addRow(headers);

//   // Apply styles to each header cell
//   headerRow.eachCell((cell, colNumber) => {
//     if (colNumber <= headers.length) { // Ensure styling applies only to defined headers
//       cell.font = { bold: true, color: { argb: 'FFFFFF' } };
//       cell.alignment = { horizontal: 'center', vertical: 'middle' }; // Center align header cells
//       cell.fill = {
//         type: 'pattern',
//         pattern: 'solid',
//         fgColor: { argb: '4472C4' },
//       };
//     }
//   });

//   // Add data rows
//   cheques.forEach(cheque => {
//     worksheet.addRow([
//       cheque.chequeNumber,
//       new Date(cheque.signedDate).toLocaleDateString(),
//       cheque.amount,
//       new Date(cheque.releaseDate).toLocaleDateString(),
//       cheque.remark,
//       cheque.status
//     ]);
//   });

//   // Set column widths
//   const columnWidths = [15, 12, 15, 20, 30, 15];
//   columnWidths.forEach((width, index) => {
//     worksheet.getColumn(index + 1).width = width;
//   });

//   // Apply border to all cells
//   worksheet.eachRow((row, rowNumber) => {
//     row.eachCell((cell) => {
//       cell.border = {
//         top: { style: 'thin' },
//         left: { style: 'thin' },
//         bottom: { style: 'thin' },
//         right: { style: 'thin' }
//       };
//       cell.alignment = { horizontal: 'left' }; // left alignment for all cells
//     });
//   });

//   // Write to buffer
//   const buffer = await workbook.xlsx.writeBuffer();
//   return buffer;
// };

const ExcelJS = require('exceljs');

const generateFormattedExcel = async (cheques, startDate, endDate) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Cheque Report');

  // Set column widths
  // worksheet.columns = [
  //   { width: 20 }, // Cheque Number
  //   { width: 12 }, // Signed Date
  //   { width: 12 }, // Amount
  //   { width: 15 }, // Release Date
  //   { width: 20 }, // Remark
  //   { width: 12 }  // Status
  // ];

  worksheet.columns = [
    { width: 20, style: { numFmt: '@' } }, // Cheque Number (as text)
    { width: 12, style: { numFmt: 'dd/mm/yyyy' } }, // Signed Date
    { width: 12, style: { numFmt: '#,##0.00' } }, // Amount
    { width: 15, style: { numFmt: 'dd/mm/yyyy' } }, // Release Date
    { width: 20, style: { numFmt: '@' } }, // Remark
    { width: 12, style: { numFmt: '@' } }  // Status
  ];

  // Add title and date range
  worksheet.mergeCells('A1:F1');
  worksheet.mergeCells('A2:F2');
  
  // Set row heights
  // worksheet.getRow(1).height = 20; // Title row height
  // worksheet.getRow(2).height = 20; // Date range row height
  // worksheet.getRow(4).height = 20; // Header row height

  worksheet.getCell('A1').value = 'Cheque Management Report';
  worksheet.getCell('A2').value = `Date Range: ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`;
  worksheet.getCell('A3').value = ''; // Free row

  // Apply styles to title and date range
  worksheet.getCell('A1').font = { bold: true, size: 11 };
  worksheet.getCell('A1').alignment = { 
    horizontal: 'center', 
    vertical: 'middle',
    wrapText: true 
  };
  worksheet.getCell('A2').alignment = { 
    horizontal: 'center', 
    vertical: 'middle',
    wrapText: true 
  };

  // Add headers
  const headers = ['Cheque Number', 'Signed Date', 'Amount', 'Release Date', 'Remark', 'Status'];
  const headerRow = worksheet.addRow(headers);

  // Apply styles to each header cell
  headerRow.eachCell((cell, colNumber) => {
    if (colNumber <= headers.length) {
      cell.font = { 
        bold: true, 
        color: { argb: 'FFFFFF' },
        size: 11
      };
      cell.alignment = { 
        horizontal: 'center', 
        vertical: 'middle',
        wrapText: true
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '4472C4' }
      };
      // Add borders to header cells
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    }
  });

  // Add data rows
  cheques.forEach(cheque => {
    const row = worksheet.addRow([
      cheque.chequeNumber,
      new Date(cheque.signedDate).toLocaleDateString(),
      cheque.amount,
      new Date(cheque.releaseDate).toLocaleDateString(),
      cheque.remark,
      cheque.status
    ]);

    // Center align all cells in the row
    row.eachCell((cell) => {
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  });

  // Write to buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

module.exports = generateFormattedExcel;

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
    
    // Generate the Excel buffer
    const excelBuffer = await generateFormattedExcel(cheques, startDate, endDate);
    
    // Set response headers
    res.setHeader(
      'Content-Type', 
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition', 
      'attachment; filename=cheques_report.xlsx'
    );
    
    // Send the buffer
    return res.send(excelBuffer);
  } catch (error) {
    console.error("Error downloading cheques:", error);
    res.status(500).send("Server error");
  }
});

app.post("/edit-cheque", requireAuth, async (req, res) => {
  try {
    const { id, signedDate, chequeNumber, amount, releaseDate, remark, status } = req.body;
    
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
        remark,
        status
      }, 
      { 
        new: true,
        runValidators: true
      }
    );

    if (!updatedCheque) {
      return res.status(404).send("Cheque not found");
    }

    res.json(updatedCheque);
  } catch (error) {
    console.error("Error updating cheque:", error);
    
    if (error.code === 11000) {
      return res.status(400).send("Cheque number must be unique");
    }
    
    res.status(500).send("Server error: " + error.message);
  }
});

// Reminder Check Route
const REMINDER_CHECK_TOKEN = process.env.REMINDER_CHECK_TOKEN;

app.get('/check-reminders', (req, res) => {
  const { token } = req.query;

  if (!token || token !== REMINDER_CHECK_TOKEN) {
    return res.status(403).send('Unauthorized access');
  }

  try {
    const emailReminder = new SendGridEmailReminder(Cheque);
    emailReminder.checkAndSendReminders()
      .then(() => {
        res.status(200).send('Reminders checked successfully');
      })
      .catch((error) => {
        console.error('Reminder check error:', error);
        res.status(500).send('Error checking reminders');
      });
  } catch (error) {
    console.error('Reminder check error:', error);
    res.status(500).send('Error checking reminders');
  }
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log("Connected to MongoDB");
})
.catch((err) => console.error("MongoDB connection error:", err));

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
