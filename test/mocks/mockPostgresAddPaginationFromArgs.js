
const query = {
  limit: () => query,
  offset: () => query,
  orderBy: () => query
}

module.exports = {
  tablename: 'mockPostgresAddPaginationFromArgs',
  query,
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