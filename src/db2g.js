const PostgreSQL = require('../src/adapters/postgres');
const Compiler = require('../src/graphql/compiler');
const Resolver = require('../src/graphql/resolver');

/**
 * Main facade interface for DB2Graphql.
 * 
 * <p>
 * DB2Graphql is a library to create a Graphql API
 * from a relational database schema.
 * </p>
 * 
 */
class DB2Graphql {

  /**
   * Creates a new DB2Graphql facade
   * 
   * <br>
   * <br>Usage example:
   * 
   * <pre>
   * import knex from 'knex'
   * import DB2Graphql from 'db2graphql'
   * const db2g = new DB2Graphql(knex())
   * </pre>
   * 
   * @param {String} name
   * @param {Object} [db=null]  Knex database instance
   */
  constructor(name = '', db = null) {
    this.drivers = {
      pg: PostgreSQL
    }
    this.connection = db;
    this.dbSchema = null;
    this.gqlSchema = null;
    this.compiler = null;
    this.resolver = null;
    this.dbDriver = null;
    this.compiler = new Compiler();
    this.resolver = new Resolver();

    // Add initial resolver
    if (name) this.add("Query", "getAPIName", "String", () => name);
  }

  /**
   * Adds a Graphql query to the schema.
   * If type does not exists, it gets created.
   * 
   * <p>Usage example:</p>
   * 
   * <pre>
   * add('Users', 'fullname', 'String', (user) => user.firstname + user.lastname)
   * </pre>
   * 
   * @access public
   * @param {String} type           The root type name ie. Query
   * @param {String} field          The field name of the resolver ie. getUser
   * @param {String|Array} returns  The Graphql returning type ie. Boolean or 'User' or ['User']
   * @param {Function} resolver     The resolver callback
   * @param {Object} [params={}]    The query arguments
   * 
   * @returns {DB2Graphql}        The self instance for fluent interface 
   */
  add(type, field, returns, resolver, params = {}) {
    this.compiler.add(type, field, returns, params);
    this.resolver.add(type, field, resolver);
    return this;
  }

  /**
   * Set authorization callback
   * 
   * @param {Function} validator 
   */
  isAuthorized(validator, rejected) {
    this.resolver.isAuthorizedHook.validator = validator
    if (rejected) this.resolver.isAuthorizedHook.rejected = rejected;
  }

  /**
   * Connects to the database and builds the database schema
   * 
   * @access public
   * @param {String} [connect="public"] The database namespace (if suported)
   * 
   * @returns {Promise}                 The self instance for fluent interface
   */
  async connect(namespace = 'public') {
    if (!this.connection) throw new Error('Invalid Knex instance');

    const config = this.connection.connection().client.config;
    const drivername = config.client;
    if (!this.drivers[drivername]) {
      throw new Error('Database driver not available');
    }

    this.dbDriver = new this.drivers[drivername](this.connection);
    this.dbSchema = await this.dbDriver.getSchema(namespace, config.exclude);
    this.compiler.dbSchema = this.dbSchema;
    this.compiler.dbDriver = this.dbDriver;
    this.resolver.dbDriver = this.dbDriver;
    this.compiler.buildSchema();
  }

  /**
   * Returns a new database schema as object.
   * 
   * <br>
   * Lazy loading.
   * 
   * <p>
   * Passing refresh will rebuild the database schema
   * </p>
   * 
   * @param {Boolean} [refresh=false] Reconnects to database and rebuilds the database schema
   * 
   * @returns {Promise}               The self instance for fluent interface
   */
  async getDatabaseSchema(refresh = false) {
    if (!this.dbSchema || refresh) await this.connect();
    return this.dbSchema;
  }

  /**
   * Get Graphql resolvers
   */
  getResolvers() {
    return this.resolver.getResolvers(!!this.connection);
  }

  /**
   * Returns the Graphql schema (string)
   * 
   * <br>
   * Lazy loading
   * 
   * @param {Boolean} refresh Allows to reconnect to database and rebuild database schema
   * 
   * @returns {String}        The Graphql schema as string
   */
  getSchema(refresh = false) {
    if (!this.gqlSchema || refresh) {
      this.gqlSchema = this.compiler.getSDL(refresh, !!this.connection);
    }
    return this.gqlSchema;
  }

  /**
   * Adds the schema builder queries
   * 
   * @access public
   * 
   * @todo Move to its own repository as a plugin
   * 
   * @returns {DB2Graphql} The self instance for fluent interface
   */
  withBuilder() {

    let resolver;

    // Add getSchema
    resolver = async () => {
      return JSON.stringify(this.dbSchema);
    };
    this.add("Query", "getSchema", "String", resolver);

    // Add addSchemaColumn
    resolver = async (root, args, context) => {
      const { resolver, db } = context.ioc;
      const types = resolver.dbDriver.constructor.getAvailableTypes();
      if (types.indexOf(args.type) === -1) return false;
      try {
        await db.schema.table(args.tablename, table => {
          table[args.type](args.columnname).defaultTo(args.default || null);
          if (args.unique) table.unique(args.columnname);
          if (args.index) table.index(args.columnname);
          if (args.foreign) table.foreign(args.columnname).references(args.foreign)
        });
        return true;
      } catch(err) {
        return false;
      }
    }
    const queryAlterColumnParams = {
      tablename: 'String!',
      columnname: 'String!',
      type: 'String!',
      foreign: 'String',
    };
    this.add('Query', 'addSchemaColumn', 'Boolean', resolver, queryAlterColumnParams);

    // Add dropSchemaColumn
    resolver = async (root, args, context) => {
      const { db } = context.ioc;
      try {
        await db.schema.table(args.tablename, table => {
          table.dropColumn(args.columnname);
        });
        return true;
      } catch (err) {
        return false;
      }
    };
    const queryDropColumnParams = {
      tablename: 'String!',
      columnname: 'String!'
    };
    this.add('Query', 'dropSchemaColumn', 'Boolean', resolver, queryDropColumnParams);

    // Add addSchemaTable
    resolver = async (root, args, context) => {
      const { resolver, db } = context.ioc;
      const types = resolver.dbDriver.constructor.getAvailableTypes();
      if (types.indexOf(args.type) === -1) return false;
      try {
        await db.schema.createTable(args.tablename, (table) => {
          if (args.increments) table.increments(args.primary);
          else table[args.type](args.primary).primary();
        })
        return true;
      } catch (err) {
        return false;
      }
    };
    const queryAddTableParams = {
      tablename: 'String!',
      primary: 'String!',
      type: 'String!',
      increments: 'Boolean'
    };
    this.add('Query', 'addSchemaTable', 'Boolean', resolver, queryAddTableParams);

    // Add dropSchemaTable
    resolver = async (root, args, context) => {
      const { db } = context.ioc;
      try {
        await db.schema.dropTable(args.tablename);
        return true;
      } catch (err) {
        return true;
      }
    };
    this.add('Query', 'dropSchemaTable', 'Boolean', resolver, { tablename: 'String!' });

    // Fluent interface
    return this;
  }
}

exports.PostgreSQL = PostgreSQL;
exports.Compiler = Compiler;
exports.Resolver = Resolver;
module.exports = DB2Graphql;