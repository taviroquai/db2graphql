const knex = require('knex');

class PostgreSQL {

  constructor(connection) {
    this.db = knex(connection);
    this.dbSchema = {};
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

  async page(tablename, pagination) {
    return await this.db(tablename)
      .limit(pagination.limit)
      .offset(pagination.skip)
      .orderBy(pagination.orderby || 'id', pagination.ascend ? 'asc' : 'desc');
  }

  async pageTotal(tablename, args) {
    return await this.db(tablename).count();
  }

  async pageWhere(tablename, where, pagination = null) {
    let query = this.db(tablename);

    // Add where condition
    query.where(where.field, where.value);
    
    // Add pagination
    if (pagination) {
      query.limit(args.limit)
      .offset(args.skip)
      .orderBy(args.orderby || 'id', args.ascend ? 'asc' : 'desc');
    }

    // Run query
    return await query;
  }

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

  async putItem(tablename, args) {
    let result = null;
    if (!args.id) {
      result = await this.db(tablename)
        .returning('id')
        .insert(args);
    } else {
      result = await this.db.table(tablename)
        .where('id', args.id)
        .update(args);
    }
    return result;
  }

  async query(sql, params) {
    return await this.db.raw(sql, params);
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

  getTablesFromSchema() {
    return Object.keys(this.dbSchema);
  }

  getTableColumnsFromSchema(tablename) {
    return Object.keys(this.dbSchema[tablename]).filter(c => c !== '__reverse');
  }

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
        dbSchema[tablename][fkeys[j].columnname]['__foreign'] = {
          schemaname: fkeys[j].ftableschema,
          tablename: fkeys[j].ftablename,
          columnname: fkeys[j].fcolumnname
        };
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