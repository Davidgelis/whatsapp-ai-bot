// routes/analytics.js

const express = require('express');
const router = express.Router();
const { pool } = require('../database');

// GET /admin/analytics
// Retrieves a count of messages per project and renders the analytics view.
router.get('/analytics', async (req, res) => {
  try {
    // Query to count messages for each project.
    // Using a LEFT JOIN ensures projects with no messages are still listed.
    const result = await pool.query(`
      SELECT p.id, p.project_name, COUNT(m.id) AS message_count
      FROM projects p
      LEFT JOIN messages m ON p.id = m.project_id
      GROUP BY p.id, p.project_name
      ORDER BY p.created_at DESC;
    `);
    const analytics = result.rows;
    res.render('analytics', { analytics });
  } catch (err) {
    console.error('Error retrieving analytics:', err);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
