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
        fields.push("  " + column.__foreign.tablename + ": " + utils.capitalize(column.__foreign.tablename));
      }
    })

    // Add reverse relation
    let tables = this.dbDriver.getTablesFromSchema();
    tables.map(t => {
      let columns = this.dbDriver.getTableColumnsFromSchema(t);
      columns.map(c => {
        if (this.dbSchema[t][c].__foreign) {
          let ftbl = this.dbSchema[t][c].__foreign.tablename;
          if (ftbl === tablename) fields.push("  " + t + ": [" + utils.capitalize(t) + "]");
        }
      });
    });
    return 'type ' + utils.capitalize(tablename) + " {\n" + fields.join(",\n") + "\n}";
  }

  /**
   * Generate a convenient type of Page
   * for a given database table
   * 
   * @param {String} tablename 
   */
  mapDbTableToGraphqlPage(tablename) {
    return 'type Page' + utils.capitalize(tablename)
      + "{\n  total: Int,\n  items: [" + utils.capitalize(tablename) + "]\n}";
  }

  /**
   * Generate a convenient getPage query
   * for paginated results
   * 
   * @param {String} tablename 
   */
  mapDbTableToGraphqlQuery(tablename) {
    return '  getPage' + utils.capitalize(tablename) + 
      "(limit: Int, skip: Int, orderby: String, ascend: Boolean)"
      + ": Page" + utils.capitalize(tablename);
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
    return '  getFirstOf' + utils.capitalize(tablename) + 
      "(field: String!, value: String!)"
      + ": " + utils.capitalize(tablename);
  }

  /**
   * Generates a convenient mutation putItem
   * to store a single record into the database
   * 
   * @param {String} tablename 
   */
  mapDbTableToGraphqlMutation(tablename) {
    let string = '  putItem' + utils.capitalize(tablename);
    let columns = this.dbDriver.getTableColumnsFromSchema(tablename);
    let vars = columns.map(col => {
      return '    '+col+': ' 
        + this.dbDriver.mapDbColumnToGraphqlType(this.dbSchema, col, this.dbSchema[tablename][col]);
    });
    string += " (\n" + vars.join(",\n") + "\n  ): " + utils.capitalize(tablename);
    return string;
  }

  /**
   * Generate a complete Graphql schema as a string.
   * Can be used as standalone.
   */
  getSchema() {
    let graphqlSchema = '';
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