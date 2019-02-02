const PostgreSQL = require('../../src/adapters/postgres');
const knex = require('knex');
const connection = require('../connection.json');

// Create database connection
db = knex(connection);

beforeEach(async done => {
  await db.schema.dropTableIfExists('bar');
  await db.schema.dropTableIfExists('foo');
  done();
});

test('it should return the available database column types', () => {
  const result = PostgreSQL.getAvailableTypes();
  expect(result instanceof Array).toEqual(true);
});

test('it should create a new PostgreSQL adapter', () => {
  const adapter = new PostgreSQL();
  expect(adapter instanceof PostgreSQL).toBe(true);
});

test('translate database data type tp graphql native type', () => {
  const adapter = new PostgreSQL();
  const columns = [
    { data_type: 'boolean', toBe: 'Boolean' },
    { data_type: 'numeric', toBe: 'Float' },
    { data_type: 'integer', toBe: 'Int' },
    { data_type: 'bigint', toBe: 'Int' },
    { data_type: 'timestamp with time zone', toBe: 'String' },
    { data_type: 'character varying', toBe: 'String' },
    { data_type: 'text', toBe: 'String' },
    { data_type: 'USER-DEFINED', toBe: 'String' }
  ];
  columns.forEach(c => {
    let result = adapter.mapDbColumnToGraphqlType('test', c);
    expect(result).toBe(c.toBe);
  });
});

test('translate database data type tp graphql native type', () => {
  const adapter = new PostgreSQL();
  expect(() => {
    adapter.mapDbColumnToGraphqlType('test', { data_type: 'foo' });
  }).toThrow(new Error('Undefined column type: foo of column test'));
});

test('it should convert condition to where clause', async (done) => {
  const adapter = new PostgreSQL();
  const mock = require('../mocks/mockPostgresConvertConditionToWhere');
  await adapter.convertConditionToWhereClause(mock.query, ['=', 'id', 1]);
  await adapter.convertConditionToWhereClause(mock.query, ['~', 'id', 'text']);
  await adapter.convertConditionToWhereClause(mock.query, ['#', 'id', 'text']);
  await adapter.convertConditionToWhereClause(mock.query, ['<=>', 'id', 1]);
  done();
});

test('it should add where clause from args', async (done) => {
  const adapter = new PostgreSQL();
  const mock = require('../mocks/mockPostgresAddWhereFromArgs');
  await adapter.addWhereFromArgs(mock.tablename, mock.query, mock.args);
  await adapter.addWhereFromArgs(mock.tablename, mock.query, mock.argsEmpty);
  done();
});

test('it should add pagination from args', async (done) => {
  const adapter = new PostgreSQL();
  const mock = require('../mocks/mockPostgresAddPaginationFromArgs');
  await adapter.addPaginationFromArgs(mock.tablename, mock.query, mock.args);
  await adapter.addPaginationFromArgs(mock.tablename, mock.query, mock.argsEmpty);
  done();
});

test('it should run a raw query', async (done) => {
  const adapter = new PostgreSQL(db);
  const result = await adapter.query('select 1', []);
  expect(typeof result).toEqual('object');
  expect(typeof result.rowCount).toEqual('number');
  expect(Array.isArray(result.rows)).toBe(true);
  done();
});

test('it should return a page of items', async (done) => {

  // Fixtures
  const schema = { foo: [] };
  schema.foo.__pk = 'id';
  schema.foo.__reverse = [];
  await db.schema.createTable('foo', (table) => {
    table.increments('id').primary();
  });

  // Test
  const adapter = new PostgreSQL(db, schema);
  const result = await adapter.page('foo', {});
  expect(typeof result).toBe("object");
  done();
});

test('it should return a total of items', async (done) => {
  
  // Fixtures
  const schema = { foo: [] };
  schema.foo.__pk = 'id';
  schema.foo.__reverse = [];
  await db.schema.createTable('foo', (table) => {
    table.increments('id').primary();
  });

  // Test
  const adapter = new PostgreSQL(db);
  const result = await adapter.pageTotal('foo', schema);
  expect(typeof result).toBe("number");
  done();
});

