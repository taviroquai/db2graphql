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
   * Parse filter expression
   * Convert a string expression to an Object
   * containing a the tablename and
   * a set of conditions.
   * It's up to the database driver to interprete
   * these conditions.
   * 
   * @param {String} filterExpr 
   */
  parseFilterExpression(filterExpr) {
    const filter = {};
    const expr = filterExpr.split('|');
    expr.map(e1 => {
      const [ tablename, where ] = e1.split(':');
      if (!tablename) throw new Error('Tablename not found in: ' + e1);
      if (!where) throw new Error('Where expression not found in: ' + e1);
      filter[tablename.trim()] = [];
      where.split(';').map(f1 => {
        let op = /\<\=\>|>=|<=|=|>|<|~|\#/.exec(f1);
        if (!op) throw new Error('Filter operation not suported in: ' + f1);
        op = op[0].trim();
        let condition = f1.split(op);
        condition.unshift(op);
        condition = condition.map(c => c.trim())
        filter[tablename].push(condition);
      });
    });
    return filter;
  }

  /**
   * 
   * @param {String} expression 
   */
  parsePaginationExpression(expression) {
    const pagination = {};
    const expr = expression.split('|');
    expr.map(e1 => {
      const [ tablename, pagExpr ] = e1.split(':');
      if (!tablename) throw new Error('Tablename not found in: ' + e1);
      if (!pagExpr) throw new Error('Pagination not found in: ' + e1);
      pagination[tablename.trim()] = [];
      pagExpr.split(';').map(f1 => {
        let params = f1.split('=');
        params = params.map(p => p.trim())
        pagination[tablename].push(params);
      });
    });
    return pagination;
  }

  /**
   * Parse args for getPage API
   * 
   * @param {Object} args 
   */
  parseArgsGetPage(args) {
    if (args.filter) args.filter = this.parseFilterExpression(args.filter);
    if (args.pagination) args.pagination = this.parsePaginationExpression(args.pagination);
    return args;
  }

  /**
   * Parse args for getFirstOf API
   * 
   * @param {Object} args 
   */
  parseArgsGetFirstOf(args) {
    if (args.filter) args.filter = this.parseFilterExpression(args.filter);
    if (args.pagination) args.pagination = this.parsePaginationExpression(args.pagination);
    return args;
  }

  /**
   * Parse arguments
   * 
   * @param {String} queryName 
   * @param {Object} args 
   */
  parseArgs(queryName, args) {
    switch(queryName) {
      case 'getPage': return this.parseArgsGetPage(args);
      case 'getFirstOf': return this.parseArgsGetFirstOf(args);
      case 'putItem': return this.parseArgsPutItem(args);
      default: ;
    }
    return args;
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
      if (this.overrides[queryName]) {
        context.ioc = { resolver: this, tablename, db: this.dbDriver.db };
        return await this.overrides[queryName](root, args, context);
      }
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