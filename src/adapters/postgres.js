/**
 * Available types
 */
const availableTypes = ['string', 'integer', 'bigInteger', 'text', 'float', 'decimal', 'boolean', 'date', 'datetime', 'time', 'timestamp', 'binary', 'json', 'jsonb', 'uuid'];

/**
 * PostgreSQL dialect adapter
 */
class PostgreSQL {

  /**
   * Create a new adapter instance
   * 
   * @param {Object} db 
   */
  constructor(db, dbSchema = {}) {
    this.db = db;
    this.dbSchema = dbSchema;
  }

  /**
   * Get available types from the RDMS
   */
  static getAvailableTypes() {
    return availableTypes;
  }

  /**
   * Get Graphql type from database column data type
   * 
   * @param {String} columnname 
   * @param {Object} attrs 
   */
  mapDbColumnToGraphqlType(columnname, attrs) {
    let graphqlType = '';
    switch(attrs.data_type) {
      case 'boolean':
        graphqlType = 'Boolean';
        break;
      case 'numeric':
        graphqlType = 'Float';
        break;
      case 'integer':
      case 'bigint':
        graphqlType = 'Int';
        break;
      case 'timestamp with time zone':
      case 'character varying':
      case 'text':
      case 'USER-DEFINED':
        graphqlType = 'String';
        break;
      default: throw new Error('Undefined column type: ' + attrs.data_type + ' of column '+ columnname);
    }
    return graphqlType;
  }

  /**
   * Get table results using pagination
   * 
   * @param {String} tablename 
   * @param {Object} pagination 
   */
  async page(tablename, args, depth = 1, cache = {}) {
    if (depth > 4) return;

    let query = this.db(tablename);
    (args) && this.addWhereFromArgs(tablename, query, args);
    (args) && this.addPaginationFromArgs(tablename, query, args);
    const items = await query;

    // Add to cache
    const pk = this.getPrimaryKeyFromSchema(tablename);
    if (!cache[tablename]) cache[tablename] = {};
    for (let i = 0; i < items.length; i++) cache[tablename][items[i][pk]] = items[i];

    // Load reverse relations
    await this.loadForeignItems(items, tablename, args, depth+1, cache);
    await this.loadReverseItems(items, tablename, args, depth+1, cache);
    return items;
  }

  /**
   * Get pagination total
   * 
   * @param {String} tablename 
   * @param {Object} args 
   */
  async pageTotal(tablename, args) {
    const query = this.db(tablename);
    (args) && this.addWhereFromArgs(tablename, query, args);
    const result = await query.count();
    return parseInt(result[0].count, 10);
  }

  /**
   * Get first record using where condition
   * Uses eager loading
   * 
   * @param {String} tablename 
   * @param {Object} args
   * @param {Number} depth 
   */
  async firstOf(tablename, args, depth = 1, cache = {}) {
    if (depth > 4) return;

    // Load item
    let query = this.db(tablename);
    (args) && this.addWhereFromArgs(tablename, query, args);
    const item = await query.first();

    // Add to cache
    const pk = this.getPrimaryKeyFromSchema(tablename);
    if (!cache[tablename]) cache[tablename] = {}
    cache[tablename][item[pk]] = item;

    // Load relations
    await this.loadForeignItems([item], tablename, args, depth+1, cache);
    await this.loadReverseItems([item], tablename, args, depth+1, cache);

    // Return item
    return item; 
  }

  /**
   * Insert or update record
   * TODO: detect primary key (but not composite)
   * 
   * @param {String} tablename 
   * @param {Object} data 
   */
  async putItem(tablename, data) {
    const pk = this.getPrimaryKeyFromSchema(tablename);
    let result = null;
    if (!data[pk]) {
      let query = this.db(tablename);
      query.returning(pk)
      result = await query.insert(data);
    } else {
      let query = this.db(tablename)
      query.where(pk, data[pk])
      result = await query.update(data);
    }
    return result;
  }

  /**
   * Load knex query with condition
   * 
   * @param {Function} query 
   * @param {Object} condition 
   */
  convertConditionToWhereClause(query, condition) {
    const column = condition[1];
    let op = condition[0];
    let value = condition[2];
    switch(op) {
      case '~':
        op = 'ilike';
        value = '%'+value.replace(' ', '%')+'%';
        query.where(column, 'ilike', value);
        break;
      case '#':
        query.whereIn(column, value.split(','));
        break;
      case '<=>':
        query.whereRaw(column + ' = ' + value);
        break;
      default:
        query.where(column, op, value);
    }
  }

  /**
   * Load knex query with all filters
   * 
   * @param {Function} query 
   * @param {Object} args 
   */
  addWhereFromArgs(tablename, query, args) {

    // Validate filter arguments
    if (!args.filter) return;
    let conditions = args.filter[tablename];
    if (!conditions) return;

    // Apply filters
    for (let i = 0; i < conditions.length; i++) {
      this.convertConditionToWhereClause(query, conditions[i]);
    }
  }

