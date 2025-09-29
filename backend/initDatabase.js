// backend/initDatabase.js
require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

async function initDatabase() {
  // 1) 建立无库连接
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'your_password',
    multipleStatements: true, // 视情况，便于一次性执行多条
  });

  try {
    // 2) 建库并选库（可加字符集）
    await connection.execute(`CREATE DATABASE IF NOT EXISTS newstore CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
    console.log('数据库 newstore 创建成功');
    await connection.query('USE newstore');

    // 3) 执行 schema SQL（修正文件名：mall-schema.sql）
    const sqlPath = path.join(__dirname, 'sql', 'mall-schema.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(Boolean);

    await connection.beginTransaction();
    for (const stmt of statements) {
      try {
        await connection.query(stmt);
      } catch (error) {
        if (error.code === 'ER_TABLE_EXISTS_ERROR') {
          console.log('表已存在，跳过：', stmt.split('\n')[0]);
        } else {
          throw error;
        }
      }
    }

    // 4) 插入测试用户（加密密码 & 避免重复）
    const adminPwdHash = await bcrypt.hash('admin123', 10);
    const userPwdHash = await bcrypt.hash('test123', 10);

    // 如果已存在同名用户则不重复插
    const [u1] = await connection.execute('SELECT id FROM users WHERE username=?', ['admin']);
    if (u1.length === 0) {
      await connection.execute(
        'INSERT INTO users (username, password, role) VALUES (?,?,?)',
        ['admin', adminPwdHash, 'admin']
      );
    }

    const [u2] = await connection.execute('SELECT id FROM users WHERE username=?', ['testuser']);
    if (u2.length === 0) {
      await connection.execute(
        'INSERT INTO users (username, password, role) VALUES (?,?,?)',
        ['testuser', userPwdHash, 'customer']
      );
    }

    // 5) 插入测试商品（避免重复）
    const seedProducts = [
      ['iPhone 15', 5999.00, 100, '最新款iPhone', 'on'],
      ['MacBook Pro', 12999.00, 50, '专业级笔记本电脑', 'on'],
      ['AirPods Pro', 1999.00, 200, '无线降噪耳机', 'on'],
    ];
    for (const p of seedProducts) {
      const [exists] = await connection.execute('SELECT id FROM products WHERE name=?', [p[0]]);
      if (exists.length === 0) {
        await connection.execute(
          'INSERT INTO products (name, price, stock, description, status) VALUES (?,?,?,?,?)',
          p
        );
      }
    }

    await connection.commit();
    console.log('数据库表和测试数据初始化成功');
  } catch (error) {
    await connection.rollback();
    console.error('数据库初始化失败:', error);
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  initDatabase();
}

module.exports = initDatabase;
