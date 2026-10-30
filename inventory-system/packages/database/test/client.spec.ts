import { describe, expect, it } from 'vitest';
import { parseDatabaseUrl } from '../src/client';

describe('database client configuration', () => {
  it('parses a MySQL connection URL without losing encoded credentials', () => {
    expect(parseDatabaseUrl('mysql://test%40user:p%40ss@localhost:3307/inventory_test')).toEqual({
      host: 'localhost',
      port: 3307,
      user: 'test@user',
      password: 'p@ss',
      database: 'inventory_test',
      connectionLimit: 5,
      allowPublicKeyRetrieval: true,
    });
  });

  it('does not retrieve an RSA public key automatically from a remote database', () => {
    expect(parseDatabaseUrl('mysql://user:pass@db.example.com/inventory')).toMatchObject({
      allowPublicKeyRetrieval: false,
    });
  });

  it('rejects non-MySQL connection URLs', () => {
    expect(() => parseDatabaseUrl('postgresql://user:pass@localhost/database')).toThrow(
      'mysql protocol',
    );
  });
});
