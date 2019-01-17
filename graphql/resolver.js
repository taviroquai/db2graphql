const utils = require('../utils');

class Resolver {

  constructor(dbSchema, dbDriver) {
    this.dbSchema = dbSchema;
    this.dbDriver = dbDriver;
  }

  getPage(tablename) {
    return async (root, args, context) => {
      const result = await this.dbDriver.pageTotal(tablename, args);
      const items = await this.dbDriver.page(tablename, args);
      return { total: result[0].count, items };
    }
  }

  getFirstOf(tablename) {
    return async (root, args, context) => {
      const item = await this.dbDriver.firstOf(tablename, args);
      return item;
    }
  }

  putItem(tablename) {
    return async (root, args, context) => {
      const result = await this.dbDriver.putItem(tablename, args);
      if (!args.id) args.id = result[0];
      return await this.dbDriver.firstOf(tablename, { field: 'id', value: args.id });
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
      let queryName = 'getPage' + utils.capitalize(tables[i]);
      resolvers.Query[queryName] = this.getPage(tables[i]);
      queryName = 'getFirstOf' + utils.capitalize(tables[i]);
      resolvers.Query[queryName] = this.getFirstOf(tables[i]);
      queryName = 'putItem' + utils.capitalize(tables[i]);
      resolvers.Mutation[queryName] = this.putItem(tables[i]);
    }

    // Return resolvers
    return resolvers;
  }
}

module.exports = Resolver;