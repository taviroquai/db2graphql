const utils = require('../utils/utils');

class Resolver {

  constructor(dbSchema, dbDriver) {
    this.dbSchema = dbSchema;
    this.dbDriver = dbDriver;
    this.overrides = {
      getPage: null,
      getFirstOf: null,
      putItem: null
    };
  }

  on(ns1, cb) {
    if (!Object.keys(this.overrides).indexOf(ns1) === -1) {
      throw new Error('Override not found: ' + ns1);
    }
    this.overrides[ns1] = cb;
  }

  async getPage(tablename, args) {
    const result = await this.dbDriver.pageTotal(tablename, args);
    const items = await this.dbDriver.page(tablename, args);
    return { total: result[0].count, items };
  }

  async getFirstOf(tablename, args) {
    return await this.dbDriver.firstOf(tablename, args)
  }

  async putItem(tablename, args) {
    const result = await this.dbDriver.putItem(tablename, args);
    if (!args.id) args.id = result[0];
    return await this.dbDriver.firstOf(tablename, { field: 'id', value: args.id });
  }

  contextOverload(queryName, tablename, cb) {
    return async (root, args, context) => {
      context.ioc = { resolver: this, tablename, db: this.dbDriver.db };
      if (this.overrides[queryName]) return await this.overrides[queryName](root, args, context);
      return await cb(tablename, args);
    }
  }

  getResolvers() {
    let resolvers = {
      Query: {},
      Mutation: {}
    }

    // Build resolvers
    let tables = this.dbDriver.getTablesFromSchema();
    for (let i = 0; i < tables.length; i++) {
      let tablename = tables[i];
      let queryName = 'getPage' + utils.capitalize(tablename);
      resolvers.Query[queryName] = this.contextOverload('getPage', tablename, this.getPage.bind(this));
      queryName = 'getFirstOf' + utils.capitalize(tablename);
      resolvers.Query[queryName] = this.contextOverload('getFirstOf', tablename, this.getFirstOf.bind(this));
      queryName = 'putItem' + utils.capitalize(tablename);
      resolvers.Mutation[queryName] = this.contextOverload('putItem', tablename, this.putItem.bind(this));
    }

    // Return resolvers
    return resolvers;
  }
}

module.exports = Resolver;