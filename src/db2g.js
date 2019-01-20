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
    if (!this.connection) throw new Error('A Knex connection is missing');
    const drivername = connection.connection().client.config.client;
    if (!this.drivers[drivername]) throw new Error('Database driver not available');
    this.dbDriver = new this.drivers[drivername](this.connection);
  }

  /**
   * Initializes dependencies
   */
  async init() {
    this.dbSchema = await this.dbDriver.getSchema('public', this.connection.exclude);
    this.compiler = new Compiler(this.dbSchema, this.dbDriver);
    this.resolver = new Resolver(this.dbDriver);
  }

  /**
   * Returns a new database schema as object.
   * Lazy loading.
   * 
   * @param {Boolean} refresh 
   */
  async getDatabaseSchema(refresh = false) {
    if (!this.dbSchema || refresh) await this.init();
    return this.dbSchema;
  }

  /**
   * Returns a Graphql schema
   * Lazy loading
   * 
   * @param {Boolean} refresh 
   */
  async getSchema(refresh = false, withDatabase = true) {
    if (!this.gqlSchema || refresh) {
      if (!this.compiler) await this.init();
      this.gqlSchema = this.compiler.getSchema(refresh, withDatabase);
    }
    return this.gqlSchema;
  }

  /**
   * Get compiled resolvers
   * 
   * @param {Boolean} refresh 
   * @param {Boolean} withDatabase
   */
  async getResolvers(refresh = false, withDatabase = true) {
    if (!this.resolver || refresh) await this.init();
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