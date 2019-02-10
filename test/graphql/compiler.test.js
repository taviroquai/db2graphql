const Compiler = require('../../src/graphql/compiler');
const PostgreSQL = require('../../src/adapters/postgres');
const knex = require('knex');
const connection = require('../connection.json');
const db = knex(connection);

const dbSchema = {
  "bar": {
    "__pk": "foo",
    "__reverse": [],
    "foo_id": {
      "__foreign": {
        "columnname": "id",
        "schemaname": "public",
        "tablename": "foo"
      },
      "data_type": "integer",
      "is_nullable": "YES",
      "name": "foo_id"
    },
    "id": {
      "data_type": "integer",
      "is_nullable": "NO",
      "name": "id"
    }
  },
  "foo": {
    "__pk": "bar",
    "__reverse": [
      {
        "columnname": "id",
        "fcolumnname": "bar_id",
        "fschemaname": "public",
        "ftablename": "bar"
      }
    ],
    "id": {
      "data_type": "integer",
      "is_nullable": "NO",
      "name": "id"
    }
  }
};

const schema = `type Bar {
  foo_id: Int
  id: Int
  foo: Foo
}

type PageBar {
  total: Int
  items: [Bar]
}

type Query {
  getPageBar(filter: String, pagination: String, _debug: Boolean, _cache: Boolean): PageBar
  getFirstBar(filter: String, pagination: String, _debug: Boolean, _cache: Boolean): Bar
  getPageFoo(filter: String, pagination: String, _debug: Boolean, _cache: Boolean): PageFoo
  getFirstFoo(filter: String, pagination: String, _debug: Boolean, _cache: Boolean): Foo
}

type Mutation {
  putItemBar(_debug: Boolean, foo_id: Int, id: Int): Bar
  putItemFoo(_debug: Boolean, id: Int): Foo
}

type Foo {
  id: Int
  bar(filter: String, pagination: String, _debug: Boolean, _cache: Boolean): PageBar
}

type PageFoo {
  total: Int
  items: [Foo]
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
  let expected = "type Foo {\n  id: Int\n  bar(filter: String, pagination: String, _debug: Boolean, _cache: Boolean): PageBar\n}\n\ntype PageFoo {\n  total: Int\n  items: [Foo]\n}";
  
  // Test non-existsing field
  compiler.mapDbTableToGraphqlType('foo');
  let result = compiler.getSDL(true);
  expect(result).toEqual(expected);

  // Test existing field
  compiler.mapDbTableToGraphqlType('foo');
  result = compiler.getSDL(true);
  expect(result).toEqual(expected);

  // Add reverse relations
  compiler.mapDbTableToGraphqlType('bar');
  result = compiler.getSDL(true);
  expect(result).toEqual("type Foo {\n  id: Int\n  bar(filter: String, pagination: String, _debug: Boolean, _cache: Boolean): PageBar\n}\n\ntype PageFoo {\n  total: Int\n  items: [Foo]\n}\n\ntype Bar {\n  foo_id: Int\n  id: Int\n  foo: Foo\n}\n\ntype PageBar {\n  total: Int\n  items: [Bar]\n}");
});

test('invalid database type', () => {
  const dbDriver = new PostgreSQL(null, invaliddbSchema);
  const compiler = new Compiler(invaliddbSchema, dbDriver);
  compiler.mapDbTableToGraphqlType('bar');
  let result = compiler.getSDL(true);
  expect(result).toEqual("type Bar {\n\n}\n\ntype PageBar {\n  total: Int\n  items: [Bar]\n}");
});

test('it should create a getPage definition for tablename', () => {
  const dbDriver = new PostgreSQL(null, dbSchema);
  const compiler = new Compiler(dbDriver, dbSchema);
  compiler.mapDbTableToGraphqlQuery('foo');
  let result = compiler.getSDL(true);
  let expected = "type Query {\n  getPageFoo(filter: String, pagination: String, _debug: Boolean, _cache: Boolean): PageFoo\n}";
  expect(result).toEqual(expected);
});

test('it should create a getFirst definition for tablename', () => {
  const dbDriver = new PostgreSQL(null, dbSchema);
  const compiler = new Compiler(dbDriver, dbSchema);
  compiler.mapDbTableToGraphqlFirstOf('foo');
  let result = compiler.getSDL(true);
  let expected = "type Query {\n  getFirstFoo(filter: String, pagination: String, _debug: Boolean, _cache: Boolean): Foo\n}";
  expect(result).toEqual(expected);
});

test('it should create a putItem definition for tablename', () => {
  const dbDriver = new PostgreSQL(db, dbSchema);
  const compiler = new Compiler(dbSchema, dbDriver);
  compiler.mapDbTableToGraphqlMutation('foo');
  let result = compiler.getSDL();
  expect(result).toEqual("type Mutation {\n  putItemFoo(_debug: Boolean, id: Int): Foo\n}");
});

test('invalid field on create putItem definition', () => {
  const dbDriver = new PostgreSQL(null, invaliddbSchema);
  const compiler = new Compiler(invaliddbSchema, dbDriver);
  compiler.mapDbTableToGraphqlMutation('bar');
  let result = compiler.getSDL()
  expect(result).toEqual("type Mutation {\n  putItemBar(_debug: Boolean): Bar\n}");
});

test('it should create a complete dbSchema definition', () => {
  const dbDriver = new PostgreSQL(db, dbSchema);
  let compiler = new Compiler(dbSchema, dbDriver);

  // Build schema with database
  compiler.buildSchema();
  let result = compiler.getSDL();
  expect(result).toEqual(schema);

  // Refresh
  compiler.buildSchema();
  result = compiler.getSDL();
  expect(result).toEqual(schema);

  // Build schema without database
  compiler = new Compiler();
  compiler.buildSchema();
  result = compiler.getSDL();
  expect(result).toEqual("");
});

test('it should create an empty dbSchema', () => {
  let dbDriver = new PostgreSQL(db, {});
  let compiler = new Compiler({}, dbDriver);
  let result = compiler.getSDL();
  expect(result).toEqual("");
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

test('it should add a query definition', () => {
  let dbDriver = new PostgreSQL(db, schema);
  let compiler = new Compiler(schema, dbDriver);
  compiler.add('Query', 'getFoo', 'Foo')
  let result = compiler.getSDL(false);
  expect(result).toEqual("type Query {\n  getFoo: Foo\n}");
});

test('it should add a mutation definition', () => {
  let dbDriver = new PostgreSQL(db, schema);
  let compiler = new Compiler(schema, dbDriver);
  compiler.add('Mutation', 'putFoo', 'Foo', { bar: 'Boolean' });
  let result = compiler.getSDL(false);
  expect(result).toEqual("type Mutation {\n  putFoo(bar: Boolean): Foo\n}");
});
