
const query = {
  where: () => query,
  whereIn: () => query,
  whereRaw: () => query
}

module.exports = {
  tablename: 'mockPostgresConvertConditionToWhere',
  query,
  condition: ['=', 'id', 1]
}