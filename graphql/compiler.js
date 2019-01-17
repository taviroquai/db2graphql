const utils = require('../utils');

class Compiler {

  constructor(dbSchema, dbDriver) {
    this.dbSchema = dbSchema;
    this.dbDriver = dbDriver;
  }

  mapDbTableToGraphqlType(tablename) {
    let fields = Object.keys(this.dbSchema[tablename]).map(k => {
      try {
        return "  " + k + ': ' 
          + this.dbDriver.mapDbColumnToGraphqlType(this.dbSchema, k, this.dbSchema[tablename][k]);
      } catch (err) {
        return '';
      }
    });
    fields = fields.filter(i => i);
    Object.keys(this.dbSchema).map(t => {
      Object.keys(this.dbSchema[t]).map(c => {
        if (this.dbSchema[t][c].foreign) {
          let ftbl = this.dbSchema[t][c].foreign.ftablename;
          if (ftbl === tablename) fields.push("  " + t + ": [" + utils.capitalize(t) + "]");
        }
      });
    });
    return 'type ' + utils.capitalize(tablename) + " {\n" + fields.join(",\n") + "\n}";
  }

  mapDbTableToGraphqlPage(tablename) {
    return 'type Page' + utils.capitalize(tablename)
      + "{\n  total: Int,\n  items: [" + utils.capitalize(tablename) + "]\n}";
  }

  mapDbTableToGraphqlQuery(tablename) {
    return '  getPage' + utils.capitalize(tablename) + 
      "(limit: Int, skip: Int, orderby: String, ascend: Boolean)"
      + ": Page" + utils.capitalize(tablename);
  }

  mapDbTableToGraphqlFirstOf(tablename) {
    return '  getFirstOf' + utils.capitalize(tablename) + 
      "(field: String!, value: String!)"
      + ": " + utils.capitalize(tablename);
  }

  mapDbTableToGraphqlMutation(tablename) {
    let string = '  putItem' + utils.capitalize(tablename);
    let vars = Object.keys(this.dbSchema[tablename]).map(col => {
      return '    '+col+': ' 
        + this.dbDriver.mapDbColumnToGraphqlType(this.dbSchema, col, this.dbSchema[tablename][col]);
    });
    string += " (\n" + vars.join(",\n") + "\n  ): " + utils.capitalize(tablename);
    return string;
  }

  mapDbSchemaToGraphqlSchema(graphqlSchema) {
    let graphqlSchemaTypes = [];
    let graphqlSchemaQueries = [];
    let graphqlSchemaMutations = [];
    for (let tablename in this.dbSchema) {
      graphqlSchemaTypes.push(this.mapDbTableToGraphqlType(tablename));
      graphqlSchemaTypes.push(this.mapDbTableToGraphqlPage(tablename));
      graphqlSchemaQueries.push(this.mapDbTableToGraphqlQuery(tablename));
      graphqlSchemaQueries.push(this.mapDbTableToGraphqlFirstOf(tablename));
      graphqlSchemaMutations.push(this.mapDbTableToGraphqlMutation(tablename));
    }
    graphqlSchema += graphqlSchemaTypes.join("\n\n") + "\n\n";
    graphqlSchema += "type Query {\n" + graphqlSchemaQueries.join("\n") + "\n}\n\n";
    graphqlSchema += "type Mutation {\n" + graphqlSchemaMutations.join("\n\n") + "\n}";
    return graphqlSchema;
  }

  getSchema() {
    let graphqlSchema = '';
    graphqlSchema = this.mapDbSchemaToGraphqlSchema(graphqlSchema);
    return graphqlSchema;
  }
}

module.exports = Compiler;