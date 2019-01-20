const Resolver = require('../../src/graphql/resolver');

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
      return [{ count: 1 }];
    }
  }
  const dbDriver = new MockDriver();
  const resolver = new Resolver(dbDriver);
  const result = await resolver.getPage('foo', {});
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
  const result = await resolver.getFirstOf('foo', {});
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
    { filter: 'foo:id=1', toEqual: { foo: [['=', 'id', '1']]} },
    { filter: 'foo:bar<=>baz', toEqual: { foo: [['<=>', 'bar', 'baz']]} },
    { filter: 'foo:id>=1', toEqual: { foo: [['>=', 'id', '1']]} },
    { filter: 'foo:id<=1', toEqual: { foo: [['<=', 'id', '1']]} },
    { filter: 'foo:id>1', toEqual: { foo: [['>', 'id', '1']]} },
    { filter: 'foo:id<1', toEqual: { foo: [['<', 'id', '1']]} },
    { filter: 'foo:title~bar', toEqual: { foo: [['~', 'title', 'bar']]} },
    { filter: 'foo:bar#baz', toEqual: { foo: [['#', 'bar', 'baz']]} },
    { filter: 'foo:bar=1;baz=2', toEqual: { foo: [['=', 'bar', '1'], ['=', 'baz', '2']]} },
    { filter: 'foo:bar=1|baz:boo=2', toEqual: { foo: [['=', 'bar', '1']], baz: [['=', 'boo', '2']]} },
  ];
  tests.forEach(t => {
    let result = resolver.parseFilterExpression(t.filter);
    expect(result).toEqual(t.toEqual);
  });
});

test('it should throw error on missing table name in filter expression', () => {
  const resolver = new Resolver();
  const filter = ':id=1';
  expect(() => {
    resolver.parseFilterExpression(filter);
  }).toThrow(new Error('Tablename not found in: ' + filter));
});

test('it should throw error on missing where expression in filter', () => {
  const resolver = new Resolver();
  const filter = 'foo:';
  expect(() => {
    resolver.parseFilterExpression(filter);
  }).toThrow(new Error('Where expression not found in: ' + filter));
});

test('it should throw error on invalid operation in filter', () => {
  const resolver = new Resolver();
  const filter = 'foo:bar!baz';
  expect(() => {
    resolver.parseFilterExpression(filter);
  }).toThrow(new Error('Filter operation not suported in: bar!baz'));
});

test('it should parse pagination expressions', () => {
  const resolver = new Resolver();
  const tests = [
    { pagination: 'foo:limit=1', toEqual: { foo: [['limit', '1']]} },
    { pagination: 'foo:limit=1;offset=2', toEqual: { foo: [['limit', '1'], ['offset', '2']]} },
    { pagination: 'foo:limit=1;offset=2;sortby=bar asc', toEqual: { foo: [['limit', '1'], ['offset', '2'], ['sortby', 'bar asc']]} },
    { pagination: 'foo:limit=1|baz:limit=2', toEqual: { foo: [['limit', '1']], baz: [['limit', '2']]} },
  ];
  tests.forEach(t => {
    let result = resolver.parsePaginationExpression(t.pagination);
    expect(result).toEqual(t.toEqual);
  });
});

test('it should throw error on missing table name in pagination expression', () => {
  const resolver = new Resolver();
  const pagination = ':limit=1';
  expect(() => {
    resolver.parsePaginationExpression(pagination);
  }).toThrow(new Error('Tablename not found in: ' + pagination));
});

test('it should throw error on missing pagination expression', () => {
  const resolver = new Resolver();
  const pagination = 'foo:';
  expect(() => {
    resolver.parsePaginationExpression(pagination);
  }).toThrow(new Error('Pagination not found in: ' + pagination));
});

test('it should parse args for common api', () => {
  const resolver = new Resolver();
  const tests = [
    { args: {}, toEqual: {} },
    { args: { filter: 'foo:id=1' }, toEqual: { filter: { foo: [['=', 'id', '1']]} }},
    { args: { pagination: 'foo:limit=1' }, toEqual: { pagination: { foo: [['limit', '1']]} }},
    {
      args: { filter: 'foo:id=1', pagination: 'foo:limit=1' },
      toEqual: { filter: { foo: [['=', 'id', '1']] }, pagination: { foo: [['limit', '1']]} }
    }
  ];
  tests.forEach(t => {
    let result = resolver.parseArgsCommon(t.args);
    expect(result).toEqual(t.toEqual);
  });
});

test('map parse args for API', () => {
  const resolver = new Resolver();
  let result = resolver.parseArgs('getPage', {});
  expect(result).toEqual({});
  result = resolver.parseArgs('getFirstOf', {});
  expect(result).toEqual({});
  result = resolver.parseArgs('foo', {});
  expect(result).toEqual({});
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
  expect(typeof result.Query.getFirstOfFoo).toEqual('function');
  expect(typeof result.Query.getPageFoo).toEqual('function');
  done();
});

test('it should add user-made resorver', async (done) => {
  const MockDriver = function() {
    this.getTablesFromSchema = () => {
      return ['foo'];
    }
  }
  const dbDriver = new MockDriver();
  const resolver1 = new Resolver(dbDriver);
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
  expect(typeof result.Query.getFirstOfFoo).toEqual('undefined');
  done();
});

test('it should throw error on invalid resolver namespace', () => {
  const resolver = new Resolver();
  expect(() => {
    resolver.add('foo', 'bar', () => {});
  }).toThrow(new Error('Namespace must be one of: Query,Mutation'));
});