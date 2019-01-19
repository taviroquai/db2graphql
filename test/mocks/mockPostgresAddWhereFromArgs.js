
const query = {
  where: () => query,
  whereIn: () => query,
  whereRaw: () => query
}

module.exports = {
  tablename: 'mockPostgresAddWhereFromArgs',
  query,
  args: {
    filter: {
      mockPostgresAddWhereFromArgs: [
        ['=', 'id', 1]
      ]
    }
  },
  argsEmpty: {
    filter: {}
  }
}