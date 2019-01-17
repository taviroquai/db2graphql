const { start } = require('./demo_server');
  
start(({ resolver }) => {

  // Example of how to hook your resolver for custom behaviour
  // API: getPage, getFirstOf and putItem
  resolver.on('getFirstOf', async (root, args, context) => {
    const { resolver, tablename, db } = context.ioc;
    
    // You can have direct access to knex instance
    // const user = await db.table(tablename).where(args.field, args.value).first();

    // Use default result
    const user = await resolver.getFirstOf(tablename, args);

    // Transform data
    delete user.password;

    // Send output
    console.log('My resolver result', user);
    return user;
  });
});
