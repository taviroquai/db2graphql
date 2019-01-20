const db2g = require('../src/db2g');

const dbSchema = {"bar": {"__pk": "foo_id", "__reverse": [], "foo_id": {"__foreign": {"columnname": "id", "schemaname": "public", "tablename": "foo"}, "data_type": "bigint", "is_nullable": undefined, "name": "foo_id"}, "id": {"data_type":"bigint", "is_nullable": undefined, "name": "id"}}, "foo": {"__pk": null, "__reverse": [{"columnname": "id", "fcolumnname": "foo_id", "fschemaname": undefined, "ftablename": "bar"}], "id": {"data_type": "bigint", "is_nullable":undefined, "name": "id"}}};
const schema = `type Foo {
  id: Int,
  bar: [Bar]
}

type PageFoo{
  total: Int,
  tablename: String,
  items: [Foo]
}

type Bar {
  id: Int,
  foo_id: Int,
  foo: Foo
}

type PageBar{
  total: Int,
  tablename: String,
  items: [Bar]
}

type Query {

  getPageFoo(filter: String, pagination: String): PageFoo
  getFirstOfFoo(filter: String, pagination: String): Foo
  getPageBar(filter: String, pagination: String): PageBar
  getFirstOfBar(filter: String, pagination: String): Bar
}

type Mutation {

  putItemFoo (
    id: Int
  ): Foo
  putItemBar (
    id: Int,
    foo_id: Int
  ): Bar
}`;

const config = {
  client: 'pg'
};
const MockKnex = {
  connection: () => {
    return {
      client: {
        config
      }
    }
  },
  raw: (sql, params) => {
    if (/from.information_schema\.tables/i.test(sql)) {
      let mock = require('./mocks/mockPostgresGetTables');
      return mock.result;
    }
    if (/from.information_schema\.columns/i.test(sql)) {
      if (params[1] === 'bar') return { rows: [
        { name: 'id', data_type: 'bigint' },
        { name: 'foo_id', data_type: 'bigint' },
      ]};
      return { rows: [
        { name: 'id', data_type: 'bigint' }
      ]};
    }
    if (/information_schema\.table_constraints/i.test(sql)) {
      if (params[1] === 'bar') return { rows: [{
        tablename: 'bar',
        columnname: 'foo_id',
        ftableschema: 'public',
        ftablename: 'foo',
        fcolumnname: 'id'
      }] };
      return { rows: []};
    }
  }
};

test('it should throw error on invalid database driver', async (done) => {
  const MockKnex1 = {
    connection: () => {
      return {
        client: {
          config: {
            client: 'sqlite'
          }
        }
      }
    }
  };
  const api = new db2g(MockKnex1);
  try {
    await api.connect();
  } catch (err) {
    expect(err.message).toMatch('Database driver not available');
  }
  done();
});

test('it should create a new db2g instance', () => {
  const api = new db2g(MockKnex);
  expect(api instanceof db2g).toBe(true);
});

test('it should initialize without errors', async (done) => {
  const api = new db2g(MockKnex);
  await api.connect();
  done();
});

test('it should return database schema', async (done) => {
  const api = new db2g(MockKnex);
  let result = await api.getDatabaseSchema();
  expect(result).toEqual(dbSchema);
  result = await api.getDatabaseSchema();
  expect(result).toEqual(dbSchema);
  done();
});

test('it should return graphql schema from database', async (done) => {
  const api = new db2g(MockKnex);
  await api.connect();
  let result = await api.getSchema();
  expect(result).toEqual(schema);
  result = await api.getSchema();
  expect(result).toEqual(schema);
  done();
});

test('it should override a built-in resolver', async (done) => {
  const api = new db2g(MockKnex);
  await api.connect();
  const resolver1 = (root, args, context) => {
    const { resolver, tablename } = context.ioc;
    expect(typeof resolver).toEqual('object');
    expect(tablename).toEqual('foo');
    done();
  };
  api.override('getPage', resolver1);
  const result = await api.getResolvers();
  expect(typeof result).toEqual('object');
  expect(typeof result.Query).toEqual('object');
  expect(typeof result.Query.getPageFoo).toEqual('function');
  await result.Query.getPageFoo(null, {}, {});
});

test('it should return graphql schema without connect to database', async (done) => {
  const api = new db2g();
  let result = await api.getSchema();
  expect(result).toEqual('');
  done();
});

test('it should return the resolvers without connect to database', async (done) => {
  const api = new db2g();
  const result = await api.getResolvers();
  expect(typeof result).toEqual('object');
  expect(typeof result.Query).toEqual('object');
  expect(typeof result.Mutation).toEqual('object');
  done();
});

test('it should add a graphql type without connect to database', async (done) => {
  const api = new db2g();
  api.addType('type Foo { bar: Boolean }');
  const result = await api.getSchema();
  expect(result).toEqual("type Foo { bar: Boolean }\n\n");
  done();
});

test('it should add a graphql query without connect to database', async (done) => {
  const api = new db2g();
  api.addQuery('getFoo: Foo');
  const result = await api.getSchema();
  expect(result).toEqual("type Query {\n  getFoo: Foo\n}\n\n");
  done();
});

test('it should add a graphql mutation', async (done) => {
  const api = new db2g();
  api.addMutation('putFoo(bar: Boolean): Foo');
  const result = await api.getSchema();
  expect(result).toEqual("type Mutation {\n  putFoo(bar: Boolean): Foo\n}");
  done();
});

test('it should add a resolver', async (done) => {
  const api = new db2g();
  const resolver1 = (root, args, context) => {
    const { resolver } = context.ioc;
    expect(typeof resolver).toEqual('object');
    done();
  };
  api.addResolver('Query', 'getFoo', resolver1);
  const result = await api.getResolvers();
  expect(typeof result).toEqual('object');
  expect(typeof result.Query).toEqual('object');
  expect(typeof result.Query.getFoo).toEqual('function');
  await result.Query.getFoo(null, {}, {});
});
