const knex = require('knex');
const PostgreSQL = require('../src/adapters/postgres');
const Compiler = require('../src/graphql/compiler');
const Resolver = require('../src/graphql/resolver');
const { ApolloServer, gql } = require('apollo-server');

const start = async (cb) => {
  const connection = require('./connection.json');
  const dbDriver = new PostgreSQL(knex(connection));
  const dbSchema = await dbDriver.getSchema('public', connection.exclude);

  // Create Graphql server
  const compiler = new Compiler(dbSchema, dbDriver);
  const resolver = new Resolver(dbDriver);
  const schema = compiler.getSchema();
  console.log(schema);
  if (!schema) throw new Error('Error: empty schema');

  const server = new ApolloServer({
    typeDefs: gql`${schema}`,
    resolvers: resolver.getResolvers(),
  });

  // Start server
  server.listen().then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`);

    // Ready to use!
    cb({ resolver, dbDriver, compiler, dbSchema, schema });
  });
}

module.exports = {
  start
}
