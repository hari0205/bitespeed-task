/**
 * Basic test to verify Jest setup is working
 */

describe('Test Setup', () => {
  it('should run basic test', () => {
    expect(true).toBe(true);
  });

  it('should have access to environment variables', () => {
    expect(process.env['NODE_ENV']).toBe('test');
  });
});
