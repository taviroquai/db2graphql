
const query = {
  limit: () => query,
  offset: () => query,
  orderBy: () => query
}

module.exports = {
  tablename: 'mockPostgresAddPaginationFromArgs',
  query,
  argsEmpty: {
    pagination: {}
  },
  args: {
    pagination: {
      mockPostgresAddPaginationFromArgs: [
        ['limit', 1],
        ['offset', 1],
        ['orderby', 'id desc']
      ]
    }
  }
}