import { SingleTableDocument } from './SingleTableDocument';
import {
  KeyOfStr,
  getLSISortKeyAttribute,
  getGSIAttributeName,
  getGSIName,
  getLSIName,
} from './utils';
import { getDefaultTableName } from './createTable';

export type PropList<T> = KeyOfStr<T>[];
export type PropList2<A, B> = (KeyOfStr<A> | KeyOfStr<B>)[];
type BaseIndex<ID, T> = {
  isCustomIndex: boolean,
  hashKeyFields: PropList2<ID, T>;
  hashKeyDescriptor: string;
  hashKeyAttribute: keyof SingleTableDocument | KeyOfStr<T>;

  sortKeyFields: PropList2<ID, T>;
  sortKeyDescriptor: string;
  sortKeyAttribute: keyof SingleTableDocument | KeyOfStr<T>;

  tag?: string;
};
export type Index<ID, T> = (
  | { type: 'primaryIndex' }
  | {
      type: 'localSecondaryIndex' | 'globalSecondaryIndex';
      indexName: string;
    }) &
  BaseIndex<ID, T>;

export function getPrimaryIndex<ID, T>(
  config: ConfigArgs<ID, T>,
  tag: string = ''
): Index<ID, T> {
  return {
    isCustomIndex: false,
    hashKeyFields: config.hashKeyFields,
    hashKeyDescriptor: config.objectName,
    hashKeyAttribute: '__hashKey',

    sortKeyFields: config.sortKeyFields || [],
    sortKeyDescriptor: config.objectName,
    sortKeyAttribute: '__sortKey',

    type: 'primaryIndex',

    tag,
  };
}

function isPrimaryQueryArg(thing: any): thing is PrimaryQueryArg {
  return thing && thing.isPrimary;
}

function isLSIQueryArg<T>(thing: any): thing is LSIQueryArg<T> {
  return thing && thing.sortKeyFields && !thing.hashKeyFields;
}

function isGSIQueryArg<T>(thing: any): thing is GSIQueryArg<T> {
  return thing && thing.sortKeyFields && thing.hashKeyFields;
}

function isCustomGSIQueryArg<T>(thing: any): thing is CustomGSIQueryArg<T> {
  return thing && thing.hashKeyAttributeName && thing.sortKeyAttributeName;
}

export function convertQueryArgToIndex<ID, T>(
  queryName: string,
  config: ConfigArgs<ID, T>
): Index<ID, T> {
  let index = (config.indexes || {})[queryName];
  if (isPrimaryQueryArg(index)) {
    return getPrimaryIndex(config, queryName);
  } else if (isLSIQueryArg(index)) {
    return getLSIIndex<ID, T>(queryName, index, config);
  } else if (isGSIQueryArg(index)) {
    return getGSIIndex<ID, T>(queryName, index, config);
  } else if (isCustomGSIQueryArg(index)) {
    return getCustomGSIIndex<ID, T>(queryName, index, config);
  } else {
    throw { message: `${queryName} is not valid` };
  }
}
export function getLSIIndex<ID, T>(
  queryName: string,
  i: LSIQueryArg<T>,
  config: ConfigArgs<ID, T>
): Index<ID, T> {
  return {
    isCustomIndex: false,
    hashKeyFields: config.hashKeyFields,
    hashKeyDescriptor: config.objectName,
    hashKeyAttribute: '__hashKey',

    sortKeyFields: i.sortKeyFields,
    sortKeyDescriptor: queryName,
    sortKeyAttribute: getLSISortKeyAttribute(
      i.which
    ) as keyof SingleTableDocument,

    indexName: getLSIName(i.which),

    type: 'localSecondaryIndex',

    tag: queryName,
  };
}

export function getCustomGSIIndex<ID, T>(
  queryName: string,
  i: CustomGSIQueryArg<T>,
  config: ConfigArgs<ID, T>
): Index<ID, T> {
  return {
    isCustomIndex: true,
    hashKeyFields: [],
    hashKeyDescriptor: config.objectName + '-' + queryName,
    hashKeyAttribute: i.hashKeyAttributeName,

    sortKeyFields: [],
    sortKeyDescriptor: queryName,
    sortKeyAttribute: i.sortKeyAttributeName,

    indexName: i.indexName || queryName,

    type: 'globalSecondaryIndex',

    tag: queryName,
  }
}

