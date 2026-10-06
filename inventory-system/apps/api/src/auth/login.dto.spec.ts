import { validate } from 'class-validator';
import { LoginDto } from './login.dto.js';

describe('LoginDto', () => {
  it('allows an existing six-character test password to reach credential verification', async () => {
    const input = new LoginDto();
    input.username = 'employee-test';
    input.password = '123456';

    await expect(validate(input)).resolves.toHaveLength(0);
  });
});