  /**
   * Load knex query with all pagination
   * 
   * @param {Function} query 
   * @param {Object} args 
   */
  addPaginationFromArgs(tablename, query, args) {

    // Validate pagination arguments
    if (!args.pagination) return;
    let pagination = args.pagination[tablename];
    if (!pagination) return;

    // Apply pagination to query
    for (let i = 0; i < pagination.length; i++) {
      const op = pagination[i][0];
      let value = pagination[i][1];
      switch(op) {
        case 'limit':
          query.limit(value);
          break;
        case 'offset':
          query.offset(value);
          break;
        case 'orderby':
          value = value.split(' ')
          query.orderBy(value[0], value[1]);
          break;
      }
    }
  }

  /**
   * Run a raw SQL query
   * 
   * @param {String} sql 
   * @param {Object} params 
   */
  async query(sql, params) {
    return await this.db.raw(sql, params);
  }

  /**
   * Eager loading of related records
   * using foreign keys.
   * Limited by max depth
   * 
   * @param {Array} items 
   * @param {String} tablename 
   * @param {object} args
   * @param {Number} depth
   * @param {Object} cache 
   */
  async loadForeignItems(items, tablename, args, depth = 1, cache = {}) {
    if (depth > 3) return;

    // Find all foreign keys
    let columns = this.getTableColumnsFromSchema(tablename);
    for (let i = 0; i < columns.length; i++) {
      let column = this.dbSchema[tablename][columns[i]];
      if (column.__foreign) {
        const ftablename = column.__foreign.tablename;
        const fcolumnname = column.__foreign.columnname;

        // Collect ids
        const ids = items.map(i => i[column.name]).reduce((a,b) => {
          if (a.indexOf(b) < 0 ) a.push(b);
          return a;
        },[]).join(',');

        // Load and assign
        const results = await this.loadItemsIn(ftablename, fcolumnname, ids, depth, cache);
        for (let j = 0; j < items.length; j++) {
          items[j][ftablename] = cache[ftablename][items[j][column.name]];
        }
        await this.loadForeignItems(results, ftablename, args, depth+1, cache);
        await this.loadReverseItems(results, ftablename, args, depth+1, cache);
      }
    }
  }

  /**
   * Eager loading of inverse related records
   * Limited by max depth
   * TODO: fix this mess!!!
   * 
   * @param {Array} items 
   * @param {String} tablename 
   * @param {Object} args 
   * @param {Number} depth 
   */
  async loadReverseItems(items, tablename, args, depth = 1, cache = {}) {
    if (depth > 3) return;

    // Collect ids
    const pk = this.getPrimaryKeyFromSchema(tablename);
    const ids = items.map(i => i[pk]).join(',');

    // Get all relations
    const relations = this.dbSchema[tablename].__reverse;
    for (let i = 0; i < relations.length; i++) {
      const ftablename = relations[i].ftablename;
      const fcolumnname = relations[i].fcolumnname;
      
      // Load related
      let results = await this.loadItemsIn(ftablename, fcolumnname, ids, depth+1, cache);
      for (let j = 0; j < results.length; j++) {
        const related = results[j];
        const item = cache[tablename][related[fcolumnname]];
        if (!item[ftablename]) item[ftablename] = { total: 0, items: [] };
        item[ftablename].items.push(related);
        item[ftablename].total = item[ftablename].items.length;
      }
      await this.loadForeignItems(results, ftablename, args, depth+1, cache);
      await this.loadReverseItems(results, ftablename, args, depth+1, cache);
    }
  }

  /**
   * Load items where ids
   * 
   * @param {String} tablename 
   * @param {String} columnname
   * @param {Array} ids 
   * @param {Object} cache 
   */
  async loadItemsIn(tablename, columnname, ids, depth = 1, cache = {}) {
    const results = [], missing = [], tids = ids.split(',').filter(i => i);

    // Load from cache
    tids.forEach(id => {
      if (cache[tablename] && cache[tablename][id]) results.push(cache[tablename][id]);
      else missing.push(id); 
    });

    // Load missing from database
    if (missing.length) {
      const pk = this.getPrimaryKeyFromSchema(tablename);
      let args = { filter: {}, pagination: {} };
      args.filter[tablename] = [['#', columnname, missing.join(',')]];
      let query = this.db(tablename);
      this.addWhereFromArgs(tablename, query, args);
      const loaded = await query;
      if (!cache[tablename]) cache[tablename] = {};
      for (let i = 0; i < loaded.length; i++) {
        cache[tablename][loaded[i][pk]] = loaded[i];
        results.push(loaded[i]);
      }
    }
    return results;
  }

  /**
   * Get exclude SQL condition when loading
   * database table names
   * 
   * @param {Array} exclude 
   */
  getExcludeCondition(exclude) {
    let sql = '';
    if (!exclude || exclude.length === 0) return sql;
    const placeholders = exclude.map(v => '?').join(',');
    sql += `AND table_name NOT IN (${placeholders})`;
    return sql;
  }

