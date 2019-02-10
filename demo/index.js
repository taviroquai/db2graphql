const knex = require('knex');
const db2g = require('../src/db2g');
const { ApolloServer, gql } = require('apollo-server');

const start = async (cb) => {

  /****************************************************** */
  const api = new db2g(knex(require('./connection.json')));
  await api.connect(); // Connects to database and extracts database schema
  api.withBuilder();

  // Add extra field
  api.add('Users', 'fullname', 'String', (parent, args, context) => {
    return String(args.foo + parent.username);
  }, { foo: 'String' });
  const schema = api.getSchema();
  console.log(schema);
  
  // Change an existing field
  const resolvers = api.getResolvers();
  resolvers.Users.password = () => null;

  /****************************************************** */

  // Create Apollo Server and start
  const server = new ApolloServer({
    typeDefs: gql`${schema}`,
    resolvers
  });
  server.listen().then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`);
  });
}

start();