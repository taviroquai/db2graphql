# db2graphql

Generates a Graphql schema and resolvers from an existing relational database

[![Build Status](https://travis-ci.org/taviroquai/db2graphql.svg?branch=master)](https://travis-ci.org/taviroquai/db2graphql)

## Features
* Fully compatible with **express**, **koa**, **hapi** and **Apollo Server**
* Converts an existing relational database (only PostgreSQL for now) schema to a JSON schema
* Generates a Graphql schema (string) with few but convenient types, queries and mutations
* Implements a generic Graphql resolver with a basic API for fast CRUD operations

## Limitations/TODO
* Only PostgreSQL supported
* Better database types handling
* Better database queries optimization
* Create tests
* Create an NPM module
* Move to TypeScript
* Add more and improve convenient API methods. Currently, only:
    1. getPage
    1. getFirstOf
    1. putItem

## Usage

### Generate a Graphql schema from and existing relation database

```js
const knex = require('knex');
const PostgreSQL = require('./adapters/postgres');
const Compiler = require('./graphql/compiler');

const start = async (cb) => {
  const connection = require('./connection.json');
  const dbDriver = new PostgreSQL(knex(connection));
  const dbSchema = await dbDriver.getSchema();
  
  // Generate Graphql schema
  const compiler = new Compiler(dbSchema, dbDriver);
  console.log(compiler.getSchema());
}

// Run
start().catch(err => console.log(err));
```

### Use built-in resolver for fast API prototyping
```js
const knex = require('knex');
const PostgreSQL = require('./adapters/postgres');
const Compiler = require('./graphql/compiler');
const Resolver = require('./graphql/resolver');
const { ApolloServer, gql } = require('apollo-server');

const start = async () => {
  const connection = require('./connection.json');
  const dbDriver = new PostgreSQL(knex(connection));
  const dbSchema = await dbDriver.getSchema();

  // Create Graphql server
  const compiler = new Compiler(dbSchema, dbDriver);
  const resolver = new Resolver(dbDriver);
  const schema = compiler.getSchema();
  if (!schema) throw new Error('Error: empty schema');

  const server = new ApolloServer({
    typeDefs: gql`${schema}`,
    resolvers: resolver.getResolvers(),
  });

  // Start server
  server.listen().then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`);
  });
}

start().catch(err => console.log(err));
```

### Implement user-specific resolvers for app specific code
```js
// Continue from previous example...
resolver.on('getFirstOf', async (root, args, context) => {
  const {
    resolver,   // Access the built-in resolver
    tablename,  // Access the requested table name
    db          // Access the Knex instance
  } = context.ioc;

  // You can still use the built-in resolver method
  const data = await resolver.getFirstOf(tablename, args);

  // Send resolver output
  return data;
});
```

## Run de demo
```
$ git clone https://github.com/taviroquai/db2graphql.git
$ cd db2graphql
$ npm install
$ psql -h localhost -U postgres -c "CREATE DATABASE db2graphql"
$ cp connection.example.json connection.json
# Edit connection.json
$ npm run demo-db
$ npm run start
```

Open browser on http://localhost:4000 and see your Graphql API ready!

## Collab

Anyone is free to collab :)

## License
MIT, what else?


