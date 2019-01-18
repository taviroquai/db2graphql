const utils = require('../utils/utils');

/**
 * Graphql compiler
 * 
 * Compiles to a Graphql schema string
 * from a database schema generated
 * by a database adapter
 */
class Compiler {

  /**
   * Creates a new compiler instance
   * 
   * @param {Object} dbSchema 
   * @param {Function} dbDriver 
   */
  constructor(dbSchema, dbDriver) {
    this.dbSchema = dbSchema;
    this.dbDriver = dbDriver;
  }

  /**
   * Generate a Graphql Type definition
   * from a database table
   * 
   * @param {String} tablename 
   */
  mapDbTableToGraphqlType(tablename) {
    let columns = this.dbDriver.getTableColumnsFromSchema(tablename);
    let fields = columns.map(k => {
      try {
        return "  " + k + ': ' 
          + this.dbDriver.mapDbColumnToGraphqlType(this.dbSchema, k, this.dbSchema[tablename][k]);
      } catch (err) {
        return '';
      }
    });
    fields = fields.filter(i => i);

    // Add foreign relations
    columns.map(c => {
      let column = this.dbSchema[tablename][c];
      if (column.__foreign) {
        fields.push("  " + column.__foreign.tablename + ": " + utils.toCamelCase(column.__foreign.tablename));
      }
    })

    // Add reverse relation
    let tables = this.dbDriver.getTablesFromSchema();
    tables.map(t => {
      let columns = this.dbDriver.getTableColumnsFromSchema(t);
      columns.map(c => {
        if (this.dbSchema[t][c].__foreign) {
          let ftbl = this.dbSchema[t][c].__foreign.tablename;
          if (ftbl === tablename) fields.push("  " + t + ": [" + utils.toCamelCase(t) + "]");
        }
      });
    });
    return 'type ' + utils.toCamelCase(tablename) + " {\n" + fields.join(",\n") + "\n}";
  }

  /**
   * Generate a convenient type of Page
   * for a given database table
   * 
   * @param {String} tablename 
   */
  mapDbTableToGraphqlPage(tablename) {
    const typeName = utils.toCamelCase(tablename)
    return 'type Page' + typeName
      + "{\n  total: Int,\n  tablename: String,\n  items: [" + typeName + "]\n}";
  }

  /**
   * Generate a convenient getPage query
   * for paginated results
   * 
   * @param {String} tablename 
   */
  mapDbTableToGraphqlQuery(tablename) {
    const typeName = utils.toCamelCase(tablename)
    return '  getPage' + typeName 
      + "(filter: String, pagination: String)"
      + ": Page" + typeName;
  }

  /**
   * Generates a convenient getFirstOf query
   * to get only one record from database.
   * 
   * Uses a simple filter that can be used
   * on Unique columns 
   * 
   * @param {String} tablename 
   */
  mapDbTableToGraphqlFirstOf(tablename) {
    const typeName = utils.toCamelCase(tablename);
    return '  getFirstOf' + typeName 
      + "(filter: String, pagination: String)"
      + ": " + utils.toCamelCase(tablename);
  }

  /**
   * Generates a convenient mutation putItem
   * to store a single record into the database
   * 
   * @param {String} tablename 
   */
  mapDbTableToGraphqlMutation(tablename) {
    const typeName = utils.toCamelCase(tablename)
    let string = '  putItem' + typeName;
    let columns = this.dbDriver.getTableColumnsFromSchema(tablename);
    let vars = columns.map(col => {
      try {
        return '    '+col+': ' 
          + this.dbDriver.mapDbColumnToGraphqlType(this.dbSchema, col, this.dbSchema[tablename][col]);
      } catch (err) {
        return '';
      }
    });
    vars = vars.filter(v => v);
    string += " (\n" + vars.join(",\n") + "\n  ): " + typeName;
    return string;
  }

  /**
   * Generate a complete Graphql schema as a string.
   * Can be used as standalone.
   */
  getSchema() {
    let graphqlSchema = '';

    // Validate tables
    if (!Object.keys(this.dbSchema).length) return graphqlSchema;

    // Build schema
    let graphqlSchemaTypes = [];
    let graphqlSchemaQueries = [];
    let graphqlSchemaMutations = [];
    for (let tablename in this.dbSchema) {
      graphqlSchemaTypes.push(this.mapDbTableToGraphqlType(tablename));
      graphqlSchemaTypes.push(this.mapDbTableToGraphqlPage(tablename));
      graphqlSchemaQueries.push(this.mapDbTableToGraphqlQuery(tablename));
      graphqlSchemaQueries.push(this.mapDbTableToGraphqlFirstOf(tablename));
      graphqlSchemaMutations.push(this.mapDbTableToGraphqlMutation(tablename));
    }
    graphqlSchema += graphqlSchemaTypes.join("\n\n") + "\n\n";
    graphqlSchema += "type Query {\n" + graphqlSchemaQueries.join("\n") + "\n}\n\n";
    graphqlSchema += "type Mutation {\n" + graphqlSchemaMutations.join("\n\n") + "\n}";
    return graphqlSchema;
  }
}

module.exports = Compiler;