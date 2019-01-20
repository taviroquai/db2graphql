const Compiler = require('../../src/graphql/compiler');
const PostgreSQL = require('../../src/adapters/postgres');
const knex = require('../knex');

test('it should create a new Graphql compiler', () => {
  const compiler = new Compiler();
  expect(compiler instanceof Compiler).toBe(true);
});

test('it should map database table to graphql type', () => {
  const mock = require('../mocks/mockCompiler');
  const dbDriver = new PostgreSQL(knex(), mock.dbSchema);
  const compiler = new Compiler(mock.dbSchema, dbDriver);
  let result = compiler.mapDbTableToGraphqlType('foo');
  expect(result).toEqual(mock.result1);

  // Add reverse relations
  result = compiler.mapDbTableToGraphqlType('bar');
  expect(result).toEqual(mock.result2);
});

test('invalid database type', () => {
  const mock = require('../mocks/mockCompiler');
  const dbDriver = new PostgreSQL(knex(), mock.dbSchemaInvalidField);
  const compiler = new Compiler(mock.dbSchemaInvalidField, dbDriver);
  let result = compiler.mapDbTableToGraphqlType('bar');
  expect(result).toEqual(mock.result5);
});

test('it should create a page type definition for tablename', () => {
  const compiler = new Compiler();
  let result = compiler.mapDbTableToGraphqlPage('foo');
  let expected = "type PageFoo{\n  total: Int,\n  tablename: String,\n  items: [Foo]\n}";
  expect(result).toEqual(expected);
});

test('it should create a getPage definition for tablename', () => {
  const compiler = new Compiler();
  let result = compiler.mapDbTableToGraphqlQuery('foo');
  let expected = "getPageFoo(filter: String, pagination: String): PageFoo";
  expect(result).toEqual(expected);
});

test('it should create a getFirstOf definition for tablename', () => {
  const compiler = new Compiler();
  let result = compiler.mapDbTableToGraphqlFirstOf('foo');
  let expected = "getFirstOfFoo(filter: String, pagination: String): Foo";
  expect(result).toEqual(expected);
});

test('it should create a putItem definition for tablename', () => {
  const mock = require('../mocks/mockCompiler');
  const dbDriver = new PostgreSQL(knex(), mock.dbSchema);
  const compiler = new Compiler(mock.dbSchema, dbDriver);
  let result = compiler.mapDbTableToGraphqlMutation('foo');
  expect(result).toEqual(mock.result3);
});

test('invalid field on create putItem definition', () => {
  const mock = require('../mocks/mockCompiler');
  const dbDriver = new PostgreSQL(knex(), mock.dbSchemaInvalidField);
  const compiler = new Compiler(mock.dbSchemaInvalidField, dbDriver);
  let result = compiler.mapDbTableToGraphqlMutation('bar');
  expect(result).toEqual(mock.result6);
});

test('it should create a complete schema definition', () => {
  const mock = require('../mocks/mockCompiler');
  let dbDriver = new PostgreSQL(knex(), mock.dbSchema);
  let compiler = new Compiler(mock.dbSchema, dbDriver);
  let result = compiler.getSchema();
  expect(result).toEqual(mock.result4);

  // Test empty schema
  dbDriver = new PostgreSQL(knex(), {});
  compiler = new Compiler({}, dbDriver);
  result = compiler.getSchema();
  expect(result).toEqual('');
});