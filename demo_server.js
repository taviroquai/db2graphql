const PostgreSQL = require('./adapters/postgres');
const Compiler = require('./graphql/compiler');
const Resolver = require('./graphql/resolver');
const { ApolloServer, gql } = require('apollo-server');

const start = async (cb) => {
  const connection = require('./connection.json');
  const dbDriver = new PostgreSQL(connection);
  const dbSchema = await dbDriver.getSchema('public', connection.exclude);

  // Create Graphql server
  const compiler = new Compiler(dbSchema, dbDriver);
  const resolver = new Resolver(dbSchema, dbDriver);
  const schema = compiler.getSchema();
  if (!schema) throw new Error('Error: empty schema');

  const server = new ApolloServer({
    typeDefs: gql`${schema}`,
    resolvers: resolver.getResolvers(),
  });

  // Start server
  server.listen().then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`);

    // Ready to use!
    cb(null, { resolver, dbDriver, compiler, dbSchema, schema });
  });
}

module.exports = {
  start
}
