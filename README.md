# db2graphql

Generates a Graphql schema and resolvers from an existing relational database

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
const PostgreSQL = require('./adapters/postgres');
const Compiler = require('./graphql/compiler');

const start = async (cb) => {
  const connection = require('./connection.json');
  const dbDriver = new PostgreSQL(connection);
  const dbSchema = await dbDriver.getSchema();
  const compiler = new Compiler(dbSchema, dbDriver);
  
  // Generate Graphql schema
  console.log(compiler.getSchema());
}

// Run
start();
```

### Use built-in resolver for fast API prototyping
```js
const PostgreSQL = require('./adapters/postgres');
const Compiler = require('./graphql/compiler');
const Resolver = require('./graphql/resolver');
const { ApolloServer, gql } = require('apollo-server');

const start = async (cb) => {
  const connection = require('./connection.json');
  const dbDriver = new PostgreSQL(connection);
  const dbSchema = await dbDriver.getSchema();

  // Create Graphql server
  const compiler = new Compiler(dbSchema, dbDriver);
  const resolver = new Resolver(dbSchema, dbDriver);
  const schema = compiler.getSchema();
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

start();
```

### Implement user-specific resolvers for app specific code
```
// Continue from previous example...
resolver.on('getFirstOf', async (root, args, context) => {
  const {
    resolver,   // Access the built-in resolver
    tablename,  // Access the requested table
    db          // Access the Knex instance
  } = context.ioc;

  // You can have direct access to knex instance
  // const user = await db.table(tablename).where(args.field, args.value).first();

  // Use the built-in resolver method
  const user = await resolver.getFirstOf(tablename, args);

  // Transform data
  delete user.password;

  // Send resolver output
  return user;
});
```
