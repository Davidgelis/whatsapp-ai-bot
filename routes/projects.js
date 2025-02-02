// routes/projects.js

const express = require('express');
const router = express.Router();
const { pool } = require('../database');

// Create a new project
// Endpoint: POST /admin/projects
router.post('/projects', async (req, res) => {
  try {
    const { project_name, whatsapp_phone_number_id, whatsapp_token, system_prompt } = req.body;
    if (!project_name || !whatsapp_phone_number_id || !whatsapp_token) {
      return res.status(400).send('Missing required fields: project_name, whatsapp_phone_number_id, or whatsapp_token.');
    }
    const result = await pool.query(
      `INSERT INTO projects (project_name, whatsapp_phone_number_id, whatsapp_token, system_prompt) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [project_name, whatsapp_phone_number_id, whatsapp_token, system_prompt || null]
    );
    // If the client accepts HTML, redirect back to the admin dashboard
    if (req.accepts('html')) {
      return res.redirect('/admin');
    }
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating project:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Get all projects
// Endpoint: GET /admin/projects
router.get('/projects', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM projects ORDER BY created_at DESC`);
    res.json(result.rows);
  } catch (err) {
    console.error('Error retrieving projects:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get a single project by ID
// Endpoint: GET /admin/projects/:id
router.get('/projects/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await pool.query(`SELECT * FROM projects WHERE id = $1`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error retrieving project:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Update a project by ID
// Endpoint: PUT /admin/projects/:id
router.put('/projects/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { project_name, whatsapp_phone_number_id, whatsapp_token, system_prompt } = req.body;
    const result = await pool.query(
      `UPDATE projects 
       SET project_name = $1, 
           whatsapp_phone_number_id = $2, 
           whatsapp_token = $3, 
           system_prompt = $4,
           updated_at = NOW() 
       WHERE id = $5 
       RETURNING *`,
      [project_name, whatsapp_phone_number_id, whatsapp_token, system_prompt || null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating project:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Delete a project by ID
// Endpoint: DELETE /admin/projects/:id
router.delete('/projects/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await pool.query(`DELETE FROM projects WHERE id = $1 RETURNING *`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    console.error('Error deleting project:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get project details along with conversation logs
// Endpoint: GET /admin/projects/:id/details
router.get('/projects/:id/details', async (req, res) => {
  try {
    const id = req.params.id;
    // Retrieve project details
    const projectResult = await pool.query(`SELECT * FROM projects WHERE id = $1`, [id]);
    if (projectResult.rows.length === 0) {
      return res.status(404).send('Project not found');
    }
    const project = projectResult.rows[0];
    // Retrieve conversation logs for this project
    const messagesResult = await pool.query(
      `SELECT * FROM messages WHERE project_id = $1 ORDER BY timestamp DESC`,
      [id]
    );
    const conversations = messagesResult.rows;
    res.render('project-details', { project, conversations });
  } catch (err) {
    console.error('Error retrieving project details:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Update project system prompt (via HTML form submission)
// Endpoint: POST /admin/projects/:id/update
router.post('/projects/:id/update', async (req, res) => {
  try {
    const id = req.params.id;
    const { system_prompt } = req.body;
    await pool.query(
      `UPDATE projects SET system_prompt = $1, updated_at = NOW() WHERE id = $2`,
      [system_prompt, id]
    );
    res.redirect(`/admin/projects/${id}/details`);
  } catch (err) {
    console.error('Error updating project prompt:', err);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
