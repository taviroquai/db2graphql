
const query = {
  where: () => query,
  first: () => query
}

module.exports = {
  tablename: 'mockPostgresLoadForeignFoo',
  item: {},
  args: {},
  result: query,
  toEqual: { mockPostgresLoadForeignBar: {} }
}