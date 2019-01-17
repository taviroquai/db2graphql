const PostgreSQL = require('./adapters/postgres');
const Compiler = require('./graphql/compiler');
const Resolver = require('./graphql/resolver');
const { ApolloServer, gql } = require('apollo-server');

const start = async () => {
  const connection = require('./connection.json');
  const dbDriver = new PostgreSQL(connection);
  const dbSchema = await dbDriver.getSchema();

  // Create server
  const compiler = new Compiler(dbSchema, dbDriver);
  const resolver = new Resolver(dbSchema, dbDriver);
  const server = new ApolloServer({
    typeDefs: gql`${compiler.getSchema()}`,
    resolvers: resolver.getResolvers(),
  });

  // How to override resolvers (opcional)
  resolver.on('getPage', async (root, args, context) => {
    const { resolver, tablename, db } = context.ioc;
    return resolver.getPage(tablename, args);
  });
  resolver.on('getFirstOf', async (root, args, context) => {
    const { resolver, tablename, db } = context.ioc;
    return resolver.getFirstOf(tablename, args);
  });
  resolver.on('putItem', async (root, args, context) => {
    const { resolver, tablename, db } = context.ioc;
    return resolver.putItem(tablename, args);
  });

  // Start server
  server.listen().then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`)
  });  
}

start();