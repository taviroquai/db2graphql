module.exports = {
  tablename: 'mockPostgresPutItemFoo',
  argsInsert: {},
  argsUpdate: {id:1},
  result: {
    where: () => ({}),
    returning: (pk) => ({}),
    insert: () => [{id: 1}],
    update: () => [{id: 1}]
  }
}