const knex = require('knex');

class PostgreSQL {

  constructor(connection) {
    this.db = knex(connection);
    process.on("exit", () => {
      this.db.destroy();
    })
  }

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

  async page(tablename, args) {
    return new Promise((resolve, reject) => {
      this.db(tablename)
        .limit(args.limit)
        .offset(args.skip)
        .orderBy(args.orderby || 'id', args.ascend ? 'asc' : 'desc')
        .then(resolve)
        .catch(reject);
    });  
  }

  async pageTotal(tablename, args) {
    return new Promise((resolve, reject) => {
      this.db(tablename)
        .count()
        .then(resolve)
        .catch(reject);
    });  
  }

  async firstOf(tablename, args) {
    return new Promise((resolve, reject) => {
      this.db(tablename)
        .where(args.field, args.value)
        .first()
        .then(resolve)
        .catch(reject);
    });  
  }

  async putItem(tablename, args) {
    return new Promise((resolve, reject) => {
      let query = null;
      console.log('args', args)
      if (!args.id) {
        query = this.db(tablename)
          .returning('id')
          .insert(args);
      } else {
        query = this.db.table(tablename)
          .where('id', args.id)
          .update(args);
      }
      query.then(resolve).catch(reject);
    });
  }

  async query(sql, params) {
    return new Promise((resolve, reject) => {
      this.db.raw(sql, params).then(resolve).catch(reject);
    });  
  }

  getExcludeCondition(exclude = []) {
    let sql = '';
    if (!exclude || exclude.length === 0) return sql;
    const placeholders = exclude.map(v => '?').join(',');
    sql += `AND table_name NOT IN (${placeholders})`;
    return sql;
  }

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

  async getSchema(schemaname = 'public', exclude = []) {

    let dbSchema = {};
    
    // Get tables
    let tables = await this.getTables(schemaname, exclude);
    for (let i = 0; i < tables.length; i++) {
      let tablename = tables[i].name;
      dbSchema[tablename] = {};

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
        dbSchema[tablename][fkeys[j].columnname]['foreign'] = fkeys[j];
      }
    }

    // Return database schema
    return dbSchema;
  }
}

module.exports = PostgreSQL;