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
   * @param {Function} dbDriver 
   */
  constructor(dbDriver) {
    this.dbDriver = dbDriver;

    // Holds resolvers object
    this.resolvers = {
      Query: {},
      Mutation: {}
    }

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
    if (Object.keys(this.overrides).indexOf(ns1) === -1) {
      throw new Error('Override not found: ' + ns1);
    }
    if (typeof cb !== 'function') {
      throw new Error('Override must be a function. Found ' + typeof cb);
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
  async getPage(tablename, args, context) {
    context._rootArgs = args;
    args = this.parseArgsCommon(args, tablename);
    const total = await this.dbDriver.pageTotal(tablename, args);
    const items = await this.dbDriver.page(tablename, args);
    return { total, tablename, items };
  }

  /**
   * API: getFirstOf
   * Convinient method to retrieve
   * only one record
   * 
   * @param {String} tablename 
   * @param {Object} args 
   */
  async getFirstOf(tablename, args, context) {
    context._rootArgs = args;
    args = this.parseArgsCommon(args, tablename);
    return await this.dbDriver.firstOf(tablename, args)
  }

  /**
   * API: putItem
   * Convenient method to insert/update
   * a single record onto the database
   * 
   * @param {String} tablename 
   * @param {Object} data
   */
  async putItem(tablename, data) {
    const pk = this.dbDriver.getPrimaryKeyFromSchema(tablename);

    // Filter data
    delete data['_debug'];

    // Store item
    const result = await this.dbDriver.putItem(tablename, data);
    if (!data[pk]) data[pk] = result[0];

    // Retrieve updated item
    const args = { filter: { [tablename]: [['=', pk, data[pk]]] }};
    return await this.dbDriver.firstOf(tablename, args);
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
  parseFilterExpression(filterExpr, tablename) {
    const filter = {};
    const where = filterExpr;
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
    return filter;
  }

  /**
   * Parse pagination expression
   * 
   * @param {String} expression 
   */
  parsePaginationExpression(expression, tablename) {
    const pagination = {};
    const pagExpr = String(expression);
    pagination[tablename.trim()] = [];
    pagExpr.split(';').map(f1 => {
      let params = f1.split('=');
      params = params.map(p => p.trim())
      pagination[tablename].push(params);
    });
    return pagination;
  }

  /**
   * Parse args common
   * 
   * @param {Object} args 
   */
  parseArgsCommon(args, tablename) {
    let localArgs = Object.assign({}, args);
    if (args.filter) localArgs.filter = this.parseFilterExpression(args.filter, tablename);
    if (args.pagination) localArgs.pagination = this.parsePaginationExpression(args.pagination, tablename);
    return localArgs;
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
      return await cb(tablename, args, context);
    }
  }

  /**
   * Adds a Graphql resolver
   * 
   * @param {String} namespace 
   * @param {String} name 
   * @param {Function} cb 
   */
  add(namespace, name, cb) {
    if (!this.resolvers[namespace]) this.resolvers[namespace] = {};
    this.resolvers[namespace][name] = async (root, args, context) => {
      const db = this.dbDriver ? this.dbDriver.db : null;
      context.ioc = { resolver: this, db };
      return await cb(root, args, context);
    }
  }

  /**
   * Create relation resolver for foreign key
   * 
   * @todo Refactor to smaller complexity
   * @param {String} tablename 
   */
  createForeignFieldsResolvers(tablename) {
    const queryName = utils.toCamelCase(tablename);
    const columns = this.dbDriver.getTableColumnsFromSchema(tablename);
    columns.map(c => {
      const column = this.dbDriver.dbSchema[tablename][c];
      if (column.__foreign) {
        const field = column.__foreign.tablename;
        const fcolumnname = column.__foreign.columnname;
        if (!this.resolvers[queryName]) this.resolvers[queryName] = {};
        this.resolvers[queryName][field] = async (item, args, context) => {
          let { _rootArgs } = context;
          args = this.parseArgsCommon(_rootArgs, field);
          const ids = [item[column.name]];
          const related = await this.dbDriver.loadItemsIn(field, fcolumnname, ids, args);
          return related.length ? related[0] : null;
        }
      }
    });
  }

  /**
   * Create inverse relation resolver
   * 
   * @todo Refactor to smaller complexity
   * @param {String} tablename 
   */
  createReverseRelationsResolvers(tablename) {
    const queryName = utils.toCamelCase(tablename);
    this.dbDriver.dbSchema[tablename].__reverse.map(r => {
      let field = r.ftablename;
      const fcolumnname = r.fcolumnname;
      if (!this.resolvers[queryName]) this.resolvers[queryName] = {};
      this.resolvers[queryName][field] = async (item, args, context) => {
        args = this.parseArgsCommon(args, field);
        const related = await this.dbDriver.loadItemsIn(field, fcolumnname, [item[r.columnname]], args);
        const result = { total: related.length, items: related };
        return result;
      }
    });
  }

  /**
   * Builds the Graphql resolvers object
   * by population with the current API methods
   * 
   * @param {Boolean} withDatabase
   */
  getResolvers(withDatabase = true) {
    withDatabase = withDatabase && this.dbDriver;

    // Build resolvers
    if (withDatabase) {
      let tables = this.dbDriver.getTablesFromSchema();
      for (let i = 0; i < tables.length; i++) {
        let tablename = tables[i];
        let queryName, typeName = utils.toCamelCase(tablename);
        queryName = 'getPage' + typeName;
        this.resolvers.Query[queryName] = this.contextOverload('getPage', tablename, this.getPage.bind(this));
        queryName = 'getFirst' + typeName;
        this.resolvers.Query[queryName] = this.contextOverload('getFirst', tablename, this.getFirstOf.bind(this));
        queryName = 'putItem' + typeName;
        this.resolvers.Mutation[queryName] = this.contextOverload('putItem', tablename, this.putItem.bind(this));

        // Add foreign fields resolvers
        this.createForeignFieldsResolvers(tablename);

        // Add inverse relations resolvers
        this.createReverseRelationsResolvers(tablename);
      }
    }

    // Return resolvers
    return this.resolvers;
  }
}

module.exports = Resolver;