/**
 * 
 * WARNING: this will create and seed millions of records onto
 * the demo database. It may take up to 3-4 hours to complete de seed
 * dependening on the host machine.
 * 
 */

const knex = require('knex');
const connection = require('./connection.json');
const db = knex(connection);

const genString = () => {
  return 'f'+Math.random().toString(36).substr(2, 12);
}

const createAndSeed = async () => {
  await db.schema.dropTableIfExists('posts');
  await db.schema.dropTableIfExists('categories');
  await db.schema.dropTableIfExists('users');
  
  // Fields
  const userFields = [];
  const categoryFields = [];
  const postsFields = [];
  
  // Create schema
  try {
    for (let i = 0; i < 15; i++) userFields.push(genString())
    await db.schema.createTable('users', table => {
      table.increments('id');
      for (let i = 0; i < 15; i++) table.string(userFields[i], 255);
    });
  } catch (err) {}
  
  try {
    for (let i = 0; i < 15; i++) categoryFields.push(genString())
    await db.schema.createTable('categories', table => {
      table.increments('id');
      for (let i = 0; i < 15; i++) table.string(categoryFields[i], 255);
    });
  } catch (err) {}

  try {
    for (let i = 0; i < 50; i++) postsFields.push(genString())
    await db.schema.createTable('posts', table => {
      table.increments('id');
      for (let i = 0; i < 50; i++) table.string(postsFields[i], 255);
      table.bigInteger('user_id').unsigned()
      table.foreign('user_id').references('users.id')
      table.bigInteger('category_id').unsigned()
      table.foreign('category_id').references('categories.id')
    });
  } catch (err) {}

  // Seed
  const users_ids = [], max_users = 50000, max_categories = 1000, max_posts = 1000000;
  for (let i = 0; i < max_users; i++) {
    let data = {};
    for (let j = 0; j < 15; j++) data[userFields[j]] = genString();
    let ids = await db('users').insert(data, ['id']);
    users_ids.push(ids[0]);
    console.log('user', i);
  }

  const categories_ids = [];
  for (let i = 0; i < max_categories; i++) {
    let data = {};
    for (let j = 0; j < 15; j++) data[categoryFields[j]] = genString();
    let ids = await db('categories').insert(data, ['id'])
    console.log(ids);
    categories_ids.push(ids[0]);
    console.log('cat', i);
  }

  const posts_ids = [];
  let uid = 1, cid = 1;
  for (let i = 0; i < max_posts; i++) {
    let data = {};
    for (let j = 0; j < 50; j++) data[postsFields[j]] = genString();
    data['user_id'] = uid;
    data['category_id'] = cid;
    let ids = await db('posts').insert(data, ['id']);
    posts_ids.push(ids[0]);
    console.log(ids);
    uid = uid >= max_users ? 1 : uid+1;
    cid = cid >= max_categories ? 1 : cid+1;
    console.log('post', i);
  }
}

const run = async () => {

  // Check schema exists
  let sql = `
    SELECT count(table_name) as total
    FROM information_schema.tables 
    WHERE table_schema = ? AND table_name = ?
  `;
  let res = await db.raw(sql, ['public', 'posts']);
  res = JSON.parse(JSON.stringify(res));

  // WARNING: It may take up to 3-4 hours to complete the seed of 1 million posts
  if (res.length && res[0][0].total === 0) await createAndSeed();

  // Setup DB2Graphql
  const db2g = require('../src/db2g');
  const api = new db2g('test', db);
  await api.connect(connection.connection.database);
  api.withBuilder();
  const resolvers = api.getResolvers();

  // Test query
  console.time("get 10 users with posts and categories from 1 million posts");
  const args = { pagination: "users:limit=10" }
  await resolvers.Query.getPageUsers(null, args, {});
  console.timeEnd("get 10 users with posts and categories from 1 million posts");

  return true;
}

try {
  run().then(() => process.exit(0))
} catch (err) {}
