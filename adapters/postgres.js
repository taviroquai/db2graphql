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
    this.db = knex(connection);
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
        graphqlType = 'Bool';
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
  async page(tablename, pagination) {
    return await this.db(tablename)
      .limit(pagination.limit)
      .offset(pagination.skip)
      .orderBy(pagination.orderby || 'id', pagination.ascend ? 'asc' : 'desc');
  }

  /**
   * Get pagination total
   * 
   * @param {String} tablename 
   * @param {Object} args 
   */
  async pageTotal(tablename, args) {
    return await this.db(tablename).count();
  }

  /**
   * Get table records using pagination or
   * filter with where clause
   * 
   * @param {String} tablename 
   * @param {Object|null} where 
   * @param {Object|null} pagination 
   */
  async pageWhere(tablename, where = null, pagination = null) {
    let query = this.db(tablename);

    // Add where condition
    if (where) query.where(where.field, where.value);
    
    // Add pagination
    if (pagination) {
      query.limit(args.limit)
      .offset(args.skip)
      .orderBy(args.orderby || 'id', args.ascend ? 'asc' : 'desc');
    }

    // Run query
    return await query;
  }

  /**
   * Get first record using where condition
   * Uses eager loading
   * 
   * @param {String} tablename 
   * @param {Object} where 
   * @param {Number} depth 
   */
  async firstOf(tablename, where, depth = 1) {

    // Load item
    let item = await this.db(tablename)
      .where(where.field, where.value)
      .first()
      
    // Load relations
    await this.loadForeign(item, tablename, depth);
    await this.loadReverse(item, tablename, depth);

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
    let result = null;
    if (!data.id) {
      result = await this.db(tablename)
        .returning('id')
        .insert(data);
    } else {
      result = await this.db.table(tablename)
        .where('id', data.id)
        .update(data);
    }
    return result;
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
   * @param {Number} depth 
   */
  async loadForeign(item, tablename, depth = 1) {
    if (depth > 3) return;
    let columns = this.getTableColumnsFromSchema(tablename);
    for (let i = 0; i < columns.length; i++) {
      let column = this.dbSchema[tablename][columns[i]];
      if (column.__foreign) {
        let params = { field: column.__foreign.columnname, value: item[columns[i]] };
        item[column.__foreign.tablename] = await this.firstOf(column.__foreign.tablename, params, depth+1);
      }
    }
  }

  /**
   * Eager loading of inverse related records
   * Limited by max depth
   * 
   * @param {Object} item 
   * @param {String} tablename 
   * @param {Number} depth 
   */
  async loadReverse(item, tablename, depth = 1) {
    if (depth > 3) return;
    for (let i = 0; i < this.dbSchema[tablename].__reverse.length; i++) {
      let relation = this.dbSchema[tablename].__reverse[i];
      let where = { field: relation.fcolumnname, value: item[relation.columnname] };
      item[relation.ftablename] = await this.pageWhere(relation.ftablename, where);
      for (let j = 0; j < item[relation.ftablename].length; j++) {
        await this.loadForeign(item[relation.ftablename][j], relation.ftablename, depth+1);
        await this.loadReverse(item[relation.ftablename][j], relation.ftablename, depth+1);
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
      dbSchema[tablename] = { __reverse: []};

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