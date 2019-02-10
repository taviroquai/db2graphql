const Resolver = require('../../src/graphql/resolver');

const dbSchema = {
  "bar": {
    "__pk": "foo",
    "__reverse": [],
    "bar": {
      "__foreign": {
        "columnname": "bar",
        "schemaname": "public",
        "tablename": "foo"
      },
      "data_type": "integer",
      "is_nullable": "YES",
      "name": "bar"
    },
    "foo": {
      "data_type": "integer",
      "is_nullable": "NO",
      "name": "foo"
    }
  },
  "foo": {
    "__pk": "bar",
    "__reverse": [
      {
        "columnname": "bar",
        "fcolumnname": "bar",
        "fschemaname": "public",
        "ftablename": "bar"
      }
    ],
    "bar": {
      "data_type": "integer",
      "is_nullable": "NO",
      "name": "bar"
    }
  }
};

test('it should create a new Graphql resolver', () => {
  const resolver = new Resolver();
  expect(resolver instanceof Resolver).toBe(true);
});

test('it should allow to create a resolver override', () => {
  const resolver = new Resolver();
  const override = () => {};
  resolver.on('getPage', override)
  expect(resolver.overrides['getPage']).toBe(override);
});

test('it should throw error on invalid override name', () => {
  const resolver = new Resolver();
  expect(() => {
    resolver.on('foo', () => {});
  }).toThrow(new Error('Override not found: foo'));
});

test('it should throw error on invalid override type', () => {
  const resolver = new Resolver();
  expect(() => {
    resolver.on('getPage', 'bar');
  }).toThrow(new Error('Override must be a function. Found string'));
});

test('it should return a page of items', async (done) => {

  // Mock dbDriver
  const MockDriver = function() {
    this.page = async () => {
      return [{id:1}]
    },
    this.pageTotal = async () => {
      return 1;
    }
  }
  const dbDriver = new MockDriver();
  const resolver = new Resolver(dbDriver);
  const result = await resolver.getPage('foo', {}, {});
  const expected = {"items": [{"id": 1}], "tablename": "foo", "total": 1};
  expect(result).toEqual(expected);
  done();
});

test('it should return one item', async (done) => {

  // Mock dbDriver
  const MockDriver = function() {
    this.firstOf = async () => {
      return {id:1}
    }
  }
  const dbDriver = new MockDriver();
  const resolver = new Resolver(dbDriver);
  const result = await resolver.getFirstOf('foo', {}, {});
  const expected = {id:1};
  expect(result).toEqual(expected);
  done();
});

test('it should store one item and return it', async (done) => {

  // Mock dbDriver
  const MockDriver = function() {
    this.getPrimaryKeyFromSchema = () => 'id';
    this.firstOf = async () => {
      return {id:1}
    }
    this.putItem = async () => {
      return {id:1}
    }
  }
  const dbDriver = new MockDriver();
  const resolver = new Resolver(dbDriver);
  let result = await resolver.putItem('foo', {});
  let expected = {id:1};
  expect(result).toEqual(expected);
  result = await resolver.putItem('foo', {id:1});
  expected = {id:1};
  expect(result).toEqual(expected);
  done();
});

test('it should parse filter expressions', () => {
  const resolver = new Resolver();
  const tests = [
    { filter: 'id=1', toEqual: { foo: [['=', 'id', '1']]} },
    { filter: 'bar<=>baz', toEqual: { foo: [['<=>', 'bar', 'baz']]} },
    { filter: 'id>=1', toEqual: { foo: [['>=', 'id', '1']]} },
    { filter: 'id<=1', toEqual: { foo: [['<=', 'id', '1']]} },
    { filter: 'id>1', toEqual: { foo: [['>', 'id', '1']]} },
    { filter: 'id<1', toEqual: { foo: [['<', 'id', '1']]} },
    { filter: 'title~bar', toEqual: { foo: [['~', 'title', 'bar']]} },
    { filter: 'bar#baz', toEqual: { foo: [['#', 'bar', 'baz']]} },
    { filter: 'bar=1;baz=2', toEqual: { foo: [['=', 'bar', '1'], ['=', 'baz', '2']]} }
  ];
  tests.forEach(t => {
    let result = resolver.parseFilterExpression(t.filter, 'foo');
    expect(result).toEqual(t.toEqual);
  });
});

test('it should throw error on invalid operation in filter', () => {
  const resolver = new Resolver();
  const filter = 'bar!baz';
  expect(() => {
    resolver.parseFilterExpression(filter, 'foo');
  }).toThrow(new Error('Filter operation not suported in: bar!baz'));
});

test('it should parse pagination expressions', () => {
  const resolver = new Resolver();
  const tests = [
    { pagination: 'limit=1', toEqual: { foo: [['limit', '1']]} },
    { pagination: 'limit=1;offset=2', toEqual: { foo: [['limit', '1'], ['offset', '2']]} },
    { pagination: 'limit=1;offset=2;sortby=bar asc', toEqual: { foo: [['limit', '1'], ['offset', '2'], ['sortby', 'bar asc']]} },
  ];
  tests.forEach(t => {
    let result = resolver.parsePaginationExpression(t.pagination, 'foo');
    expect(result).toEqual(t.toEqual);
  });
});

test('it should parse args for common api', () => {
  const resolver = new Resolver();
  const tests = [
    { args: {}, toEqual: {} },
    { args: { filter: 'id=1' }, toEqual: { filter: { foo: [['=', 'id', '1']]} }},
    { args: { pagination: 'limit=1' }, toEqual: { pagination: { foo: [['limit', '1']]} }},
    {
      args: { filter: 'id=1', pagination: 'limit=1' },
      toEqual: { filter: { foo: [['=', 'id', '1']] }, pagination: { foo: [['limit', '1']]} }
    }
  ];
  tests.forEach(t => {
    let result = resolver.parseArgsCommon(t.args, 'foo');
    expect(result).toEqual(t.toEqual);
  });
});

