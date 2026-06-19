import { Router } from 'express';
import pool from '../db/pool.js';
import { normalizeGender } from '../config/uniformCatalog.js';

const router = Router();

router.get('/students/all', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.*, p.full_name as parent_name, p.phone as parent_phone
      FROM students s
      JOIN parents p ON p.id = s.parent_id
      ORDER BY s.class_grade, s.full_name
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*,
        COALESCE(json_agg(
          json_build_object(
            'id', s.id, 'full_name', s.full_name, 'admission_no', s.admission_no,
            'class_grade', s.class_grade, 'section', s.section, 'gender', s.gender
          )
        ) FILTER (WHERE s.id IS NOT NULL), '[]') as students
      FROM parents p
      LEFT JOIN students s ON s.parent_id = p.id
      GROUP BY p.id
      ORDER BY p.full_name
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows: [parent] } = await pool.query('SELECT * FROM parents WHERE id = $1', [req.params.id]);
    if (!parent) return res.status(404).json({ error: 'Not found' });
    const { rows: students } = await pool.query('SELECT * FROM students WHERE parent_id = $1', [req.params.id]);
    res.json({ ...parent, students });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { full_name, email, phone, address, students = [] } = req.body;
    const { rows: [parent] } = await pool.query(
      `INSERT INTO parents (full_name, email, phone, address) VALUES ($1,$2,$3,$4) RETURNING *`,
      [full_name, email, phone, address]
    );
    for (const s of students) {
      await pool.query(
        `INSERT INTO students (parent_id, full_name, admission_no, class_grade, section, gender)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [parent.id, s.full_name, s.admission_no, s.class_grade, s.section, s.gender || null]
      );
    }
    res.status(201).json(parent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/students/:studentId', async (req, res) => {
  try {
    const { full_name, admission_no, class_grade, section, gender } = req.body;
    const normalizedGender = normalizeGender(gender);
    const { rows } = await pool.query(
      `UPDATE students SET full_name=$1, admission_no=$2, class_grade=$3, section=$4, gender=$5
       WHERE id=$6 RETURNING *`,
      [full_name, admission_no, class_grade, section, normalizedGender, req.params.studentId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Student not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/students/:studentId', async (req, res) => {
  try {
    await pool.query('DELETE FROM students WHERE id = $1', [req.params.studentId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { full_name, email, phone, address } = req.body;
    const { rows } = await pool.query(
      `UPDATE parents SET full_name=$1, email=$2, phone=$3, address=$4 WHERE id=$5 RETURNING *`,
      [full_name, email, phone, address, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  const client = await pool.connect();
  const parentId = req.params.id;
  try {
    const { rows: [parent] } = await client.query('SELECT id, full_name FROM parents WHERE id = $1', [
      parentId,
    ]);
    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
    }

    await client.query('BEGIN');

    await client.query('UPDATE orders SET parent_id = NULL, student_id = NULL WHERE parent_id = $1', [
      parentId,
    ]);
    await client.query('UPDATE returns SET parent_id = NULL, student_id = NULL WHERE parent_id = $1', [
      parentId,
    ]);
    await client.query('DELETE FROM students WHERE parent_id = $1', [parentId]);
    const { rowCount } = await client.query('DELETE FROM parents WHERE id = $1', [parentId]);

    if (!rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Parent not found' });
    }

    await client.query('COMMIT');
    res.json({ success: true, message: `${parent.full_name} removed` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.post('/:id/students', async (req, res) => {
  try {
    const { full_name, admission_no, class_grade, section, gender } = req.body;
    const normalizedGender = normalizeGender(gender);
    const { rows } = await pool.query(
      `INSERT INTO students (parent_id, full_name, admission_no, class_grade, section, gender)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.id, full_name, admission_no, class_grade, section, normalizedGender]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