test('it should return one item', async (done) => {

  // Fixtures
  const schema = { foo: [] };
  schema.foo.__pk = 'id';
  schema.foo.__reverse = [];
  await db.schema.createTable('foo', (table) => {
    table.increments('id').primary();
  });
  await db('foo').insert({});

  // Test
  const adapter = new PostgreSQL(db, schema);
  const result = await adapter.firstOf('foo', {});
  expect(typeof result).toBe("object");
  done();
});

test('it should save one item and return it', async (done) => {
  
  // Fixtures
  const schema = { foo: [] };
  schema.foo.__pk = 'id';
  schema.foo.__reverse = [];
  await db.schema.createTable('foo', (table) => {
    table.increments('id').primary();
  });
  
  const adapter = new PostgreSQL(db, schema);
  let result = await adapter.putItem('foo', {});
  expect(typeof result).toBe("object");
  result = await adapter.putItem('foo', { id: 1 });
  expect(typeof result).toBe("number");
  done();
});

test('should build sql fragment condition', () => {
  const adapter = new PostgreSQL();
  const result = adapter.getExcludeCondition(['foo']);
  expect(result).toBe("AND table_name NOT IN (?)");
});

test('it should return the database tables', async (done) => {
  const adapter = new PostgreSQL();

  // Mock adapter query
  adapter.query = async () => { return { rows: []} };
  const result = await adapter.getTables();
  expect(result).toEqual([]);
  done();
});

test('it should return the database columns for table', async (done) => {
  const adapter = new PostgreSQL();
  const expected = [{ "name": "foo", "data_type": "integer" }];
  adapter.query = async () => ({ rows: expected });
  const result = await adapter.getColumns();
  expect(result).toEqual(expected);
  done();
});

test('it should return the table foreign keys', async (done) => {
  const adapter = new PostgreSQL();
  const expected = [{ columnname: 'bar', ftableschema: 'public', ftablename: 'bar', fcolumnname: 'foo'}];
  adapter.query = async () => ({ rows: expected });
  const result = await adapter.getForeignKeys();
  expect(result).toEqual(expected);
  done();
});

test('it should return the table primary key', async (done) => {
  const adapter = new PostgreSQL();
  const expected = 'id';
  adapter.query = async () => ({ rows: [{ columnname: expected }] });
  let result = await adapter.getPrimaryKey();
  expect(result).toEqual(expected);
  done();
});

test('it should return no primary key', async (done) => {
  const adapter = new PostgreSQL();

  // Mock adapter query
  adapter.query = async () => { return { rows: []} };
  let result = await adapter.getPrimaryKey();
  expect(result).toEqual(null);
  done();
});

test('it should return the list of tables from schema', async (done) => {
  const schema = {
    foo: {
      bar: {}
    }
  }
  const adapter = new PostgreSQL(null, schema);
  const result = await adapter.getTablesFromSchema();
  expect(result).toEqual(['foo']);
  done();
});

test('it should return the list of columns from schema', async (done) => {
  const schema = {
    foo: {
      bar: {}
    }
  }
  const adapter = new PostgreSQL(null, schema);
  const result = await adapter.getTableColumnsFromSchema('foo');
  expect(result).toEqual(['bar']);
  done();
});

test('it should return the table primary key from schema', async (done) => {
  const schema = {
    foo: {
      __pk: 'bar'
    }
  }
  const adapter = new PostgreSQL(null, schema);
  const result = await adapter.getPrimaryKeyFromSchema('foo');
  expect(result).toEqual('bar');
  done();
});

