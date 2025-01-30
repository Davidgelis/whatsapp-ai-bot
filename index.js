// index.js

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { Configuration, OpenAIApi } = require('openai');

// 1) Enforce environment variables (optional but recommended)
if (!process.env.WHATSAPP_VERIFY_TOKEN) {
  throw new Error('Missing WHATSAPP_VERIFY_TOKEN');
}
if (!process.env.OPENAI_API_KEY) {
  console.warn('Warning: Missing OPENAI_API_KEY. AI calls will fail.');
}
if (!process.env.WHATSAPP_TOKEN) {
  console.warn('Warning: Missing WHATSAPP_TOKEN. Sending messages will fail.');
}

// 2) Create Express app
const app = express();
app.use(bodyParser.json());

// 3) Basic route
app.get('/', (req, res) => {
  res.send('Hello from WhatsApp AI Bot!');
});

// 4) Verification GET route (WhatsApp calls this to verify your webhook)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const verifyToken = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && verifytoken && mode === 'subscribe' &&
    verifytoken === process.env.WHATSAPP_VERIFY_TOKEN) {
  console.log('WEBHOOK_VERIFIED');
  return res.status(200).send(challenge);
}
return res.sendStatus(403);
});

// 5) Messages POST route (WhatsApp sends messages here)
app.post('/webhook', async (req, res) => {
  // Acknowledge we got the message
  res.sendStatus(200);

  try {
    const body = req.body;
    console.log('Incoming webhook:', JSON.stringify(body, null, 2));

    // Check if it's a message event
    // (Simplified check—adapt as needed)
    if (body.object &&
        body.entry && body.entry[0].changes &&
        body.entry[0].changes[0].value.messages) {
      const phoneNumberId = body.entry[0].changes[0].value.metadata.phone_number_id;
      const incomingMessage = body.entry[0].changes[0].value.messages[0];
      const from = incomingMessage.from; // sender's phone
      const msgBody = incomingMessage.text.body;

      console.log('User message:', msgBody);

      // 6) Optionally call OpenAI (if you want AI responses)
      // (Requires npm install openai and setting OPENAI_API_KEY)
      if (process.env.OPENAI_API_KEY) {
        const openai = new OpenAIApi(new Configuration({
          apiKey: process.env.OPENAI_API_KEY
        }));

        const aiResponse = await openai.createChatCompletion({
          model: "gpt-3.5-turbo",
          messages: [
            { role: 'system', content: 'You are a helpful AI bot.' },
            { role: 'user', content: msgBody }
          ]
        });

        const replyText = aiResponse.data.choices[0].message.content;
        console.log("AI reply:", replyText);

        // 7) Send the reply back via WhatsApp
        if (process.env.WHATSAPP_TOKEN) {
          await axios.post(`https://graph.facebook.com/v15.0/${phoneNumberId}/messages`, {
            messaging_product: 'whatsapp',
            to: from,
            text: { body: replyText },
          }, {
            headers: {
              Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
              'Content-Type': 'application/json'
            }
          });
        }
      }
    }

  } catch (err) {
    console.error('Error handling message:', err);
  }
});

// 8) Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AI Bot server is running on port ${PORT}`);
});
