// index.js
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { Configuration, OpenAIApi } = require('openai');

const app = express();
app.use(bodyParser.json());

// Basic route to test server is running
app.get('/', (req, res) => {
  res.send('Hello from WhatsApp AI Bot!');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
