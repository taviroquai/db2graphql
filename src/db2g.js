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
  }

  /**
   * Adds a Graphql query
   * 
   * @param {String} gql 
   */
  addQuery(gql) {
    this.compiler.addQuery(gql);
  }

  /**
   * Adds a Graphql mutation
   * 
   * @param {String} gql 
   */
  addMutation(gql) {
    this.compiler.addMutation(gql);
  }

  /**
   * Adds a Graphql resolver
   * 
   * @param {String} namespace 
   * @param {String} name 
   * @param {Function} cb 
   */
  addResolver(namespace, name, cb) {
    this.resolver.add(namespace, name, cb);
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
  }
}

exports.PostgreSQL = PostgreSQL;
exports.Compiler = Compiler;
exports.Resolver = Resolver;
module.exports = DB2Graphql;