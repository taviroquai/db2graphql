const PostgreSQL = require('../src/adapters/postgres');
const Compiler = require('../src/graphql/compiler');
const Resolver = require('../src/graphql/resolver');

/**
 * Facade
 */
class DB2Graphql {

  /**
   * Creates a new db2graphql facade
   * @param {Object} connection 
   */
  constructor(connection) {
    this.drivers = {
      pg: PostgreSQL
    }
    this.connection = connection;
    this.dbSchema = null;
    this.gqlSchema = null;
    this.compiler = null;
    this.resolver = null;
    this.dbDriver = null;
    this.compiler = new Compiler();
    this.resolver = new Resolver();
  }

  /**
   * Coonnects to database and builds the database schema
   */
  async connect() {
    const config = this.connection.connection().client.config;
    const drivername = config.client;
    if (!this.drivers[drivername]) {
      throw new Error('Database driver not available');
    }
    this.dbDriver = new this.drivers[drivername](this.connection);
    this.dbSchema = await this.dbDriver.getSchema('public', config.exclude);
    this.compiler.dbSchema = this.dbSchema;
    this.compiler.dbDriver = this.dbDriver;
    this.resolver.dbDriver = this.dbDriver;
  }

  /**
   * Returns a new database schema as object.
   * Lazy loading.
   * 
   * @param {Boolean} refresh 
   */
  async getDatabaseSchema(refresh = false) {
    if (!this.dbSchema || refresh) await this.connect();
    return this.dbSchema;
  }

  /**
   * Returns a Graphql schema
   * Lazy loading
   * 
   * @param {Boolean} refresh 
   */
  getSchema(refresh = false, withDatabase = true) {
    if (!this.gqlSchema || refresh) {
      this.gqlSchema = this.compiler.getSchema(refresh, withDatabase);
    }
    return this.gqlSchema;
  }

  /**
   * Get compiled resolvers
   * 
   * @param {Boolean} withDatabase
   */
  getResolvers(withDatabase = true) {
    return this.resolver.getResolvers(withDatabase);
  }

  /**
   * Adds a Graphql expression
   * 
   * @param {String} gql 
   */
  addType(gql) {
    this.compiler.addType(gql);
    return this;
  }

  /**
   * Adds a Graphql query
   * 
   * @param {String} name 
   * @param {String} returns 
   * @param {Function} resolver 
   * @param {String} params 
   */
  addQuery(name, returns, resolver, params = {}) {
    const gql = this.compiler.buildQuery(name, returns, params);
    this.compiler.addQuery(gql);
    this.addRawResolver('Query', name, resolver);
    return this;
  }

  /**
   * Adds a Graphql mutation
   * 
   * @param {String} gql 
   */
  addMutation(name, returns, resolver, params = {}) {
    const gql = this.compiler.buildQuery(name, returns, params);
    this.compiler.addMutation(gql);
    this.addRawResolver('Mutation', name, resolver);
    return this;
  }

  /**
   * Adds a Graphql query
   * 
   * @param {String} gql 
   */
  addRawQuery(gql) {
    this.compiler.addQuery(gql);
    return this;
  }

  /**
   * Adds a Graphql mutation
   * 
   * @param {String} gql 
   */
  addRawMutation(gql) {
    this.compiler.addMutation(gql);
    return this;
  }

  /**
   * Adds a Graphql resolver
   * 
   * @param {String} namespace 
   * @param {String} name 
   * @param {Function} cb 
   */
  addRawResolver(namespace, name, cb) {
    this.resolver.add(namespace, name, cb);
    return this;
  }

  /**
   * Overrides a built-in resolver.
   * Giving access to the resolver instance
   * and to knex database connection
   * 
   * @param {String} name 
   * @param {Function} cb 
   */
  override(name, cb) {
    this.resolver.on(name, cb);
    return this;
  }

  /**
   * Adds the schema builder queries
   */
  withBuilder() {

    let resolver;

    // Add getSchema
    resolver = async () => {
      return JSON.stringify(this.dbSchema);
    };
    this.addQuery("getSchema", "String", resolver);

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
    this.addQuery('addSchemaColumn', 'Boolean', resolver, queryAlterColumnParams);

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
    this.addQuery('dropSchemaColumn', 'Boolean', resolver, queryDropColumnParams);

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
    this.addQuery('addSchemaTable', 'Boolean', resolver, queryAddTableParams);

    // Add dropSchemaTable
    resolver = async (root, args, context) => {
      const { db } = context.ioc;
      try {
        await db.schema.dropTable(args.tablename);
        return true;
      } catch (err) {
        return false;
      }
    };
    this.addQuery('dropSchemaTable', 'Boolean', resolver, { tablename: 'String!' });

    // Fluent interface
    return this;
  }
}

exports.PostgreSQL = PostgreSQL;
exports.Compiler = Compiler;
exports.Resolver = Resolver;
module.exports = DB2Graphql;