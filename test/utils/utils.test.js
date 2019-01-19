const { toCamelCase } = require('../../src/utils/utils');

test('it should transform string to CamelCase', () => {
  const result = toCamelCase('camel_case');
  expect(result).toBe('CamelCase');
});
