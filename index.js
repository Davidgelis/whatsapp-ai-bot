// index.js
require('dotenv').config(); // Load environment variables
console.log("DATABASE_URL =", process.env.DATABASE_URL);

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { Configuration, OpenAIApi } = require('openai');

// Import the database functions
const { initDB } = require('./database');

// Import the projects router from the routes folder
const projectRoutes = require('./routes/projects');

// Enforce environment variables (optional but recommended)
if (!process.env.WHATSAPP_VERIFY_TOKEN) {
  throw new Error('Missing WHATSAPP_VERIFY_TOKEN');
}
if (!process.env.OPENAI_API_KEY) {
  console.warn('Warning: Missing OPENAI_API_KEY. AI calls will fail.');
}
if (!process.env.WHATSAPP_TOKEN) {
  console.warn('Warning: Missing WHATSAPP_TOKEN. Sending messages will fail.');
}

// Create Express app
const app = express();
app.use(bodyParser.json());

// --- New code for front-end ---
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
// To parse URL-encoded bodies from HTML forms
app.use(express.urlencoded({ extended: true }));
// --- End new code ---

// Mount the projects router on the /admin path (for API endpoints)
app.use('/admin', projectRoutes);

// Basic route
app.get('/', (req, res) => {
  res.send('Hello from WhatsApp AI Bot!');
});

// --- New route for admin dashboard ---
// This route will render our admin dashboard front-end.
app.get('/admin', async (req, res) => {
  try {
    const { pool } = require('./database');
    const result = await pool.query(`SELECT * FROM projects ORDER BY created_at DESC`);
    const projects = result.rows;
    res.render('admin', { projects });
  } catch (err) {
    console.error('Error rendering admin dashboard:', err);
    res.status(500).send('Internal Server Error');
  }
});
// --- End new route ---

// Verification GET route (for WhatsApp webhook)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const verifyToken = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && verifyToken && mode === 'subscribe' &&
      verifyToken === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('WEBHOOK_VERIFIED');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// 5) Messages POST route (WhatsApp sends messages here)
app.post('/webhook', async (req, res) => {
  // Acknowledge we got the message immediately
  res.sendStatus(200);

  try {
    const body = req.body;
    console.log('Incoming webhook:', JSON.stringify(body, null, 2));

    // Check if it's a message event
    if (body.object &&
        body.entry && body.entry[0].changes &&
        body.entry[0].changes[0].value.messages) {

      // Extract information from the incoming message
      const phoneNumberId = body.entry[0].changes[0].value.metadata.phone_number_id;
      const incomingMessage = body.entry[0].changes[0].value.messages[0];
      const from = incomingMessage.from;
      const msgBody = incomingMessage.text.body;
      console.log('User message:', msgBody);

      // Import the database pool (we use it to look up the project and store messages)
      const { pool } = require('./database');

      // 1. Look up the project using the phone number ID (WhatsApp business number)
      const projectResult = await pool.query(
        `SELECT * FROM projects WHERE whatsapp_phone_number_id = $1`,
        [phoneNumberId]
      );
      if (projectResult.rows.length === 0) {
        console.error("No project found for phone number ID:", phoneNumberId);
        return;
      }
      const project = projectResult.rows[0];

      // 2. Store the incoming message in the messages table
      await pool.query(
        `INSERT INTO messages (project_id, from_number, to_number, message_body, direction, timestamp) 
         VALUES ($1, $2, $3, $4, 'incoming', NOW())`,
        [project.id, from, phoneNumberId, msgBody]
      );

      // 3. Determine the system prompt to use (project-specific or default)
      const systemPrompt = project.system_prompt || 'You are a helpful AI bot.';

      // 4. Call OpenAI using the project's system prompt
      if (process.env.OPENAI_API_KEY) {
        const openai = new OpenAIApi(new Configuration({
          apiKey: process.env.OPENAI_API_KEY
        }));
        const aiResponse = await openai.createChatCompletion({
          model: "gpt-3.5-turbo",
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: msgBody }
          ]
        });
        const replyText = aiResponse.data.choices[0].message.content;
        console.log("AI reply:", replyText);

        // 5. Store the outgoing message in the messages table
        await pool.query(
          `INSERT INTO messages (project_id, from_number, to_number, message_body, direction, timestamp) 
           VALUES ($1, $2, $3, $4, 'outgoing', NOW())`,
          [project.id, phoneNumberId, from, replyText]
        );

        // 6. Send the reply back via WhatsApp using the project's WhatsApp token
        // Use the project's token if available, otherwise fall back to the global token
        const whatsappToken = project.whatsapp_token || process.env.WHATSAPP_TOKEN;
        if (whatsappToken) {
          await axios.post(`https://graph.facebook.com/v15.0/${phoneNumberId}/messages`, {
            messaging_product: 'whatsapp',
            to: from,
            text: { body: replyText },
          }, {
            headers: {
              Authorization: `Bearer ${whatsappToken}`,
              'Content-Type': 'application/json'
            }
          });
        } else {
          console.warn("No WhatsApp token available for this project; reply not sent.");
        }
      }
    }
  } catch (err) {
    console.error('Error handling message:', err);
  }
});


// Initialize the database tables on startup
initDB().then(() => {
  console.log('All tables initialized or confirmed existing.');
}).catch((err) => {
  console.error('Failed to initialize DB:', err);
  process.exit(1);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AI Bot server is running on port ${PORT}`);
});
