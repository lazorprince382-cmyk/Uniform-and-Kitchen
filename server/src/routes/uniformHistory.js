import { Router } from 'express';
import pool from '../db/pool.js';
import { evaluateStudentUniform } from '../config/uniformCatalog.js';

const router = Router();

async function getStudentUniformData(studentId = null) {
  const studentFilter = studentId ? 'AND s.id = $1' : '';
  const params = studentId ? [studentId] : [];

  const { rows: students } = await pool.query(
    `SELECT s.id, s.full_name, s.class_grade, s.section, s.admission_no, s.gender,
            p.id as parent_id, p.full_name as parent_name, p.phone as parent_phone
     FROM students s
     JOIN parents p ON p.id = s.parent_id
     WHERE 1=1 ${studentFilter}
     ORDER BY s.class_grade, s.full_name`,
    params
  );

  const { rows: issuedItems } = await pool.query(
    `SELECT o.student_id, o.id as order_id, o.order_number, o.status, o.created_at,
            o.payment_confirmed, o.total_amount,
            p.id as product_id, p.sku, p.name as product_name, c.name as category_name,
            oi.quantity, oi.unit_price
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN products p ON p.id = oi.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE o.student_id IS NOT NULL
       AND o.status IN ('completed', 'processing')
       ${studentId ? 'AND o.student_id = $1' : ''}
     ORDER BY o.created_at DESC`,
    params
  );

  const result = students.map((student) => {
    const studentOrders = {};
    const itemsMap = {};
    const receivedItems = [];

    for (const row of issuedItems.filter((r) => r.student_id === student.id)) {
      if (!studentOrders[row.order_id]) {
        studentOrders[row.order_id] = {
          id: row.order_id,
          order_number: row.order_number,
          status: row.status,
          created_at: row.created_at,
          payment_confirmed: row.payment_confirmed,
          total_amount: row.total_amount,
          items: [],
        };
      }
      studentOrders[row.order_id].items.push({
        product_name: row.product_name,
        category_name: row.category_name,
        sku: row.sku,
        quantity: row.quantity,
        unit_price: row.unit_price,
      });

      const key = row.sku;
      if (!itemsMap[key]) {
        itemsMap[key] = {
          product_id: row.product_id,
          product_name: row.product_name,
          category_name: row.category_name,
          sku: row.sku,
          total_quantity: 0,
        };
      }
      itemsMap[key].total_quantity += row.quantity;

      receivedItems.push({
        sku: row.sku,
        category_name: row.category_name,
        product_name: row.product_name,
        product_id: row.product_id,
      });
    }

    const evaluation = evaluateStudentUniform({
      gender: student.gender,
      receivedItems,
    });

    return {
      ...student,
      uniform_status: evaluation.status,
      uniform_label: evaluation.label,
      core_received: evaluation.coreReceived,
      core_total: evaluation.coreTotal,
      missing_core_items: evaluation.missing_core_items,
      items_still_needed: evaluation.itemsStillNeeded,
      missing_categories: evaluation.missingCategories,
      items_received: Object.values(itemsMap),
      issuances: Object.values(studentOrders),
    };
  });

  return result;
}

router.get('/', async (req, res) => {
  try {
    const data = await getStudentUniformData();
    const summary = {
      full: data.filter((d) => d.uniform_status === 'full').length,
      partial: data.filter((d) => d.uniform_status === 'partial').length,
      none: data.filter((d) => d.uniform_status === 'none').length,
      total: data.length,
    };
    res.json({ summary, students: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:studentId', async (req, res) => {
  try {
    const data = await getStudentUniformData(+req.params.studentId);
    if (!data[0]) return res.status(404).json({ error: 'Student not found' });
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
