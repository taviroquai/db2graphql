const knex = require('knex');
const db2g = require('../src/db2g');
const { ApolloServer } = require('@apollo/server');
const { startStandaloneServer } = require('@apollo/server/standalone');

const start = async (cb) => {

  /****************************************************** */
  const config = require('./connection.json');
  const api = new db2g('demo', knex(config));
  await api.connect(); // Connects to database and extracts database schema

  // Get generated schema and resolvers
  const schema = api.getSchema();
  const resolvers = api.getResolvers();
  /****************************************************** */

  // Create Apollo Server and start
  console.log(schema);
  const server = new ApolloServer({
    typeDefs: schema,
    resolvers
  });
  startStandaloneServer(server).then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`);
  });
}

start();