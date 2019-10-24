const db2g = require('../src/db2g');
const knex = require('knex');
const connection = require('./connection.json');
const db = knex(connection);

const inputCondition = "\n\ninput Condition {\n  sql: String!\n  val: [String!]!\n}";

afterAll( async (done) => {
  await db.destroy();
  done();
});

beforeEach(async (done) => {
  await db.schema.dropTableIfExists('foo');
  await db.schema.dropTableIfExists('bar');
  done();
});

describe('Db2graphql', () => {

  test('it should throw error on invalid database', async (done) => {
    const api = new db2g();
    try {
      await api.connect();
    } catch (err) {
      expect(err.message).toMatch('Invalid Knex instance');
    }
    done();
  });

  test('it should throw error on invalid database driver', async (done) => {
    function MockKnex() {
      this.connection = function() {
        return {
          client: {
            config: {
              client: 'sqlite'
            }
          }
        }
      }
    };
    const api = new db2g('test2', new MockKnex());
    try {
      await api.connect();
    } catch (err) {
      expect(err.message).toMatch('Database driver not available');
    }
    done();
  });

  test('it should create a new db2g instance', () => {
    const api = new db2g('test', db);
    expect(api instanceof db2g).toBe(true);
  });

  test('it should initialize without errors', async (done) => {
    const api = new db2g('test', db);
    await api.connect();
    done();
  });

  test('it should return database schema', async (done) => {
    await db.schema.dropTableIfExists('bar');
    await db.schema.dropTableIfExists('foo');
    const api = new db2g('test', db);
    let result = await api.getDatabaseSchema();
    expect(result).toEqual({});
    result = await api.getDatabaseSchema();
    expect(result).toEqual({});
    done();
  });

  test('it should return graphql schema from database', async (done) => {
    await db.schema.dropTableIfExists('bar');
    await db.schema.dropTableIfExists('foo');
    await db.schema.createTable('foo', (table) => {
      table.integer('bar').primary();
    });

    const schema = `type Query {
  getAPIName: String
  getPageFoo(filter: String, pagination: String, where: Condition, _debug: Boolean, _cache: Boolean): PageFoo
  getFirstFoo(filter: String, pagination: String, where: Condition, _debug: Boolean, _cache: Boolean): Foo
}

type Foo {
  bar: Int
}

type PageFoo {
  total: Int
  items: [Foo]
}

type Mutation {
  putItemFoo(_debug: Boolean, input: InputFoo!): Foo
}

input InputFoo {
  bar: Int
}

input Condition {
  sql: String!
  val: [String!]!
}`
    const api = new db2g('test', db);
    await api.connect();
    let result = await api.getDatabaseSchema();
    result = api.getSchema();
    expect(result).toEqual(schema);
    result = api.getSchema();
    expect(result).toEqual(schema);
    done();
  });

  test('it should return graphql schema without connect to database', async (done) => {
    const api = new db2g();
    let result = api.getSchema();
    expect(result).toEqual('');
    done();
  });

  test('it should return the no resolvers without connect to database', async (done) => {
    const api = new db2g();
    const result = api.getResolvers();
    expect(typeof result).toEqual('object');
    expect(typeof result.Query).toEqual('undefined');
    expect(typeof result.Mutation).toEqual('undefined');
    done();
  });

  test('it should add a graphql type without connect to database', async (done) => {
    const api = new db2g();
    api.add('Foo', 'bar', 'Boolean');
    const result = api.getSchema();
    let expected = "type Foo {\n  bar: Boolean\n}"
     + inputCondition;
    expect(result).toEqual(expected);
    done();
  });

  test('it should add the builder', async (done) => {
    const api = new db2g();
    api.withBuilder();
    const result = api.getResolvers();
    expect(typeof result).toEqual('object');
    expect(typeof result.Query).toEqual('object');
    expect(typeof result.Query.getSchema).toEqual('function');
    expect(typeof result.Query.addSchemaTable).toEqual('function');
    expect(typeof result.Query.dropSchemaTable).toEqual('function');
    expect(typeof result.Query.addSchemaColumn).toEqual('function');
    expect(typeof result.Query.dropSchemaColumn).toEqual('function');
    done();
  });

  test('it should run builder queries without errors', async (done) => {

    const api = new db2g('test', db);
    await api.connect();
    api.withBuilder();
    const resolvers = api.getResolvers();
    await resolvers.Query.getSchema(null, {}, {});

    let result, args;

    await db.schema.dropTableIfExists('bar');
    await db.schema.dropTableIfExists('foo');
    args = { type: "ops", tablename: 'foo', primary: "id" };
    result = await resolvers.Query.addSchemaTable(null, args, {});
    expect(result).toEqual(false);

    await db.schema.dropTableIfExists('bar');
    await db.schema.dropTableIfExists('foo');
    args = { type: "integer", tablename: 'foo', primary: "id" };
    result = await resolvers.Query.addSchemaTable(null, args, {});
    expect(result).toEqual(true);
    result = await resolvers.Query.addSchemaTable(null, args, {});
    expect(result).toEqual(false);

    await db.schema.dropTableIfExists('foo');
    args = { type: "integer", tablename: 'foo', primary: "id", increments: true };
    result = await resolvers.Query.addSchemaTable(null, args, {});
    expect(result).toEqual(true);

    await db.schema.dropTableIfExists('foo');
    await db.schema.createTable('foo', (table) => {
      table.integer('foo').primary();
    });
    result = await resolvers.Query.dropSchemaTable(null, { tablename: "foo" }, {});
    expect(result).toEqual(true);
    result = await resolvers.Query.dropSchemaTable(null, { tablename: "foo" }, {});
    expect(result).toEqual(false);

    await db.schema.dropTableIfExists('foo');
    await db.schema.createTable('foo', (table) => {
      table.integer('foo').primary();
    });
    args = { tablename: 'foo', columnname: 'foo', type: 'ops' };
    result = await resolvers.Query.addSchemaColumn(null, args, {});
    expect(result).toEqual(false);

    await db.schema.dropTableIfExists('foo');
    await db.schema.createTable('foo', (table) => {
      table.integer('id').primary();
    });
    args = { tablename: 'foo', columnname: 'foo', type: 'integer' };
    result = await resolvers.Query.addSchemaColumn(null, args, {});
    expect(result).toEqual(true);

    await db.schema.dropTableIfExists('bar');
    await db.schema.dropTableIfExists('foo');
    await db.schema.createTable('foo', (table) => {
      table.integer('foo').primary();
    });
    await db.schema.createTable('bar', (table) => {
      table.integer('bar').primary();
    });
    args = { tablename: "foo", type: "integer", columnname: "foz", foreign: "bar.bar" }
    result = await resolvers.Query.addSchemaColumn(null, args, {});
    expect(result).toEqual(true);

    await db.schema.dropTableIfExists('foo');
    await db.schema.createTable('foo', (table) => {
      table.integer('id').primary();
    });
    args = { tablename: 'foo', columnname: 'foo', type: 'integer', unique: true };
    result = await resolvers.Query.addSchemaColumn(null, args, {});
    expect(result).toEqual(true);

    await db.schema.dropTableIfExists('foo');
    await db.schema.createTable('foo', (table) => {
      table.integer('id').primary();
    });
    args = { tablename: 'foo', columnname: 'foo', type: 'integer', index: true };
    result = await resolvers.Query.addSchemaColumn(null, args, {});
    expect(result).toEqual(true);
    result = await resolvers.Query.addSchemaColumn(null, args, {});
    expect(result).toEqual(false);

    await db.schema.dropTableIfExists('foo');
    await db.schema.createTable('foo', (table) => {
      table.integer('foo').primary();
      table.integer('bar');
    });
    args = { tablename: 'foo', columnname: "bar" };
    result = await resolvers.Query.dropSchemaColumn(null, args, {});
    expect(result).toEqual(true);
    result = await resolvers.Query.dropSchemaColumn(null, args, {});
    expect(result).toEqual(false);
    done();
  });

  test('it should use fluent interface without errors', async (done) => {
    const resolver1 = () => {};
    const api = new db2g()
    api.withBuilder()
      .add("Fooz", "name", "String")
      .add("Query", "getFooz", "Fooz", resolver1)
      .add("Mutation", "putFooz", "Fooz", resolver1)
    const result = api.getResolvers();
    expect(typeof result).toEqual('object');
    expect(typeof result.Query).toEqual('object');
    expect(typeof result.Query.getFooz).toEqual('function');
    done();
  });

  test('it should add a graphql query', async (done) => {
    const api = new db2g();
    api.add('Query', 'getFoo', 'Foo', (root, args, context) => {});
    const result = api.getSchema();
    let expected = "type Query {\n  getFoo: Foo\n}"
      + inputCondition;
    expect(result).toEqual(expected);
    done();
  });

  test('it should add a graphql mutation', async (done) => {
    const api = new db2g();
    api.add('Mutation', 'putFoo', 'Foo', (root, args, context) => {});
    const result = api.getSchema();
    let expected = "type Mutation {\n  putFoo: Foo\n}"
      + inputCondition;
    expect(result).toEqual(expected);
    done();
  });

  test('it should add a graphql input', async (done) => {
    const api = new db2g();
    api.addInput('InputFoo.bar', 'Foo');
    api.addInput('InputFoo.foo', 'Bar');
    let result = api.getSchema();
    let expected = "input InputFoo {\n  bar: Foo\n  foo: Bar\n}"
      + inputCondition;
    expect(result).toEqual(expected);
    done();
  });

  test('it should throw exception on adding invalid field path', () => {
    const api = new db2g();
    expect(() => {
      api.addField("Query.", 'Foo', (root, args, context) => {});
    }).toThrow(new Error('addField path must be in format Type.field'));
  });

  test('it should throw exception on adding invalid input path', () => {
    const api = new db2g();
    expect(() => {
      api.addInput("Input.", 'Foo', (root, args, context) => {});
    }).toThrow(new Error('addInput path must be in format Input.field'));
  });

  test('it should add a graphql field by path', async (done) => {
    const api = new db2g();
    api.addField("Query.getFoo", 'Foo', (root, args, context) => {});
    const result = api.getSchema();
    let expected = "type Query {\n  getFoo: Foo\n}"
      + inputCondition;
    expect(result).toEqual(expected);
    done();
  });

  test('it should add a graphql mutation with params', async (done) => {
    const api = new db2g();
    api.add('Mutation', 'putFoo', 'Foo', (root, args, context) => {}, { bar: 'Boolean' });
    const result = api.getSchema();
    let expected = "type Mutation {\n  putFoo(bar: Boolean): Foo\n}"
      + inputCondition;
    expect(result).toEqual(expected);
    done();
  });

  test('it should set and pass before hook', async (done) => {
    const api = new db2g();
    const validator = async (type, field, parent, args) => {
      expect(type).toBe('Mutation');
      expect(field).toBe('putFoo');
      return true;
    }
    api.onBefore(validator)
    api.add('Mutation', 'putFoo', 'Foo', (root, args, context) => {
      done();
    });
    const resolvers = api.getResolvers();
    await resolvers.Mutation.putFoo({}, {}, {});
  });

  test('it should set and get denied on before hook', async (done) => {
    const api = new db2g();
    const validator = async () => false;
    api.onBefore(validator);
    api.add('Mutation', 'putFoo', 'Foo', () => {});
    const resolvers = api.getResolvers();
    const result = await resolvers.Mutation.putFoo();
    expect(result).toBeNull();
    done();
  });

  test('it should set and get rejected on before hook', async (done) => {
    const api = new db2g();
    const validator = async (type, field, parent, args) => {
      expect(type).toBe('Mutation');
      expect(field).toBe('putFoo');
      return false;
    }
    const rejected = async (type, field, parent, args) => {
      expect(type).toBe('Mutation');
      expect(field).toBe('putFoo');
      done();
    }
    api.onBefore(validator, rejected)
    api.add('Mutation', 'putFoo', 'Foo', () => {});
    const resolvers = api.getResolvers();
    await resolvers.Mutation.putFoo({}, {}, {});
  });
});
