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

test('it should return a page of items', async (done) => {

  // Mock dbDriver
  const MockDriver = function() {
    this.page = async () => {
      return [{id:1}]
    },
    this.pageTotal = async () => {
      return 1;
    },
    this.firstOf = async () => {
      return {id:1}
    }
  }
  const dbDriver = new MockDriver();
  const resolver = new Resolver(dbDriver);
  const result = await resolver.getPage('foo', null, {}, {});
  const expected = {"items": [{"id": 1}], "tablename": "foo", "total": 1};
  expect(result).toEqual(expected);
  done();
});

test('it should return one item', async (done) => {

  // Mock dbDriver
  const MockDriver = function() {
    this.page = async () => {
      return [{id:1}]
    },
    this.pageTotal = async () => {
      return 1;
    },
    this.firstOf = async () => {
      return {id:1}
    }
  }
  const dbDriver = new MockDriver();
  const resolver = new Resolver(dbDriver);
  const result = await resolver.getFirstOf('foo', null, {}, {});
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
  let result = await resolver.putItem('foo', null, { input: {}});
  let expected = {id:1};
  expect(result).toEqual(expected);
  result = await resolver.putItem('foo', null, { input: {id:1}});
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
    let result = resolver.parseArgsCommon('foo', t.args);
    expect(result).toEqual(t.toEqual);
  });
});

test('it should create a resolver for a foreign relationship', async (done) => {
  let MockDriver = function(related) {
    this.dbSchema = dbSchema;
    this.getTableColumnsFromSchema = () => ['bar', 'foo'];
    this.page = async () => {
      return [{id:1}]
    };
    this.pageTotal = async () => {
      return 1;
    };
    this.firstOf = async () => {
      return {id:1}
    };
  }
  let dbDriver = new MockDriver([{}]);
  const resolver = new Resolver(dbDriver);
  resolver.createForeignFieldsResolvers('bar');
  resolver.createForeignFieldsResolvers('bar');
  let resolvers = resolver.resolvers;

  // Assert
  expect(typeof resolvers).toEqual('object');
  expect(typeof resolvers.Bar).toEqual('object');
  expect(typeof resolvers.Bar.bar_foo).toEqual('function');

  // Test resolver
  let result = await resolvers.Bar.bar_foo({}, {}, {});
  expect(result).toBeNull();

  // Assert items result
  result = await resolvers.Bar.bar_foo({ bar: 1 }, {}, {});
  expect(typeof result).toBe('object');

  // Assert join filter
  result = await resolvers.Bar.bar_foo({ bar: 1 }, { filter: "id>1" }, {});
  expect(typeof result).toBe('object');

  // Test empty result
  //resolver.dbDriver = new MockDriver([]);
  //result = await resolvers.Bar.bar_foo({ bar: 1 }, {}, {});
  //expect(result).toBeNull();
  done();
});

test('it should create a resolver for a reverse relationship', async (done) => {
  const MockDriver = function() {
    this.dbSchema = dbSchema;
    this.page = async () => {
      return [{id:1}]
    };
    this.pageTotal = async () => {
      return 1;
    };
    this.firstOf = async () => {
      return {id:1}
    };
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
  let result1 = await result.Foo.bar({}, {}, {});
  expect(typeof result1).toBe('object');
  expect(typeof result1.total).toBe('number');
  expect(Array.isArray(result1.items)).toBe(true);

  // Test join filter
  let result2 = await result.Foo.bar({}, { filter: "id>1" }, {});
  expect(typeof result2).toBe('object');
  expect(typeof result2.total).toBe('number');
  expect(Array.isArray(result2.items)).toBe(true);

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
  const resolver = new Resolver();
  let result = resolver.getResolvers(false);
  expect(typeof result).toEqual('object');
  done();
});

test('it should get denied on default before hook', async (done) => {
  const resolver = new Resolver();
  resolver.beforeHook.validator = async () => false;
  const callback = async () => {}
  resolver.add('Query', 'getPage', 'foo', callback);
  const resolvers = resolver.getResolvers();
  const result = await resolvers.Query.getPage();
  expect(result).toBeNull();
  done();
});

test('it should add default table resolvers', async (done) => {
  const MockDriver = function() {
    this.dbSchema = dbSchema;
    this.getPrimaryKeyFromSchema = () => 'bar';
    this.getTablesFromSchema = () => {
      return ['foo'];
    };
    this.getTableColumnsFromSchema = () => ['bar'];
    this.pageTotal = async () => 1;
    this.page = async () => []
    this.firstOf = async () => null;
    this.putItem = async () => [1];
  }
  const dbDriver = new MockDriver();
  const resolver = new Resolver(dbDriver);
  resolver.addDefaultFieldsResolvers('foo');
  const resolvers = resolver.getResolvers();
  expect(typeof resolvers.Query.getPageFoo).toBe('function');
  expect(typeof resolvers.Query.getFirstFoo).toBe('function');
  expect(typeof resolvers.Mutation.putItemFoo).toBe('function');
  await resolvers.Query.getPageFoo();
  await resolvers.Query.getFirstFoo();
  await resolvers.Mutation.putItemFoo(null, { input: {}, _debug: true });
  done();
});