  /**
   * Get database tables
   * 
   * @param {String} schemaname 
   * @param {Array} exclude 
   */
  async getTables(schemaname, exclude = []) {
    const tables = [];

    // Build getTable SQL query
    let sql = `
      SELECT table_name as name 
      FROM information_schema.tables 
      WHERE table_schema = ?
      ${this.getExcludeCondition(exclude)}
    `;

    // Get table names
    let res = await this.query(sql, [schemaname, ...exclude]);
    for (let i = 0; i < res.rows.length; i++) {
      tables.push({ name: res.rows[i].name });
    }
    return tables; 
  }

  /**
   * Get table columns
   * and create an object representation
   * 
   * @param {String} schemaname 
   * @param {String} tablename 
   */
  async getColumns(schemaname, tablename) {
    const columns = [];
    const sql = `
      SELECT column_name as name, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_schema = ? AND table_name = ?
    `;
    let res = await this.query(sql, [schemaname, tablename]);
    for (let j = 0; j < res.rows.length; j++) {
      columns.push({
        name: res.rows[j].name,
        is_nullable: res.rows[j].is_nullable,
        data_type: res.rows[j].data_type
      });
    }
    return columns;
  }

  /**
   * Get foreign key constraints
   * for a database table
   * 
   * @param {String} schemaname 
   * @param {String} tablename 
   */
  async getForeignKeys(schemaname, tablename) {
    const fkeys = [];
    const sql = `
      SELECT
        tc.table_schema as schemaname, 
        tc.constraint_name, 
        tc.table_name as tablename, 
        kcu.column_name as columnname, 
        ccu.table_schema AS ftableschema,
        ccu.table_name AS ftablename,
        ccu.column_name AS fcolumnname 
      FROM 
        information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = ?
        AND tc.table_name = ?;
    `;
    let res = await this.query(sql, [schemaname, tablename]);
    for (let j = 0; j < res.rows.length; j++) {
      fkeys.push(res.rows[j]); 
    }
    return fkeys;
  }

  /**
   * Get primary key constraint
   * for a database table
   * 
   * @param {String} schemaname 
   * @param {String} tablename 
   */
  async getPrimaryKey(schemaname, tablename) {
    let pk = null;
    const sql = `
      SELECT 
        kcu.column_name as columnname 
      FROM 
        information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = ?
        AND tc.table_name = ?;
    `;
    let res = await this.query(sql, [schemaname, tablename]);
    return res.rows.length ? res.rows[0].columnname : pk;
  }

  /**
   * Helper to get table names
   * from current database schema
   */
  getTablesFromSchema() {
    return Object.keys(this.dbSchema);
  }

  /**
   * Helper to get column names for a table
   * from current database schema
   * 
   * @param {String} tablename 
   */
  getTableColumnsFromSchema(tablename) {
    return Object.keys(this.dbSchema[tablename]).filter(c => c !== '__reverse' && c !== '__pk');
  }

  /**
   * Helper to get primary key for a table
   * from current database schema
   * 
   * @param {String} tablename 
   */
  getPrimaryKeyFromSchema(tablename) {
    return this.dbSchema[tablename].__pk;
  }

  /**
   * Build and return the database schema
   * Use exclude parameter to exclude indesired tables
   * 
   * @param {String} schemaname 
   * @param {Array} exclude 
   */
  async getSchema(schemaname = 'public', exclude = []) {

    let dbSchema = {};
    
    // Get tables
    let tables = await this.getTables(schemaname, exclude);
    for (let i = 0; i < tables.length; i++) {
      let tablename = tables[i].name;
      let pk = await this.getPrimaryKey(schemaname, tablename);
      dbSchema[tablename] = {
        __pk: pk,
        __reverse: []
      };

      // Get columns
      let columns = await this.getColumns(schemaname, tablename);
      for (let j = 0; j < columns.length; j++) {
        let columnname = columns[j].name; 
        dbSchema[tablename][columnname] = columns[j];
      }
    }

    // Get foreign keys
    for (let tablename in dbSchema) {
      const fkeys = await this.getForeignKeys(schemaname, tablename);
      for (let j = 0; j < fkeys.length; j++) {

        // Assign foreign key definition to column
        dbSchema[tablename][fkeys[j].columnname]['__foreign'] = {
          schemaname: fkeys[j].ftableschema,
          tablename: fkeys[j].ftablename,
          columnname: fkeys[j].fcolumnname
        };

        // Assign inverse relations to table
        dbSchema[fkeys[j].ftablename]['__reverse'].push({
          fschemaname: fkeys[j].schemaname,
          ftablename: fkeys[j].tablename,
          fcolumnname: fkeys[j].columnname,
          columnname: fkeys[j].fcolumnname
        });
      }
    }

    // Return database schema
    this.dbSchema = dbSchema;
    return this.dbSchema;
  }
}

module.exports = PostgreSQL;