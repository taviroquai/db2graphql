module.exports = {
  tablename: 'mockPostgresPutItemFoo',
  argsInsert: {},
  argsUpdate: {id:1},
  result: {
    "bar": {
      "__pk": "id",
      "__reverse": [
        {
          "columnname": "foo",
          "fcolumnname": "bar",
          "fschemaname": undefined,
          "ftablename": undefined
        },
        {
          "columnname": "foo",
          "fcolumnname": "bar",
          "fschemaname": undefined,
          "ftablename": undefined
        }
      ],
      "bar": {
        "__foreign": {
          "columnname": "foo",
          "schemaname": "public",
          "tablename": "bar"
        },
        "data_type": "integer",
        "is_nullable": undefined,
        "name": "bar"
      },
      "foo": {
        "data_type": "integer",
        "is_nullable": undefined,
        "name": "foo"
      }
    },
    "foo": {
      "__pk": "id",
      "__reverse": [],
      "bar": {
        "__foreign": {
          "columnname": "foo",
          "schemaname": "public",
          "tablename": "bar"
        },
        "data_type": "integer",
        "is_nullable": undefined,
        "name": "bar"
      },
      "foo": {
        "data_type": "integer",
        "is_nullable": undefined,
        "name": "foo"
      }
    }
  }
}