export function getGSIIndex<ID, T>(
  queryName: string,
  i: GSIQueryArg<T>,
  config: ConfigArgs<ID, T>
): Index<ID, T> {
  return {
    isCustomIndex: false,
    hashKeyFields: i.hashKeyFields,
    hashKeyDescriptor: config.objectName + '-' + queryName,
    hashKeyAttribute: getGSIAttributeName(
      i.which,
      'Hash'
    ) as keyof SingleTableDocument,

    sortKeyFields: i.sortKeyFields,
    sortKeyDescriptor: queryName,
    sortKeyAttribute: getGSIAttributeName(
      i.which,
      'Sort'
    ) as keyof SingleTableDocument,

    indexName: getGSIName(i.which),

    type: 'globalSecondaryIndex',

    tag: queryName,
  };
}

type PrimaryQueryArg = {
  isPrimary: true;
};

type LSIQueryArg<T> = {
  sortKeyFields: PropList<T>;
  type?: 'localSecondaryIndex';
  which: 0 | 1 | 2 | 3 | 4;
};

type CustomGSIQueryArg<T> = {
  type: 'globalSecondaryIndex'
  hashKeyAttributeName: KeyOfStr<T>,
  sortKeyAttributeName: KeyOfStr<T>,
  indexName?: string
}

type GSIQueryArg<T> = {
  sortKeyFields: PropList<T>;
  hashKeyFields: PropList<T>;
  type?: 'globalSecondaryIndex';
  which:
    | 0
    | 1
    | 2
    | 3
    | 4
    | 5
    | 6
    | 7
    | 8
    | 9
    | 10
    | 11
    | 12
    | 13
    | 14
    | 15
    | 16
    | 17
    | 18
    | 19;
};

export type ConfigArgs<ID, T, QueryNames = string> = {
  tableName?: string;
  objectName: string;
  hashKeyFields: PropList<ID>;
  sortKeyFields?: PropList<ID>;
  compositeKeySeparator?: '#';
  shouldPadNumbersInIndexes?: boolean,
  paddedNumberLength?: number,
  indexes?: Record<
    Extract<QueryNames, string>,
    GSIQueryArg<T> | LSIQueryArg<T> | PrimaryQueryArg | CustomGSIQueryArg<T>
  >;
};

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export function getConfig<ID, T>(
  argsIn: PartialBy<ConfigArgs<ID, T>, 'indexes'>
): Config<ID, T> {
  const args: ConfigArgs<ID, T> = Object.assign({
    shouldPadNumbersInIndexes: true,
    paddedNumberLength: 20,
    queries: {}
  }, argsIn);
  let indexes = [
    getPrimaryIndex(args),
    ...(args.indexes
      ? Object.keys(args.indexes).map(queryName =>
          convertQueryArgToIndex(queryName, args)
        )
      : []),
  ];

  let indexesByTag = indexes.reduce((prev, index) => {
    return {
      ...prev,
      [index.tag as string]: index,
    };
  }, {});

  return Object.assign(
    {
      tableName: args.tableName || getDefaultTableName(),
      compositeKeySeparator: args.compositeKeySeparator || '#',
      shouldPadNumbersInIndexes: args.shouldPadNumbersInIndexes!,
      paddedNumberLength: args.paddedNumberLength || 20
    },
    {
      objectName: args.objectName,
      primaryIndex: indexes[0],
      indexes,
      indexesByTag,
    }
  );
}

export type Config<ID, T, QueryNames = string> = Readonly<{
  tableName: string;
  objectName: string;
  primaryIndex: Index<ID, T>;
  indexes: Index<ID, T>[];
  paddedNumberLength: number
  shouldPadNumbersInIndexes: boolean
  indexesByTag: Record<Extract<QueryNames, string>, Index<ID, T>>;
  compositeKeySeparator: string;
}>;