test('it should return the complete database schema as json', async (done) => {

  // Fixtures
  const expected = {
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

  const adapter = new PostgreSQL(db);
  const result = await adapter.getSchema();
  expect(result).toEqual(expected);
  done();
});

test('it should return the complete database schema as json without excluded items', async (done) => {
  
  // Fixtures
  const expected = {
    "bar": {
      "__pk": "foo",
      "__reverse": [],
      "foo": {
        "data_type": "integer",
        "is_nullable": "NO",
        "name": "foo"
      }
    }
  };

  // Setup database
  await db.schema.dropTableIfExists('bar');
  await db.schema.dropTableIfExists('foo');
  await db.schema.createTable('foo', (table) => {
    table.integer('bar').primary();
  });
  await db.schema.createTable('bar', (table) => {
    table.integer('foo').primary();
  });

  const adapter = new PostgreSQL(db);
  const result = await adapter.getSchema('public', ['foo']);
  expect(result).toEqual(expected);
  done();
});

test('it should load items from table using records ids', async (done) => {
  
  // Fixtures
  const expected = [
    { foo: 1 },
    { foo: 2 }
  ];

  // Setup database
  await db.schema.dropTableIfExists('bar');
  await db.schema.createTable('bar', (table) => {
    table.integer('foo').primary();
  });
  await db('bar').insert({ foo: 1 });
  await db('bar').insert({ foo: 2 });

  const adapter = new PostgreSQL(db);
  await adapter.getSchema('public');
  let result = await adapter.loadItemsIn('bar', 'foo', '1,2');
  expect(result).toEqual(expected);
  result = await adapter.loadItemsIn('bar', 'foo', '1,2', 2);
  expect(result).toEqual(expected);
  result = await adapter.loadItemsIn('bar', 'foo', '1,2', null, {});
  expect(result).toEqual(expected);
  result = await adapter.loadItemsIn('bar', 'foo', '1,2', null, { bar: {}});
  expect(result).toEqual(expected);
  result = await adapter.loadItemsIn('bar', 'foo', '1,2', null, { bar: {'1': { foo: 1 }}});
  expect(result).toEqual(expected);
  
  done();
});

xtest('it should load foreign records', async (done) => {
  const schema = {
    mockPostgresLoadForeignFoo: {
      __pk: 'id',
      __reverse: [],
      id: {
        name: 'id',
        is_nullable: false,
        data_type: 'bigint'
      },
      bar_id: {
        name: 'id',
        is_nullable: false,
        data_type: 'bigint',
        __foreign: {
          schemaname: 'public',
          tablename: 'mockPostgresLoadForeignBar',
          columnname: 'id'
        }
      },
    },
    mockPostgresLoadForeignBar: {
      __pk: 'id',
      __reverse: [],
      id: {
        name: 'id',
        is_nullable: false,
        data_type: 'bigint'
      }
    }
  };
  const adapter = new PostgreSQL(knex(), schema);
  const mock = require('../mocks/mockPostgresLoadForeignFoo');

  // Mock firstOf method
  adapter.firstOf = async (tablename, args) => ({});
  await adapter.loadForeignItems([mock.item], mock.tablename, mock.args);
  expect(mock.item).toEqual(mock.toEqual);
  done();
});

xtest('it should load reverse related records', async (done) => {
  const schema = {
    mockPostgresLoadReverseFoo: {
      __pk: 'id',
      __reverse: [],
      id: {
        name: 'id',
        is_nullable: false,
        data_type: 'bigint'
      },
      bar_id: {
        name: 'id',
        is_nullable: false,
        data_type: 'bigint',
        __foreign: {
          schemaname: 'public',
          tablename: 'mockPostgresLoadReverseBar',
          columnname: 'id'
        }
      },
    },
    mockPostgresLoadReverseBar: {
      __pk: 'id',
      __reverse: [
        {
          columnname: 'id',
          ftablename: 'mockPostgresLoadReverseFoo',
          fcolumnname: 'bar_id'
        }
      ],
      id: {
        name: 'id',
        is_nullable: false,
        data_type: 'bigint'
      }
    }
  };
  const adapter = new PostgreSQL(knex(), schema);

  // Mock page method
  adapter.page = async (tablename, args) => {
    return [{ id: 1}];
  }
  const mock = require('../mocks/mockPostgresLoadReverseBar');
  await adapter.loadReverseItems([mock.item], mock.tablename, mock.args);
  done();
});
