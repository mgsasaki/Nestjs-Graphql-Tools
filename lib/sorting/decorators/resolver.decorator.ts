import { Args } from "@nestjs/graphql";
import { BaseEntity } from "../../common";
import { standardize } from "../../utils/functions";
import { GRAPHQL_SORTING_DECORATOR_METADATA_KEY, SORTING_DECORATOR_CUSTOM_FIELDS_METADATA_KEY, SORTING_DECORATOR_OPTIONS_METADATA_KEY } from "../constants";
import { getSortingFullInputType } from "../input-type-generator";
import { applySortingParameter } from "../query.builder";
import { GraphqlSortingFieldMetadata, GraphqlSortingTypeDecoratorMetadata } from "./field.decorator";

export interface ISortingDecoratorParams {
  name?: string;
  sqlAlias?: string;
}


// @GraphqlSorting decorator
export const GraphqlSorting = () => {
  return (target, property, descriptor) => {
    const actualDescriptor = descriptor.value;
    descriptor.value = function(...args) {
      applySortingParameter(args, target, property);
      return actualDescriptor.call(this, ...args);
    };
    Reflect.defineMetadata(GRAPHQL_SORTING_DECORATOR_METADATA_KEY, '', target, property); // for graphql loader
  };
};


// @Sorting decorator
export const Sorting = (baseEntity: () => BaseEntity | BaseEntity[], options?: ISortingDecoratorParams) => {
  return (target, propertyName, paramIndex) => {
    const name = `${standardize(target.constructor.name)}_${standardize(propertyName)}`;
    // convert params to array
    const extractedResults = baseEntity();
    let typeFunctions = extractedResults as BaseEntity[];
    if (!Array.isArray(extractedResults)) {
      typeFunctions = [extractedResults];
    }
    const sortingFullType = getSortingFullInputType(typeFunctions, name);
    

    // Combine fields from all models together
    const customFields = typeFunctions.reduce((acc, typeFn) => {
      const customSortingData: GraphqlSortingTypeDecoratorMetadata = Reflect.getMetadata(SORTING_DECORATOR_CUSTOM_FIELDS_METADATA_KEY, typeFn.prototype)
      if (customSortingData) {
        for (const field of customSortingData.fields.values()) {
          acc.set(field.name, field)
        }
      }
      return acc;
    }, new Map<string, GraphqlSortingFieldMetadata>());

    Reflect.defineMetadata(SORTING_DECORATOR_OPTIONS_METADATA_KEY, options, target, propertyName);
    Reflect.defineMetadata(SORTING_DECORATOR_CUSTOM_FIELDS_METADATA_KEY, customFields, target, propertyName);
    Args({
      name: options?.name || 'order_by',
      nullable: true,
      defaultValue: {},
      type: () => [sortingFullType],
    })(target, propertyName, paramIndex);
  }
}