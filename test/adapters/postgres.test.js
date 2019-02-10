const PostgreSQL = require('../../src/adapters/postgres');
const knex = require('knex');
const connection = require('../connection.json');

describe('Postgres Driver', () => {

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
    const db = knex(connection);
    const query = db.table('foo');
    await adapter.convertConditionToWhereClause(query, ['=', 'id', 1]);
    await adapter.convertConditionToWhereClause(query, ['~', 'id', 'text']);
    await adapter.convertConditionToWhereClause(query, ['#', 'id', 'text']);
    await adapter.convertConditionToWhereClause(query, ['<=>', 'id', 1]);
    done();
  });

  test('it should add where clause from args', async (done) => {
    const adapter = new PostgreSQL();
    const db = knex(connection);
    let query = db.table('foo');
    let args = {
      filter: {
        foo: [
          ['=', 'id', 1]
        ]
      }
    }
    await adapter.addWhereFromArgs('foo', query, args);
    let result = query.toSQL();
    expect(/where/i.test(result.sql)).toBe(true);
    expect(/"id"\s=\s\?/i.test(result.sql)).toBe(true);
    expect(result.bindings[0]).toBe(1);

    query = db.table('foo');
    let argsEmpty = { filter: {} };
    await adapter.addWhereFromArgs('foo', query, argsEmpty);
    result = query.toSQL();
    expect(/where/i.test(result.sql)).toBe(false);
    done();
  });

  test('it should add pagination from args', async (done) => {
    const db = knex(connection);
    const adapter = new PostgreSQL(db);
    let query = db.table('foo');
    let args = {
      pagination: {
        foo: [
          ['limit', 1],
          ['offset', 1],
          ['orderby', 'id desc']
        ]
      }
    };
    await adapter.addPaginationFromArgs('foo', query, args);
    let result = query.toSQL();
    expect(/limit/i.test(result.sql)).toBe(true);
    expect(/offset/i.test(result.sql)).toBe(true);
    expect(/order/i.test(result.sql)).toBe(true);

    query = db.table('foo');
    args = { pagination: {} };
    await adapter.addPaginationFromArgs('foo', query, args);
    result = query.toSQL();
    expect(/limit/i.test(result.sql)).toBe(false);
    expect(/offset/i.test(result.sql)).toBe(false);
    expect(/order/i.test(result.sql)).toBe(false);
    done();
  });

  test('it should run a raw query', async (done) => {
    const db = knex(connection);
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
    const db = knex(connection);
    await db.schema.dropTableIfExists('bar');
    await db.schema.dropTableIfExists('foo');
    await db.schema.createTable('foo', (table) => {
      table.increments('id').primary();
    });

    // Test
    let adapter = new PostgreSQL(db, schema);
    let result = await adapter.page('foo', { _debug: true });
    expect(Array.isArray(result)).toBe(true);

    // Test without debug
    adapter = new PostgreSQL(db, schema);
    result = await adapter.page('foo', {});
    expect(Array.isArray(result)).toBe(true);

    // Test cache
    result = await adapter.page('foo', {});
    expect(Array.isArray(result)).toBe(true);
    result = await adapter.page('foo', { _debug: true });
    expect(Array.isArray(result)).toBe(true);
    done();
  });

  test('it should return a total of items', async (done) => {
    
    // Fixtures
    const schema = { foo: [] };
    schema.foo.__pk = 'id';
    schema.foo.__reverse = [];
    const db = knex(connection);
    await db.schema.dropTableIfExists('bar');
    await db.schema.dropTableIfExists('foo');
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
    const db = knex(connection);
    await db.schema.dropTableIfExists('bar');
    await db.schema.dropTableIfExists('foo');
    await db.schema.createTable('foo', (table) => {
      table.increments('id').primary();
    });
    await db('foo').insert({});

    // Test
    const adapter = new PostgreSQL(db, schema);
    let result = await adapter.firstOf('foo', { _debug: true });
    expect(typeof result).toBe("object");

    // Test cache
    result = await adapter.firstOf('foo', {});
    expect(typeof result).toBe("object");
    result = await adapter.firstOf('foo', { _cache: true });
    expect(typeof result).toBe("object");
    done();
  });

  test('it should save one item and return it', async (done) => {
    
    // Fixtures
    const schema = { foo: [] };
    schema.foo.__pk = 'id';
    schema.foo.__reverse = [];
    const db = knex(connection);
    await db.schema.dropTableIfExists('bar');
    await db.schema.dropTableIfExists('foo');
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
    const db = knex(connection);
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
    const db = knex(connection);
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
      { foo: 1, bar: 1 },
      { foo: 2, bar: 2 }
    ];

    // Setup database
    const db = knex(connection);
    await db.schema.dropTableIfExists('bar');
    await db.schema.dropTableIfExists('foo');
    await db.schema.createTable('bar', (table) => {
      table.integer('foo').primary();
      table.integer('bar');
    });
    await db('bar').insert({ foo: 1, bar: 1 });
    await db('bar').insert({ foo: 2, bar: 2 });

    const adapter = new PostgreSQL(db);
    await adapter.getSchema('public');
    let result = await adapter.loadItemsIn('bar', 'foo', [1, 2], {});
    expect(result).toEqual(expected);
    result = await adapter.loadItemsIn('bar', 'foo', [1, 2], {});
    expect(result).toEqual(expected);
    result = await adapter.loadItemsIn('bar', 'foo', [1, 2], {});
    expect(result).toEqual(expected);
    result = await adapter.loadItemsIn('bar', 'foo', [1, 2], {});
    expect(result).toEqual(expected);

    // Test with args
    let args = { filter: { bar: [[ '=', 'bar', 2 ]] } };
    result = await adapter.loadItemsIn('bar', 'foo', [1, 2], args);
    expect(result).toEqual([{ foo: 2, bar: 2 }]);

    // Test cache
    args = { filter: { bar: [[ '=', 'bar', 2 ]] }, _debug: true, _cache: false };
    result = await adapter.loadItemsIn('bar', 'foo', [1, 2], args);
    expect(result).toEqual([{ foo: 2, bar: 2 }]);

    args = { filter: { bar: [[ '=', 'bar', 2 ]] }, _debug: true };
    result = await adapter.loadItemsIn('bar', 'foo', [1, 2], args);
    expect(result).toEqual([{ foo: 2, bar: 2 }]);
    
    done();
  });

});