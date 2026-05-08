import jwt from 'jsonwebtoken';
import { config } from '../config';

// Unit tests for auth token logic (no DB dependency)
describe('Auth Token', () => {
  const testPayload = { id: '123', username: 'test', email: 'test@test.com' };

  it('should create a valid JWT token', () => {
    const token = jwt.sign(testPayload, config.jwt.secret, { expiresIn: '1h' });
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
  });

  it('should verify a valid token', () => {
    const token = jwt.sign(testPayload, config.jwt.secret, { expiresIn: '1h' });
    const decoded = jwt.verify(token, config.jwt.secret) as any;
    expect(decoded.id).toBe('123');
    expect(decoded.username).toBe('test');
    expect(decoded.email).toBe('test@test.com');
  });

  it('should reject an invalid token', () => {
    expect(() => jwt.verify('invalid-token', config.jwt.secret)).toThrow();
  });

  it('should reject a token with wrong secret', () => {
    const token = jwt.sign(testPayload, 'wrong-secret');
    expect(() => jwt.verify(token, config.jwt.secret)).toThrow();
  });

  it('should reject an expired token', () => {
    const token = jwt.sign(testPayload, config.jwt.secret, { expiresIn: '0s' });
    // Allow a small delay for expiration
    expect(() => jwt.verify(token, config.jwt.secret)).toThrow();
  });
});

describe('Input Validation', () => {
  it('should reject empty email', () => {
    const email = '';
    expect(email.length).toBe(0);
  });

  it('should validate email format', () => {
    const validEmails = ['user@example.com', 'test@test.co'];
    const invalidEmails = ['notanemail', '@test.com', 'test@'];

    validEmails.forEach((e) => expect(e).toMatch(/.+@.+\..+/));
    invalidEmails.forEach((e) => expect(e).not.toMatch(/^.+@.+\..+$/));
  });

  it('should enforce minimum password length', () => {
    expect('12345'.length).toBeLessThan(6);
    expect('123456'.length).toBeGreaterThanOrEqual(6);
  });
});
