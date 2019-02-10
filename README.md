# db2graphql

Generates a Graphql schema and resolvers from an existing relational database

[![Build Status](https://travis-ci.org/taviroquai/db2graphql.svg?branch=master)](https://travis-ci.org/taviroquai/db2graphql)
[![Coverage Status](https://coveralls.io/repos/github/taviroquai/db2graphql/badge.svg?branch=master)](https://coveralls.io/github/taviroquai/db2graphql?branch=master)

:exclamation::exclamation::exclamation: **Warning: don't use this in production yet, but your feedback is very important!**

## Features
* Fully compatible with **express**, **koa**, **hapi** and **Apollo Server**
* Converts an existing relational database (only PostgreSQL for now) schema to a JSON schema
* Generates a Graphql schema (string) with few but convenient types, queries and mutations
* Implements a generic Graphql resolver ready for API prototyping
* Eager loading of related records based on foreign keys
* Allows to add/override resolvers

## Demo
[![link to youtube video](demo/demo.png)](https://www.youtube.com/watch?v=HYwjcqekCuc)

### Query example
```gql
query {
  getPageUsers(
    filter: "id#1,2,3"
    pagination: "limit=2;orderby=username desc"
    _debug: true
  ) {
    items {
      id
      username
      fullname(foo: "hello ")
      password
      posts(filter: "publish=true", _cache: false) {
        total
        items {
          title
          publish
          categories {
            title
          }
        }
      }
    }
  }
}
```

## Limitations/TODO
* Only PostgreSQL supported
* Better database types handling
* Better database queries optimization
* ~~Create tests~~
* ~~Create an NPM module~~
* Move to TypeScript
* Add more and improve convenient API methods. Currently, only:
    1. getPage
    1. getFirstOf
    1. putItem

## Usage

### Generate a Graphql schema from an existing relational database
```js
const knex = require('knex');
const db2g = require('db2graphql');
const api = new db2g(knex(require('./connection.json')));
await api.connect();
const schema = api.getSchema();
```

**Example of file connection.json**
```json
{
  "client": "pg",
  "version": "10.6",
  "debug": false,
  "connection": {
    "host" : "127.0.0.1",
    "user" : "postgres",
    "password" : "postgres",
    "database" : "db2graphql"
  },
  "exclude": []
}
```

### Complete example with Apollo Server
```js
const knex = require('knex');
const db2g = require('db2graphql');
const { ApolloServer, gql } = require('apollo-server');

const start = async (cb) => {

  /**************************************/
  const api = new db2g(knex(require('./connection.json')));
  await api.connect(); // Connects to database and extracts database schema

  // Example of adding extra field
  api.add('Users', 'fullname', 'String', (parent, args, context) => {
    return String(args.foo + parent.username);
  }, { foo: 'String' });

  // Example of overiding existing schema
  api.add('Users', 'password', 'String', () => '');

  // Get generated schema and resolvers
  const schema = api.getSchema();
  const resolvers = api.getResolvers();
  /**************************************/

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
```

### Implement specific resolvers
```js
api.override('getFirstOf', async (root, args, context) => {
  const { resolver, tablename, db } = context.ioc;
  if (tablename === 'categories') return await db('categories').first();

   // You can still run the build-in resolver
  return resolver.getFirstOf(tablename, args);
});
```

### Example without database connection
```js
const db2g = require('db2graphql');
const api = new db2g();

// Add a query and resolver
api.add('getFoo', 'Boolean', async (root, args, context) => {
  return true;
}, { param: 'String!' });

// Ready to generate schema
const schema = api.getSchema();
const resolvers = api.getResolvers();
```

## Run de demo
```
$ git clone https://github.com/taviroquai/db2graphql.git
$ cd db2graphql
$ npm install
$ psql -h localhost -U postgres -c "CREATE DATABASE db2graphql"
$ cp demo/connection.example.json demo/connection.json
# Edit demo/connection.json
$ npm run demo-db
$ npm run start
```

Open browser on http://localhost:4000 and see your Graphql API ready!

## Collab

Anyone is free to collab :)

## License
MIT, what else?
