import pool from './pool.js';

const parentSeed = [
  { parent: 'Rajesh Kumar', phone: '+91 98765 10001', email: 'rajesh.k@email.com', children: [{ name: 'Aarav Kumar', class: 'Grade 5', section: 'A', adm: 'STU-1001' }, { name: 'Ananya Kumar', class: 'Grade 3', section: 'B', adm: 'STU-1002' }] },
  { parent: 'Priya Sharma', phone: '+91 98765 10002', email: 'priya.s@email.com', children: [{ name: 'Isha Sharma', class: 'Grade 8', section: 'A', adm: 'STU-1003' }] },
  { parent: 'Amit Patel', phone: '+91 98765 10003', email: 'amit.p@email.com', children: [{ name: 'Rohan Patel', class: 'Grade 6', section: 'C', adm: 'STU-1004' }] },
  { parent: 'Sunita Menon', phone: '+91 98765 10004', email: 'sunita.m@email.com', children: [{ name: 'Dev Menon', class: 'Grade 4', section: 'A', adm: 'STU-1005' }] },
  { parent: 'Vikram Singh', phone: '+91 98765 10005', email: 'vikram.s@email.com', children: [{ name: 'Arjun Singh', class: 'Grade 7', section: 'B', adm: 'STU-1007' }] },
];

async function seed() {
  try {
    const { rows: count } = await pool.query('SELECT COUNT(*)::int as c FROM students');
    if (count[0].c > 0) {
      console.log('Students already exist, skipping.');
      return;
    }

    for (const row of parentSeed) {
      const { rows: existing } = await pool.query('SELECT id FROM parents WHERE phone = $1', [row.phone]);
      let parentId = existing[0]?.id;
      if (!parentId) {
        const { rows: [par] } = await pool.query(
          `INSERT INTO parents (full_name, email, phone) VALUES ($1, $2, $3) RETURNING id`,
          [row.parent, row.email, row.phone]
        );
        parentId = par.id;
      }
      for (const child of row.children) {
        await pool.query(
          `INSERT INTO students (parent_id, full_name, admission_no, class_grade, section) VALUES ($1,$2,$3,$4,$5)`,
          [parentId, child.name, child.adm, child.class, child.section]
        );
      }
    }

    const { rows: pairs } = await pool.query(
      `SELECT p.id as parent_id, s.id as student_id FROM parents p JOIN students s ON s.parent_id = p.id LIMIT 1`
    );
    if (pairs[0]) {
      await pool.query(
        `UPDATE orders SET parent_id = COALESCE(parent_id, $1), student_id = COALESCE(student_id, $2)`,
        [pairs[0].parent_id, pairs[0].student_id]
      );
    }

    console.log('School parent/student seed completed.');
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
