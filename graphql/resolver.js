const utils = require('../utils/utils');

/**
 * Graphql resolver
 * 
 * By using a database schema and driver,
 * implements a convenient API
 * to retrieve database records
 * for the most common operations
 * 
 * It is not intended to perform exotic
 * database queries. For that case,
 * the user is able to override the resolvers API
 * using on() method.
 */
class Resolver {

  /**
   * Creates a new Resolver instance
   * 
   * @param {Object} dbSchema 
   * @param {Function} dbDriver 
   */
  constructor(dbSchema, dbDriver) {
    this.dbSchema = dbSchema;
    this.dbDriver = dbDriver;

    // Override hooks
    this.overrides = {
      getPage: null,
      getFirstOf: null,
      putItem: null
    };
  }

  /**
   * Allows the user to add an override
   * on the available override API
   * 
   * @param {String} ns1 
   * @param {Function} cb 
   */
  on(ns1, cb) {
    if (!Object.keys(this.overrides).indexOf(ns1) === -1) {
      throw new Error('Override not found: ' + ns1);
    }
    this.overrides[ns1] = cb;
  }

  /**
   * API: getPage
   * Convenient method to retrieve
   * a page of records
   * 
   * @param {String} tablename 
   * @param {Object} args 
   */
  async getPage(tablename, args) {
    const result = await this.dbDriver.pageTotal(tablename, args);
    const items = await this.dbDriver.page(tablename, args);
    return { total: result[0].count, items };
  }

  /**
   * API: getFirstOf
   * Convinient method to retrieve
   * only one record
   * 
   * @param {String} tablename 
   * @param {Object} args 
   */
  async getFirstOf(tablename, args) {
    return await this.dbDriver.firstOf(tablename, args)
  }

  /**
   * API: putItem
   * Convenient method to insert/update
   * a single record onto the database
   * 
   * @param {String} tablename 
   * @param {Object} args 
   */
  async putItem(tablename, args) {
    const result = await this.dbDriver.putItem(tablename, args);
    if (!args.id) args.id = result[0];
    return await this.dbDriver.firstOf(tablename, { field: 'id', value: args.id });
  }

  /**
   * Implements IoC
   * Allows to give control to the user override
   * while overloading the Graphql context
   * with the resolver, tablename and Knex instance
   * 
   * @param {String} queryName 
   * @param {String} tablename 
   * @param {Function} cb 
   */
  contextOverload(queryName, tablename, cb) {
    return async (root, args, context) => {
      context.ioc = { resolver: this, tablename, db: this.dbDriver.db };
      if (this.overrides[queryName]) return await this.overrides[queryName](root, args, context);
      return await cb(tablename, args);
    }
  }

  /**
   * Builds the Graphql resolvers object
   * by population with the current API methods
   */
  getResolvers() {
    let resolvers = {
      Query: {},
      Mutation: {}
    }

    // Build resolvers
    let tables = this.dbDriver.getTablesFromSchema();
    for (let i = 0; i < tables.length; i++) {
      let tablename = tables[i];
      let queryName = 'getPage' + utils.toCamelCase(tablename);
      resolvers.Query[queryName] = this.contextOverload('getPage', tablename, this.getPage.bind(this));
      queryName = 'getFirstOf' + utils.toCamelCase(tablename);
      resolvers.Query[queryName] = this.contextOverload('getFirstOf', tablename, this.getFirstOf.bind(this));
      queryName = 'putItem' + utils.toCamelCase(tablename);
      resolvers.Mutation[queryName] = this.contextOverload('putItem', tablename, this.putItem.bind(this));
    }

    // Return resolvers
    return resolvers;
  }
}

module.exports = Resolver;