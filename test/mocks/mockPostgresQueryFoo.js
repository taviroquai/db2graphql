
const query = {
  limit: () => query,
  offset: () => query,
  orderBy: () => query
}

module.exports = {
  result: {rows: []},
  sql: 'queryfoo',
  params: [],
  toEqual: {rows: []}
}