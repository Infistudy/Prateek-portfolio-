const express = require('express');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const messagesFile = path.join(__dirname, 'data', 'contact-messages.json');
const formSubmitEmail = process.env.FORM_SUBMIT_EMAIL || 'tripathipratik180@gmail.com';

function saveMessage(messageData) {
  let messages = [];

  if (fs.existsSync(messagesFile)) {
    try {
      messages = JSON.parse(fs.readFileSync(messagesFile, 'utf8'));
    } catch (error) {
      messages = [];
    }
  }

  messages.push({
    ...messageData,
    createdAt: new Date().toISOString(),
  });

  fs.mkdirSync(path.dirname(messagesFile), { recursive: true });
  fs.writeFileSync(messagesFile, JSON.stringify(messages, null, 2));
}

async function sendWithFormSubmit(payload) {
  const response = await fetch(`https://formsubmit.co/ajax/${formSubmitEmail}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`FormSubmit failed with status ${response.status}`);
  }

  return response.json();
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'Please fill in your name, email, and message.' });
    }

    const hasEmailConfig = Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);

    if (hasEmailConfig) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.RECEIVER_EMAIL || process.env.EMAIL_USER,
        subject: subject || 'New Portfolio Contact Message',
        html: `
          <h3>New contact message</h3>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Subject:</strong> ${subject || 'No subject'}</p>
          <p><strong>Message:</strong><br/>${message}</p>
        `,
      };

      await transporter.sendMail(mailOptions);
      saveMessage({ name, email, subject: subject || 'No subject', message });
      return res.json({ success: true, message: 'Message sent successfully.' });
    }

    const formPayload = {
      name,
      email,
      subject: subject || 'New Portfolio Contact Message',
      message,
      _subject: subject || 'New Portfolio Contact Message',
      _captcha: 'false',
    };

    await sendWithFormSubmit(formPayload);
    saveMessage({ name, email, subject: subject || 'No subject', message });
    return res.json({ success: true, message: 'Message sent successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to send message. Please try again later.' });
  }
});

app.listen(PORT, () => {
  console.log(`Portfolio server running on port ${PORT}`);
});
