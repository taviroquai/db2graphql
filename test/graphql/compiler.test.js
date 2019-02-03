const Compiler = require('../../src/graphql/compiler');
const PostgreSQL = require('../../src/adapters/postgres');
const knex = require('knex');
const connection = require('../connection.json');
const db = knex(connection);

const dbSchema = {
  "bar": {
    "__pk": "foo",
    "__reverse": [],
    "bar": {
      "__foreign": {
        "columnname": "bar",
        "schemaname": "public",
        "tablename": "foo"
      },
      "data_type": "integer",
      "is_nullable": "YES",
      "name": "bar"
    },
    "foo": {
      "data_type": "integer",
      "is_nullable": "NO",
      "name": "foo"
    }
  },
  "foo": {
    "__pk": "bar",
    "__reverse": [
      {
        "columnname": "bar",
        "fcolumnname": "bar",
        "fschemaname": "public",
        "ftablename": "bar"
      }
    ],
    "bar": {
      "data_type": "integer",
      "is_nullable": "NO",
      "name": "bar"
    }
  }
};

const schema = `type Bar {
  bar: Int,
  foo: Int,
  foo: Foo
}

type PageBar{
  total: Int,
  tablename: String,
  items: [Bar]
}

type Foo {
  bar: Int,
  bar: PageBar
}

type PageFoo{
  total: Int,
  tablename: String,
  items: [Foo]
}

type Query {

  getPageBar(filter: String, pagination: String): PageBar
  getFirstOfBar(filter: String, pagination: String): Bar
  getPageFoo(filter: String, pagination: String): PageFoo
  getFirstOfFoo(filter: String, pagination: String): Foo
}

type Mutation {

  putItemBar(bar: Int, foo: Int): Bar
  putItemFoo(bar: Int): Foo
}`

const invaliddbSchema = {
  "bar": {
    "__reverse": [],
    "id": {
      "data_type": "ops",
      "name": "id"
    }
  }
};

test('it should create a new Graphql compiler', () => {
  const compiler = new Compiler();
  expect(compiler instanceof Compiler).toBe(true);
});

test('it should map database table to graphql type', () => {
  const dbDriver = new PostgreSQL(null, dbSchema);
  const compiler = new Compiler(dbSchema, dbDriver);
  let result = compiler.mapDbTableToGraphqlType('foo');
  let expected = "type Foo {\n  bar: Int,\n  bar: PageBar\n}";
  expect(result).toEqual(expected);

  // Add reverse relations
  result = compiler.mapDbTableToGraphqlType('bar');
  expect(result).toEqual("type Bar {\n  bar: Int,\n  foo: Int,\n  foo: Foo\n}");
});

test('invalid database type', () => {
  const dbDriver = new PostgreSQL(null, invaliddbSchema);
  const compiler = new Compiler(invaliddbSchema, dbDriver);
  let result = compiler.mapDbTableToGraphqlType('bar');
  expect(result).toEqual("type Bar {\n\n}");
});

test('it should create a page type definition for tablename', () => {
  const dbDriver = new PostgreSQL(null, dbSchema);
  const compiler = new Compiler(dbDriver, dbSchema);
  let result = compiler.mapDbTableToGraphqlPage('foo');
  let expected = "type PageFoo{\n  total: Int,\n  tablename: String,\n  items: [Foo]\n}";
  expect(result).toEqual(expected);
});

test('it should create a getPage definition for tablename', () => {
  const dbDriver = new PostgreSQL(null, dbSchema);
  const compiler = new Compiler(dbDriver, dbSchema);
  let result = compiler.mapDbTableToGraphqlQuery('foo');
  let expected = "getPageFoo(filter: String, pagination: String): PageFoo";
  expect(result).toEqual(expected);
});

test('it should create a getFirstOf definition for tablename', () => {
  const dbDriver = new PostgreSQL(null, dbSchema);
  const compiler = new Compiler(dbDriver, dbSchema);
  let result = compiler.mapDbTableToGraphqlFirstOf('foo');
  let expected = "getFirstOfFoo(filter: String, pagination: String): Foo";
  expect(result).toEqual(expected);
});

test('it should create a putItem definition for tablename', () => {
  const dbDriver = new PostgreSQL(db, dbSchema);
  const compiler = new Compiler(dbSchema, dbDriver);
  let result = compiler.mapDbTableToGraphqlMutation('foo');
  expect(result).toEqual("putItemFoo(bar: Int): Foo");
});

test('invalid field on create putItem definition', () => {
  const dbDriver = new PostgreSQL(null, invaliddbSchema);
  const compiler = new Compiler(invaliddbSchema, dbDriver);
  let result = compiler.mapDbTableToGraphqlMutation('bar');
  expect(result).toEqual("putItemBar: Bar");
});

test('it should create a complete dbSchema definition', () => {
  const dbDriver = new PostgreSQL(db, dbSchema);
  const compiler = new Compiler(dbSchema, dbDriver);
  let result = compiler.getSchema();
  expect(result).toEqual(schema);
  result = compiler.getSchema();
  expect(result).toEqual(schema);
});

test('it should create an empty dbSchema', () => {
  let dbDriver = new PostgreSQL(db, {});
  let compiler = new Compiler({}, dbDriver);
  let result = compiler.getSchema();
  expect(result).toEqual('');
});

test('it should build a query params definition', () => {
  let compiler = new Compiler();
  let result = compiler.buildParamsFromObject({ bar: 'Boolean!' });
  expect(result).toEqual("(bar: Boolean!)");
});

test('it should build a query definition', () => {
  let compiler = new Compiler();
  let result = compiler.buildQuery('getFoo', 'Boolean', { bar: 'Boolean!' });
  expect(result).toEqual("getFoo(bar: Boolean!): Boolean");
});

test('it should add a type definition', () => {
  let dbDriver = new PostgreSQL(db, schema);
  let compiler = new Compiler(schema, dbDriver);
  compiler.addRaw('type Foo { bar: Boolean }');
  let result = compiler.getSchema(false, false);
  expect(result).toEqual("type Foo { bar: Boolean }\n\n");
});

test('it should add a query definition', () => {
  let dbDriver = new PostgreSQL(db, schema);
  let compiler = new Compiler(schema, dbDriver);
  compiler.addQuery('getFoo: Foo')
  let result = compiler.getSchema(false, false);
  expect(result).toEqual("type Query {\n  getFoo: Foo\n}\n\n");
});

test('it should add a mutation definition', () => {
  let dbDriver = new PostgreSQL(db, schema);
  let compiler = new Compiler(schema, dbDriver);
  compiler.addMutation('putFoo(bar: Boolean): Foo');
  let result = compiler.getSchema(false, false);
  expect(result).toEqual("type Mutation {\n  putFoo(bar: Boolean): Foo\n}");
});
