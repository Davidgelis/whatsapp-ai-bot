// routes/messages.js

const express = require('express');
const router = express.Router();
const { pool } = require('../database');

// GET /admin/conversations
// This endpoint retrieves all messages (conversation logs) joined with the project name.
router.get('/conversations', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.*, p.project_name 
       FROM messages m 
       JOIN projects p ON m.project_id = p.id 
       ORDER BY m.timestamp DESC`
    );
    const conversations = result.rows;
    // Render the conversations view and pass the data
    res.render('conversations', { conversations });
  } catch (err) {
    console.error('Error retrieving conversation logs:', err);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