test('it should create a resolver overloaded with context ioc', async (done) => {
  const MockDriver = function() {
    this.db = () => {}
  }
  const dbDriver = new MockDriver();
  const resolver = new Resolver(dbDriver);
  const callback = async (root, args, context) => {
    expect(typeof context.ioc).toBe('object');
    expect(context.ioc.resolver).toBe(resolver);
    expect(context.ioc.tablename).toBe('foo');
    expect(context.ioc.db).toBe(resolver.dbDriver.db);
  };
  resolver.on('getPage', callback);
  let overloaded = resolver.contextOverload('getPage', 'foo', callback);
  await overloaded(null, {}, {});
  done();
});

test('it should create a default resolver', async (done) => {
  const resolver = new Resolver();
  const callback = async (tablename, args) => {
    expect(tablename).toBe('foo');
    expect(args).toEqual({});
    done();
  }
  let overloaded = resolver.contextOverload('getPage', 'foo', callback);
  await overloaded(null, {}, null);
  done();
});

test('it should create a resolver overloaded with context ioc', async (done) => {
  const MockDriver = function() {
    this.dbSchema = { foo: { __reverse: [], foo: {} }}
    this.getTableColumnsFromSchema = () => {
      return ['foo'];
    }
    this.getTablesFromSchema = () => {
      return ['foo'];
    }
  }
  const dbDriver = new MockDriver();
  const resolver = new Resolver(dbDriver);
  const callback = async (root, args, context) => {};
  resolver.on('getPage', callback);
  let result = resolver.getResolvers();

  // Assert
  expect(typeof result).toEqual('object');
  expect(typeof result.Mutation).toEqual('object');
  expect(typeof result.Mutation.putItemFoo).toEqual('function');
  expect(typeof result.Query).toEqual('object');
  expect(typeof result.Query.getFirstFoo).toEqual('function');
  expect(typeof result.Query.getPageFoo).toEqual('function');
  done();
});

test('it should create a resolver for a foreign relationship', async (done) => {
  const MockDriver = function() {
    this.dbSchema = dbSchema;
    this.getTableColumnsFromSchema = () => ['bar', 'foo'];
    this.loadItemsIn = () => [{}];
  }
  let dbDriver = new MockDriver();
  const resolver = new Resolver(dbDriver);
  resolver.createForeignFieldsResolvers('bar');
  resolver.createForeignFieldsResolvers('bar');
  let resolvers = resolver.resolvers;

  // Assert
  expect(typeof resolvers).toEqual('object');
  expect(typeof resolvers.Bar).toEqual('object');
  expect(typeof resolvers.Bar.foo).toEqual('function');

  // Test resolver
  let result = await resolvers.Bar.foo({}, {}, { _rootArgs: {}});
  expect(typeof result).toBe('object');

  // Test empty result
  dbDriver.loadItemsIn = () => [];
  result = await resolvers.Bar.foo({}, {}, { _rootArgs: {}});
  expect(result).toBeNull();
  done();
});

test('it should create a resolver for a reverse relationship', async (done) => {
  const MockDriver = function() {
    this.dbSchema = dbSchema;
    this.loadItemsIn = () => []
  }
  const dbDriver = new MockDriver();
  const resolver = new Resolver(dbDriver);
  resolver.createReverseRelationsResolvers('foo');
  resolver.createReverseRelationsResolvers('foo');
  let result = resolver.resolvers; 

  // Assert
  expect(typeof result).toEqual('object');
  expect(typeof result.Foo).toEqual('object');
  expect(typeof result.Foo.bar).toEqual('function');

  // Test resolver
  result = await result.Foo.bar({}, {}, { _rootArgs: {}});
  expect(typeof result).toBe('object');
  expect(typeof result.total).toBe('number');
  expect(Array.isArray(result.items)).toBe(true);
  done();
});

test('it should add user-made resorver', async (done) => {
  const resolver1 = new Resolver();
  const callback = async (root, args, context) => {
    const { resolver } = context.ioc;
    expect(resolver).toEqual(resolver1);
    done();
  };
  resolver1.add('Query', 'getFoo', callback);
  let result = resolver1.getResolvers();

  // Assert
  expect(typeof result).toEqual('object');
  expect(typeof result.Query).toEqual('object');
  expect(typeof result.Query.getFoo).toEqual('function');
  await result.Query.getFoo(null, {}, {});
});

test('it should add user-made resorver without database', async (done) => {
  const resolver1 = new Resolver();
  const callback = async (root, args, context) => {
    const { resolver } = context.ioc;
    expect(resolver).toEqual(resolver1);
    done();
  };
  resolver1.add('Query', 'getFoo', callback);
  let result = resolver1.getResolvers();

  // Assert
  expect(typeof result).toEqual('object');
  expect(typeof result.Query).toEqual('object');
  expect(typeof result.Query.getFoo).toEqual('function');
  await result.Query.getFoo(null, {}, {});
});

test('it should return without built-in resolver', async (done) => {
  const MockDriver = function() {
    this.getTablesFromSchema = () => {
      return ['foo'];
    }
  }
  const dbDriver = new MockDriver();
  const resolver = new Resolver(dbDriver);
  let result = resolver.getResolvers(false);

  // Assert
  expect(typeof result).toEqual('object');
  expect(typeof result.Query).toEqual('object');
  expect(typeof result.Query.getFirstFoo).toEqual('undefined');
  done();
});
