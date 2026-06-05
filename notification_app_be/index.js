const express = require('express');
const { requestLoggerMiddleware, Log } = require('logging-middleware');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// 1. Mount the reusable logging middleware globally as the first handler
app.use(requestLoggerMiddleware('backend'));

// 2. Sample route with internal logger calls
app.post('/api/notifications/send', async (req, res) => {
  const { type, recipient, message } = req.body;

  if (!type || !recipient || !message) {
    // Log controller/validation error
    await Log('backend', 'error', 'controller', 'Missing required notification fields');
    return res.status(400).json({ success: false, error: 'Missing type, recipient or message' });
  }

  try {
    // Log db/service interaction
    await Log('backend', 'info', 'service', `Sending ${type} notification to ${recipient}`);
    
    // Mock successful execution
    return res.status(200).json({ success: true, message: 'Notification sent successfully' });
  } catch (err) {
    // Log unexpected errors
    await Log('backend', 'fatal', 'service', `Failed to send notification: ${err.message}`);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

app.listen(PORT, () => {
  console.log(`Notification Backend running on port ${PORT}`);
});
