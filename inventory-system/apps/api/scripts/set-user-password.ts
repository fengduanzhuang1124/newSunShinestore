import { hash } from 'bcryptjs';
import { createPrismaClient } from '@sunshine/database';
import '../src/config/environment.js';

const [username] = process.argv.slice(2);
if (!username) throw new Error('Usage: set-user-password <username>');

let password = '';
for await (const chunk of process.stdin) password += chunk.toString();
password = password.trim();
if (password.length < 6) throw new Error('Password must contain at least 6 characters');

const prisma = createPrismaClient();
try {
  const result = await prisma.user.updateMany({
    where: { username },
    data: { passwordHash: await hash(password, 12), mustChangePassword: false },
  });
  if (result.count !== 1) throw new Error('Expected exactly one matching user');
  process.stdout.write(JSON.stringify({ username, passwordUpdated: true }) + '\n');
} finally {
  await prisma.$disconnect();
}
