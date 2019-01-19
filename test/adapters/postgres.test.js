const PostgreSQL = require('../../src/adapters/postgres');
const knex = require('../knex');

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

test('it should return a page of items', async (done) => {
  const adapter = new PostgreSQL(knex());
  const mock = require('../mocks/mockPostgresPageFoo');
  const result = await adapter.page(mock.tablename, mock.args);
  expect(typeof result).toBe("object");
  expect(Array.isArray(result.rows)).toBe(true);
  done();
});

test('it should return a total of items', async (done) => {
  const adapter = new PostgreSQL(knex());
  const mock = require('../mocks/mockPostgresPageTotalFoo');
  const result = await adapter.pageTotal(mock.tablename, mock.args);
  expect(typeof result).toBe("number");
  done();
});

test('it should return one item', async (done) => {
  const schema = {
    mockPostgresFirstOfFoo: []
  };
  schema.mockPostgresFirstOfFoo.__reverse = [];
  const adapter = new PostgreSQL(knex(), schema);
  const mock = require('../mocks/mockPostgresFirstOfFoo');
  const result = await adapter.firstOf(mock.tablename, mock.args);
  expect(typeof result).toBe("object");
  done();
});

test('it should save one item and return it', async (done) => {
  const schema = {
    mockPostgresPutItemFoo: []
  };
  schema.mockPostgresPutItemFoo.__pk = 'id';
  schema.mockPostgresPutItemFoo.__reverse = [];
  const adapter = new PostgreSQL(knex(), schema);
  const mock = require('../mocks/mockPostgresPutItemFoo');
  let result = await adapter.putItem(mock.tablename, mock.argsInsert);
  expect(typeof result).toBe("object");
  result = await adapter.putItem(mock.tablename, mock.argsUpdate);
  expect(typeof result).toBe("object");
  done();
});

test('it should convert condition to where clause', async (done) => {
  const schema = {
    mockPostgresConvertConditionToWhere: []
  };
  schema.mockPostgresConvertConditionToWhere.__pk = 'id';
  const adapter = new PostgreSQL(knex(), schema);
  const mock = require('../mocks/mockPostgresConvertConditionToWhere');
  await adapter.convertConditionToWhereClause(mock.query, ['=', 'id', 1]);
  await adapter.convertConditionToWhereClause(mock.query, ['~', 'id', 'text']);
  await adapter.convertConditionToWhereClause(mock.query, ['#', 'id', 'text']);
  await adapter.convertConditionToWhereClause(mock.query, ['<=>', 'id', 1]);
  done();
});

test('it should add where clause from args', async (done) => {
  const schema = {
    mockPostgresAddWhereFromArgs: []
  };
  schema.mockPostgresAddWhereFromArgs.__pk = 'id';
  const adapter = new PostgreSQL(knex(), schema);
  const mock = require('../mocks/mockPostgresAddWhereFromArgs');
  await adapter.addWhereFromArgs(mock.tablename, mock.query, mock.args);
  done();
});

test('it should add pagination from args', async (done) => {
  const schema = {
    mockPostgresAddPaginationFromArgs: []
  };
  schema.mockPostgresAddPaginationFromArgs.__pk = 'id';
  const adapter = new PostgreSQL(knex(), schema);
  const mock = require('../mocks/mockPostgresAddPaginationFromArgs');
  await adapter.addPaginationFromArgs(mock.tablename, mock.query, mock.args);
  done();
});

test('it should run a raw query', async (done) => {
  const adapter = new PostgreSQL(knex());
  const mock = require('../mocks/mockPostgresQueryFoo');
  const result = await adapter.query(mock.sql, mock.params);
  expect(result).toEqual(mock.toEqual);
  done();
});

test('it should load foreign records', async (done) => {
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
  await adapter.loadForeign(mock.item, mock.tablename, mock.args);
  expect(mock.item).toEqual(mock.toEqual);
  done();
});

test('it should load reverse related records', async (done) => {
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
  const mock = require('../mocks/mockPostgresLoadReverseBar');
  await adapter.loadReverse(mock.item, mock.tablename, mock.args);
  done();
});

test('should build sql fragment condition', () => {
  const adapter = new PostgreSQL(knex());
  const result = adapter.getExcludeCondition(['foo']);
  expect(result).toBe("AND table_name NOT IN (?)");
});

test('it should return the database tables', async (done) => {
  const adapter = new PostgreSQL(knex());
  const mock = require('../mocks/mockPostgresGetTables');
  const result = await adapter.getTables();
  expect(result).toEqual(mock.toEqual);
  done();
});

test('it should return the database columns for table', async (done) => {
  const adapter = new PostgreSQL(knex());
  const mock = require('../mocks/mockPostgresGetColumns');
  const result = await adapter.getColumns();
  expect(result).toEqual(mock.toEqual);
  done();
});

test('it should return the table foreign keys', async (done) => {
  const adapter = new PostgreSQL(knex());
  const mock = require('../mocks/mockPostgresGetForeignKeys');
  const result = await adapter.getForeignKeys();
  expect(result).toEqual(mock.toEqual);
  done();
});

test('it should return the table primary key', async (done) => {
  const adapter = new PostgreSQL(knex());
  const mock = require('../mocks/mockPostgresGetPrimaryKey');
  const result = await adapter.getPrimaryKey(mock.schemaname, mock.tablename);
  expect(result).toEqual(mock.toEqual);
  done();
});

test('it should return the list of tables from schema', async (done) => {
  const schema = {
    foo: {
      bar: {}
    }
  }
  const adapter = new PostgreSQL(knex(), schema);
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
  const adapter = new PostgreSQL(knex(), schema);
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
  const adapter = new PostgreSQL(knex(), schema);
  const result = await adapter.getPrimaryKeyFromSchema('foo');
  expect(result).toEqual('bar');
  done();
});

test('it should return the complete database schema as json', async (done) => {
  const adapter = new PostgreSQL(knex());
  const mock = require('../mocks/mockPostgresGetSchema');
  const result = await adapter.getSchema();
  expect(result).toEqual(mock.result);
  done();
});