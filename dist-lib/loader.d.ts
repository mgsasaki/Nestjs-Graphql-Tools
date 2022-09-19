/// <reference types="node" />
import { ExecutionContext } from '@nestjs/common';
import DataLoader from 'dataloader';
import { IncomingMessage } from 'http';
import { SelectedUnionTypesResult } from './union-type-extractor';
export interface LoaderHelper<DtoType> {
    mapOneToManyRelation: (entities: object[], ids: any[], foreignKey: string) => {
        [key: string]: DtoType;
    };
    mapOneToManyPolymorphicRelation: (entities: {
        descriminator: string;
        entities: object[];
    }[], typeIds: {
        descriminator: string | any;
        id: any;
    }, foreignKey?: string) => {
        [key: string]: DtoType;
    };
    mapManyToOneRelation: (entities: object[], ids: any[], foreignKey?: string) => {
        [key: string]: DtoType;
    };
}
export interface ILoaderInstance<DtoType, IdType> {
    _loader: {
        [key: string]: DataLoader<DtoType[], IdType[]>;
    };
}
export interface LoaderData<DtoType, IdType> {
    name: string;
    parent: any;
    ids: IdType[];
    polimorphicTypes: IdType[];
    ctx: ExecutionContext;
    req: IncomingMessage & ILoaderInstance<DtoType, IdType>;
    helpers: LoaderHelper<DtoType>;
}
export interface PolymorphicLoaderData<DtoType, IdType, DescriminatorType> {
    name: string;
    parent: any;
    ids: {
        descriminator: DescriminatorType;
        id: IdType;
    };
    polimorphicTypes: {
        descriminator: DescriminatorType;
        ids: IdType[];
    }[];
    ctx: ExecutionContext;
    req: IncomingMessage & ILoaderInstance<DtoType, IdType>;
    helpers: LoaderHelper<DtoType>;
    selectedUnions: SelectedUnionTypesResult;
}
export interface GraphqlLoaderOptions {
    foreignKey?: string;
    polymorphic?: {
        idField: string;
        typeField: string;
    };
    sorting?: {
        alias?: string;
    };
}
export declare const Loader: (...dataOrPipes: unknown[]) => ParameterDecorator;
export declare const GraphqlLoader: (args?: GraphqlLoaderOptions) => (target: any, property: any, descriptor: any) => void;
export declare const mapOneToManyRelation: (entities: object[], ids: any[], foreignKey: any) => any[];
export declare const mapOneToManyPolymorphicRelation: (entities: {
    descriminator: string;
    entities: object[];
}[], typeIds: {
    descriminator: string | any;
    id: any;
}[], foreignKey?: string) => any[];
