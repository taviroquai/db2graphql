const knex = require('knex');
const db2g = require('../src/db2g');
const { ApolloServer, gql } = require('apollo-server');

const start = async (cb) => {
  const api = new db2g(knex(require('./connection.json')));
  await api.init(); // Connects to database and load dependencies

  // Example of how to add your own queries and resolvers
  api.addQuery('getFoo: Boolean');
  api.addResolver('Query', 'getFoo', async (root, args, context) => {
    return true;
  });

  // Example on how to override a generated resolver
  api.override('getFirstOf', async (root, args, context) => {
    const { resolver, tablename, db } = context.ioc;
    if (tablename === 'categories') return await db('categories').first();
    return resolver.getFirstOf(tablename, args);
  });

  // Create Graphql server
  const schema = await api.getSchema();
  console.log(schema); // Show generated schema on run
  if (!schema) throw new Error('Error: empty schema');

  // Create Apollo Server and start
  const server = new ApolloServer({
    typeDefs: gql`${schema}`,
    resolvers: await api.getResolvers(),
  });
  server.listen().then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`);
  });
}

start();