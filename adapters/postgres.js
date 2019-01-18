const knex = require('knex');

/**
 * PostgreSQL dialect adapter
 */
class PostgreSQL {

  /**
   * Create a new adapter instance
   * 
   * @param {Object} connection 
   */
  constructor(connection) {
    this.connection = connection;
    this.db = knex(this.connection);
    this.dbSchema = {};
    process.on("exit", () => {
      this.db.destroy();
    })
  }

  /**
   * Get Graphql type from database column data type
   * 
   * @param {Object} dbSchema 
   * @param {String} columnname 
   * @param {Object} attrs 
   */
  mapDbColumnToGraphqlType(dbSchema, columnname, attrs) {
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
  async page(tablename, args) {
    let query = this.db(tablename);
    if (args) {
      this.addWhereFromArgs(tablename, query, args);
      this.addPaginationFromArgs(tablename, query, args);
    }
    const items = await query;
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
    return await query.count();
  }

  /**
   * Get first record using where condition
   * Uses eager loading
   * 
   * @param {String} tablename 
   * @param {Object} args
   * @param {Number} depth 
   */
  async firstOf(tablename, args, depth = 1) {

    // Load item
    let query = this.db(tablename);
    (args) && this.addWhereFromArgs(tablename, query, args);
    const item = await query.first();
      
    // Load relations
    await this.loadForeign(item, tablename, args, depth);
    await this.loadReverse(item, tablename, args, depth);

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
      result = await this.db.table(tablename)
        .returning(pk)
        .insert(data);
    } else {
      result = await this.db.table(tablename)
        .where(pk, data[pk])
        .update(data);
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
    const pk = this.getPrimaryKeyFromSchema(tablename);
    for (let i = 0; i < pagination.length; i++) {
      const op = pagination[i][0];
      let value = pagination[i][1];
      switch(op) {
        case 'limit':
          query.limit(value || 25);
          break;
        case 'offset':
          query.offset(value || 0);
          break;
        case 'orderby':
          value = value.split(' ');
          if (!value.length === 2) throw new Error('Invalid orderby expression in:', pagination[i][0]);
          query.orderBy(value[0] || pk, value[1] || 'asc');
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
   * @param {Object} item 
   * @param {String} tablename 
   * @param {object} args
   * @param {Number} depth 
   */
  async loadForeign(item, tablename, args, depth = 1) {
    if (depth > 3) return;
    let columns = this.getTableColumnsFromSchema(tablename);
    for (let i = 0; i < columns.length; i++) {
      let column = this.dbSchema[tablename][columns[i]];
      if (column.__foreign) {
        item[column.__foreign.tablename] = await this.firstOf(column.__foreign.tablename, args, depth+1);
      }
    }
  }

  /**
   * Eager loading of inverse related records
   * Limited by max depth
   * 
   * @param {Object} item 
   * @param {String} tablename 
   * @param {object} args
   * @param {Number} depth 
   */
  async loadReverse(item, tablename, args, depth = 1) {
    if (depth > 3) return;
    for (let i = 0; i < this.dbSchema[tablename].__reverse.length; i++) {
      let relation = this.dbSchema[tablename].__reverse[i];
      let argsCondition = Object.assign({ filter: {}}, args);
      argsCondition.filter[relation.ftablename] = [['=', relation.fcolumnname, item[relation.columnname]]];
      item[relation.ftablename] = await this.page(relation.ftablename, argsCondition);
      for (let j = 0; j < item[relation.ftablename].length; j++) {
        await this.loadForeign(item[relation.ftablename][j], relation.ftablename, args, depth+1);
        await this.loadReverse(item[relation.ftablename][j], relation.ftablename, args, depth+1);
      }
    }
  }

  /**
   * Get exclude SQL condition when loading
   * database table names
   * 
   * @param {Array} exclude 
   */
  getExcludeCondition(exclude = []) {
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
    let pk = 'id';
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
    pk = res.rows.length ? res.rows[0].columnname : pk;
    return pk;
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
    return Object.keys(this.dbSchema[tablename]).filter(c => c !== '__reverse');
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