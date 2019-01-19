module.exports = {
  result1: "type Foo {\n  id: Int,\n  bar: [Bar]\n}",
  result2: "type Bar {\n  id: Int,\n  foo_id: Int,\n  foo: Foo\n}",
  result3: "putItemFoo (\n    id: Int\n  ): Foo",
  result4: "type Bar {\n  id: Int,\n  foo_id: Int,\n  foo: Foo\n}\n\ntype PageBar{\n  total: Int,\n  tablename: String,\n  items: [Bar]\n}\n\ntype Foo {\n  id: Int,\n  bar: [Bar]\n}\n\ntype PageFoo{\n  total: Int,\n  tablename: String,\n  items: [Foo]\n}\n\ntype Query {\n  getPageBar(filter: String, pagination: String): PageBar\n  getFirstOfBar(filter: String, pagination: String): Bar\n  getPageFoo(filter: String, pagination: String): PageFoo\n  getFirstOfFoo(filter: String, pagination: String): Foo\n}\n\ntype Mutation {\n  putItemBar (\n    id: Int,\n    foo_id: Int\n  ): Bar\n\n  putItemFoo (\n    id: Int\n  ): Foo\n}",
  result5: "type Bar {\n\n}",
  result6: "putItemBar (\n\n  ): Bar",
  dbSchema: {
    "bar": {
      "__reverse": [],
      "id": {
        "data_type": "integer",
        "name": "id"
      },
      "foo_id": {
        "data_type": "integer",
        "name": "foo_id",
        "__foreign": {
          "schemaname": "public",
          "tablename": "foo",
          "columnname": "id"
        }
      }
    },
    "foo": {
      "__reverse": [
        {
          "ftablename": "bar"
        }
      ],
      "id": {
        "data_type": "integer",
        "name": "id"
      }
    }
  },
  dbSchemaInvalidField: {
    "bar": {
      "__reverse": [],
      "id": {
        "data_type": "ops",
        "name": "id"
      }
    }
  }
}