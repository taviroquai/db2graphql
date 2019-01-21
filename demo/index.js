const knex = require('knex');
const db2g = require('../src/db2g');
const { ApolloServer, gql } = require('apollo-server');

const start = async (cb) => {

  /****************************************************** */
  const api = new db2g(knex(require('./connection.json')));
  await api.connect(); // Connects to database and extracts database schema
  api.withBuilder();
  const schema = api.getSchema();
  const resolvers = api.getResolvers();
  /****************************************************** */

  // Create Apollo Server and start
  if (!schema) throw new Error('Error: empty schema');
  console.log(schema);
  const server = new ApolloServer({
    typeDefs: gql`${schema}`,
    resolvers,
  });
  server.listen().then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`);
  });
}

start();