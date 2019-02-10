const knex = require('knex');
const db2g = require('../src/db2g');
const { ApolloServer, gql } = require('apollo-server');

const start = async (cb) => {

  /****************************************************** */
  const api = new db2g(knex(require('./connection.json')));
  await api.connect(); // Connects to database and extracts database schema
  api.withBuilder();

  // Set authorization hook example
  const validator = async (type, field, parent, args, context) => {
    return true; // Should return true/ false
  }
  const denied = async (type, field, parent, args, context) => {
    throw new Error('Access Denied'); // Denied callback
  }
  api.isAuthorized(validator, denied);

  // Add extra field
  api.add('Users', 'fullname', 'String', (parent, args, context) => {
    return String(args.foo + parent.username);
  }, { foo: 'String' });

  // Change existing resolver
  api.add('Users', 'password', 'String', () => '');

  // Get generated schema and resolvers
  const schema = api.getSchema();
  const resolvers = api.getResolvers();
  console.log(resolvers);
  /****************************************************** */

  // Create Apollo Server and start
  console.log(schema);
  const server = new ApolloServer({
    typeDefs: gql`${schema}`,
    resolvers
  });
  server.listen().then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`);
  });
}

start();