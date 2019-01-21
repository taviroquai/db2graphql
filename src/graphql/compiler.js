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

    // Hold schema
    this.types = [];
    this.queries = [];
    this.mutations = [];
    this.dbTypes = [];
    this.dbQueries = [];
    this.dbMutations = [];

    // Cache schema
    this.cache = '';
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
          + this.dbDriver.mapDbColumnToGraphqlType(k, this.dbSchema[tablename][k]);
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
    this.dbSchema[tablename].__reverse.map(r => {
      fields.push("  " + r.ftablename + ": Page" + utils.toCamelCase(r.ftablename));
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
    return 'getPage' + typeName 
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
    return 'getFirstOf' + typeName 
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
    let string = 'putItem' + typeName;
    let columns = this.dbDriver.getTableColumnsFromSchema(tablename);
    let vars = columns.map(col => {
      try {
        return '    '+col+': ' 
          + this.dbDriver.mapDbColumnToGraphqlType(col, this.dbSchema[tablename][col]);
      } catch (err) {
        return '';
      }
    });
    vars = vars.filter(v => v);
    string += " (\n" + vars.join(",\n") + "\n  ): " + typeName;
    return string;
  }

  /**
   * Adds a Graphql expression
   * 
   * @param {String} gql 
   */
  addType(gql) {
    this.types.push(gql);
  }

  /**
   * Adds a Graphql query
   * 
   * @param {String} gql 
   */
  addQuery(gql) {
    this.queries.push("  " + gql);
  }

  /**
   * Adds a Graphql mutation
   * 
   * @param {String} gql 
   */
  addMutation(gql) {
    this.mutations.push("  " + gql);
  }

  /**
   * Generate a complete Graphql schema as a string.
   * Can be used as standalone.
   */
  getSchema(refresh = false, withDatabase = true) {
    withDatabase = withDatabase && this.dbDriver;
    if (!this.cache || refresh) {
      this.cache = '';
      this.dbTypes.length = 0;
      this.dbQueries.length = 0;
      this.dbMutations.length = 0;

      if (withDatabase) {
        for (let tablename in this.dbSchema) {
          this.dbTypes.push(this.mapDbTableToGraphqlType(tablename));
          this.dbTypes.push(this.mapDbTableToGraphqlPage(tablename));
          this.dbQueries.push("  "+this.mapDbTableToGraphqlQuery(tablename));
          this.dbQueries.push("  "+this.mapDbTableToGraphqlFirstOf(tablename));
          this.dbMutations.push("  "+this.mapDbTableToGraphqlMutation(tablename));
        }
      }

      // Add to cache
      if (this.types.length) this.cache += this.types.join("\n\n") + "\n\n";
      if (this.dbTypes.length) this.cache += this.dbTypes.join("\n\n") + "\n\n";
      
      if (this.queries.length || this.dbQueries.length) {
        this.cache += "type Query {\n"
          + this.queries.join("\n")
          + (withDatabase ? "\n" + this.dbQueries.join("\n") : '')
          + "\n}\n\n";
      }
      if (this.mutations.length || this.dbMutations.length) {
        this.cache += "type Mutation {\n"
          + this.mutations.join("\n\n")
          + (withDatabase ? "\n" + this.dbMutations.join("\n") : '')
          + "\n}";
      }
      
    }
    return this.cache;
  }
}

module.exports = Compiler;