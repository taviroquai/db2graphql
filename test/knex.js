const mocks = {
  mockPostgresPageFoo: require('./mocks/mockPostgresPageFoo'),
  mockPostgresPageTotalFoo: require('./mocks/mockPostgresPageTotalFoo'),
  mockPostgresFirstOfFoo: require('./mocks/mockPostgresFirstOfFoo'),
  mockPostgresPutItemFoo: require('./mocks/mockPostgresPutItemFoo'),
  mockPostgresConvertConditionToWhere: require('./mocks/mockPostgresConvertConditionToWhere'),
  mockPostgresAddWhereFromArgs: require('./mocks/mockPostgresAddWhereFromArgs'),
  mockPostgresAddPaginationFromArgs: require('./mocks/mockPostgresAddPaginationFromArgs'),
  mockPostgresQueryFoo: require('./mocks/mockPostgresQueryFoo'),
  mockPostgresLoadForeignFoo: require('./mocks/mockPostgresLoadForeignFoo'),
  mockPostgresLoadForeignBar: require('./mocks/mockPostgresLoadForeignBar'),
  mockPostgresLoadReverseFoo: require('./mocks/mockPostgresLoadReverseFoo'),
  mockPostgresLoadReverseBar: require('./mocks/mockPostgresLoadReverseBar'),
};

const raw = {
  'cXVlcnlmb28=': require('./mocks/mockPostgresQueryFoo'),
  'CiAgICAgIFNFTEVDVCB0YWJsZV9uYW1lIGFzIG5hbWUgCiAgICAgIEZST00gaW5mb3JtYXRpb25fc2NoZW1hLnRhYmxlcyAKICAgICAgV0hFUkUgdGFibGVfc2NoZW1hID0gPwogICAgICAKICAgIA==':
    require('./mocks/mockPostgresGetTables'),
  'CiAgICAgIFNFTEVDVCBjb2x1bW5fbmFtZSBhcyBuYW1lLCBpc19udWxsYWJsZSwgZGF0YV90eXBlCiAgICAgIEZST00gaW5mb3JtYXRpb25fc2NoZW1hLmNvbHVtbnMKICAgICAgV0hFUkUgdGFibGVfc2NoZW1hID0gPyBBTkQgdGFibGVfbmFtZSA9ID8KICAgIA==':
    require('./mocks/mockPostgresGetColumns'),
  'CiAgICAgIFNFTEVDVAogICAgICAgIHRjLnRhYmxlX3NjaGVtYSBhcyBzY2hlbWFuYW1lLCAKICAgICAgICB0Yy5jb25zdHJhaW50X25hbWUsIAogICAgICAgIHRjLnRhYmxlX25hbWUgYXMgdGFibGVuYW1lLCAKICAgICAgICBrY3UuY29sdW1uX25hbWUgYXMgY29sdW1ubmFtZSwgCiAgICAgICAgY2N1LnRhYmxlX3NjaGVtYSBBUyBmdGFibGVzY2hlbWEsCiAgICAgICAgY2N1LnRhYmxlX25hbWUgQVMgZnRhYmxlbmFtZSwKICAgICAgICBjY3UuY29sdW1uX25hbWUgQVMgZmNvbHVtbm5hbWUgCiAgICAgIEZST00gCiAgICAgICAgaW5mb3JtYXRpb25fc2NoZW1hLnRhYmxlX2NvbnN0cmFpbnRzIEFTIHRjIAogICAgICBKT0lOIGluZm9ybWF0aW9uX3NjaGVtYS5rZXlfY29sdW1uX3VzYWdlIEFTIGtjdQogICAgICAgIE9OIHRjLmNvbnN0cmFpbnRfbmFtZSA9IGtjdS5jb25zdHJhaW50X25hbWUKICAgICAgICBBTkQgdGMudGFibGVfc2NoZW1hID0ga2N1LnRhYmxlX3NjaGVtYQogICAgICBKT0lOIGluZm9ybWF0aW9uX3NjaGVtYS5jb25zdHJhaW50X2NvbHVtbl91c2FnZSBBUyBjY3UKICAgICAgICBPTiBjY3UuY29uc3RyYWludF9uYW1lID0gdGMuY29uc3RyYWludF9uYW1lCiAgICAgICAgQU5EIGNjdS50YWJsZV9zY2hlbWEgPSB0Yy50YWJsZV9zY2hlbWEKICAgICAgV0hFUkUgdGMuY29uc3RyYWludF90eXBlID0gJ0ZPUkVJR04gS0VZJwogICAgICAgIEFORCB0Yy50YWJsZV9zY2hlbWEgPSA/CiAgICAgICAgQU5EIHRjLnRhYmxlX25hbWUgPSA/OwogICAg':
    require('./mocks/mockPostgresGetForeignKeys'),
  'CiAgICAgIFNFTEVDVCAKICAgICAgICBrY3UuY29sdW1uX25hbWUgYXMgY29sdW1ubmFtZSAKICAgICAgRlJPTSAKICAgICAgICBpbmZvcm1hdGlvbl9zY2hlbWEudGFibGVfY29uc3RyYWludHMgQVMgdGMgCiAgICAgIEpPSU4gaW5mb3JtYXRpb25fc2NoZW1hLmtleV9jb2x1bW5fdXNhZ2UgQVMga2N1CiAgICAgICAgT04gdGMuY29uc3RyYWludF9uYW1lID0ga2N1LmNvbnN0cmFpbnRfbmFtZQogICAgICAgIEFORCB0Yy50YWJsZV9zY2hlbWEgPSBrY3UudGFibGVfc2NoZW1hCiAgICAgIFdIRVJFIHRjLmNvbnN0cmFpbnRfdHlwZSA9ICdQUklNQVJZIEtFWScKICAgICAgICBBTkQgdGMudGFibGVfc2NoZW1hID0gPwogICAgICAgIEFORCB0Yy50YWJsZV9uYW1lID0gPzsKICAgIA==':
    require('./mocks/mockPostgresGetPrimaryKey'),
  'CiAgICAgIFNFTEVDVCB0YWJsZV9uYW1lIGFzIG5hbWUgCiAgICAgIEZST00gaW5mb3JtYXRpb25fc2NoZW1hLnRhYmxlcyAKICAgICAgV0hFUkUgdGFibGVfc2NoZW1hID0gPwogICAgICBBTkQgdGFibGVfbmFtZSBOT1QgSU4gKD8pCiAgICA=':
    require('./mocks/mockPostgresGetTablesExclude')
}

const knexMock = () => {
  const fn = (arg1, arg2) => {
    return mocks[arg1].result;
  }
  fn.raw = (sql, args) => {
    //console.log('raw key', sql, args, btoa(sql));
    return raw[btoa(sql)].result;
  }
  return fn
};

module.exports = jest.fn().mockImplementation(knexMock);