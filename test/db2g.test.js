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

test('it should throw error on missing knex connection', () => {
  expect(() => {
    new db2g();
  }).toThrow(new Error('A Knex connection is missing'));
});

test('it should throw error on invalid database driver', () => {
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
  expect(() => {
    new db2g(MockKnex1);
  }).toThrow(new Error('Database driver not available'));
});

test('it should create a new db2g instance', () => {
  const api = new db2g(MockKnex);
  expect(api instanceof db2g).toBe(true);
});

test('it should initialize without errors', async (done) => {
  const api = new db2g(MockKnex);
  await api.init();
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

test('it should return graphql schema', async (done) => {
  const api = new db2g(MockKnex);
  let result = await api.getSchema();
  expect(result).toEqual(schema);
  result = await api.getSchema();
  expect(result).toEqual(schema);
  done();
});

test('it should return the resolvers', async (done) => {
  const api = new db2g(MockKnex);
  const result = await api.getResolvers();
  expect(typeof result).toEqual('object');
  expect(typeof result.Query).toEqual('object');
  expect(typeof result.Mutation).toEqual('object');
  done();
});

test('it should add a graphql type', async (done) => {
  const api = new db2g(MockKnex);
  await api.init();
  api.addType('type Foo { bar: Boolean }');
  const result = await api.getSchema(false, false);
  expect(result).toEqual("type Foo { bar: Boolean }\n\n");
  done();
});

test('it should add a graphql query', async (done) => {
  const api = new db2g(MockKnex);
  await api.init();
  api.addQuery('getFoo: Foo');
  const result = await api.getSchema(false, false);
  expect(result).toEqual("type Query {\n  getFoo: Foo\n}\n\n");
  done();
});

test('it should add a graphql mutation', async (done) => {
  const api = new db2g(MockKnex);
  await api.init();
  api.addMutation('putFoo(bar: Boolean): Foo');
  const result = await api.getSchema(false, false);
  expect(result).toEqual("type Mutation {\n  putFoo(bar: Boolean): Foo\n}");
  done();
});

test('it should add a resolver', async (done) => {
  const api = new db2g(MockKnex);
  await api.init();
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

test('it should override a built-in resolver', async (done) => {
  const api = new db2g(MockKnex);
  await api.init();
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