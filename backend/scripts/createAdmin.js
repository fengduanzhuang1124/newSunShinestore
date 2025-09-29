const bcrypt = require('bcryptjs');
const db = require('../db');

async function createAdminUser() {
  try {
    const adminUsername = 'admin';
    const adminPassword = 'admin123';
    
    // 检查管理员是否已存在
    const [existingAdmins] = await db.query('SELECT id FROM users WHERE username = ?', [adminUsername]);
    
    if (existingAdmins.length > 0) {
      console.log('管理员账户已存在');
      return;
    }
    
    // 加密密码
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    // 创建管理员账户
    await db.query(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [adminUsername, hashedPassword, 'admin']
    );
    
    console.log('管理员账户创建成功！');
    console.log('用户名:', adminUsername);
    console.log('密码:', adminPassword);
    console.log('请及时修改密码！');
    
  } catch (error) {
    console.error('创建管理员账户失败:', error);
  } finally {
    process.exit(0);
  }
}

// 运行脚本
createAdminUser(); 