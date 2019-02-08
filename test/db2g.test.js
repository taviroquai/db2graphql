const db2g = require('../src/db2g');
const knex = require('knex');
const connection = require('./connection.json');
const db = knex(connection);

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
    const api = new db2g(new MockKnex());
    try {
      await api.connect();
    } catch (err) {
      expect(err.message).toMatch('Database driver not available');
    }
    done();
  });

  test('it should create a new db2g instance', () => {
    const api = new db2g(db);
    expect(api instanceof db2g).toBe(true);
  });

  test('it should initialize without errors', async (done) => {
    const api = new db2g(db);
    await api.connect();
    done();
  });

  test('it should return database schema', async (done) => {
    await db.schema.dropTableIfExists('bar');
    await db.schema.dropTableIfExists('foo');
    const api = new db2g(db);
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

    const schema = `type Foo {
  bar: Int
}

type PageFoo{
  total: Int,
  tablename: String,
  items: [Foo]
}

type Query {

  getPageFoo(filter: String, pagination: String, _debug: Boolean, _cache: Boolean): PageFoo
  getFirstOfFoo(filter: String, pagination: String, _debug: Boolean, _cache: Boolean): Foo
}

type Mutation {

  putItemFoo(_debug: Boolean, bar: Int): Foo
}`
    const api = new db2g(db);
    await api.connect();
    let result = await api.getDatabaseSchema();
    result = api.getSchema();
    expect(result).toEqual(schema);
    result = api.getSchema();
    expect(result).toEqual(schema);
    done();
  });

  test('it should override a built-in resolver', async (done) => {
    
    // Setup database
    await db.schema.dropTableIfExists('bar');
    await db.schema.dropTableIfExists('foo');
    await db.schema.createTable('foo', (table) => {
      table.integer('bar').primary();
    });
    await db.schema.createTable('bar', (table) => {
      table.integer('foo').primary();
      table.integer('bar');
      table.foreign('bar').references('foo.bar')
    });

    const api = new db2g(db);
    await api.connect();
    const resolver1 = (root, args, context) => {
      const { resolver, tablename } = context.ioc;
      expect(typeof resolver).toEqual('object');
      expect(tablename).toEqual('foo');
      done();
    };
    api.override('getPage', resolver1);
    const result = api.getResolvers();
    expect(typeof result).toEqual('object');
    expect(typeof result.Query).toEqual('object');
    expect(typeof result.Query.getPageFoo).toEqual('function');
    await result.Query.getPageFoo(null, {}, {});
  });

  test('it should return graphql schema without connect to database', async (done) => {
    const api = new db2g();
    let result = api.getSchema();
    expect(result).toEqual('');
    done();
  });

  test('it should return the resolvers without connect to database', async (done) => {
    const api = new db2g();
    const result = api.getResolvers();
    expect(typeof result).toEqual('object');
    expect(typeof result.Query).toEqual('object');
    expect(typeof result.Mutation).toEqual('object');
    done();
  });

  test('it should add a graphql type without connect to database', async (done) => {
    const api = new db2g();
    api.addType('type Foo { bar: Boolean }');
    const result = api.getSchema();
    expect(result).toEqual("type Foo { bar: Boolean }\n\n");
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

    const api = new db2g(db);
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
      .addType("type Fooz {\n  name: String\n}")
      .addQuery("getFooz", "Fooz", resolver1)
      .addMutation("putFooz", "Fooz", resolver1)
    const result = api.getResolvers();
    expect(typeof result).toEqual('object');
    expect(typeof result.Query).toEqual('object');
    expect(typeof result.Query.getFooz).toEqual('function');
    done();
  });

  test('it should add a graphql query', async (done) => {
    const api = new db2g();
    api.addQuery('getFoo', 'Foo', (root, args, context) => {});
    const result = api.getSchema();
    expect(result).toEqual("type Query {\n  getFoo: Foo\n}\n\n");
    done();
  });

  test('it should add a graphql mutation', async (done) => {
    const api = new db2g();
    api.addMutation('putFoo', 'Foo', (root, args, context) => {});
    const result = api.getSchema();
    expect(result).toEqual("type Mutation {\n  putFoo: Foo\n}");
    done();
  });

  test('it should add a graphql mutation with params', async (done) => {
    const api = new db2g();
    api.addMutation('putFoo', 'Foo', (root, args, context) => {}, { bar: 'Boolean' });
    const result = api.getSchema();
    expect(result).toEqual("type Mutation {\n  putFoo(bar: Boolean): Foo\n}");
    done();
  });
});