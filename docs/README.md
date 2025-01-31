<p align="center">
  <a href="https://www.npmjs.com/package/nestjs-graphql-tools" target="blank"><img src="https://raw.githubusercontent.com/Adrinalin4ik/Nestjs-Graphql-Tools/master/images/svg.svg" width="200" alt="NestJS Graphql tools Logo" /></a>
</p>
<h1 align="center">NestJS graphql Tools</h1>
<p align="center"><a href="http://nestjs.com/" target="_blank">NestJS</a> Graphql automation library for building performant API</p>
<p align="center">
  <a href="https://www.npmjs.com/package/nestjs-graphql-tools" target="_blank"><img src="https://img.shields.io/npm/v/nestjs-graphql-tools.svg" alt="NPM Version" /></a>
  <a href="https://www.npmjs.com/package/nestjs-graphql-tools" target="_blank"><img src="https://img.shields.io/npm/l/nestjs-graphql-tools.svg" alt="Package License" /></a>
  <a href="https://www.npmjs.com/package/nestjs-graphql-tools" target="_blank"><img src="https://img.shields.io/npm/dm/nestjs-graphql-tools.svg" alt="NPM Downloads" /></a>
</p>


## Description

The library allows to build efficient graphql API helping overcome n+1 problem and building hasura-like search interface with the minimum dependencies.

## Overview
- [Loader](#data-loader-n1-resolver)
- [Polymorphic relations](#polymorphic-relations)
- [Filtering](#filters)
- [Pagination](#pagination)
- [Sorting](#sorting)
- [Exclusion](#exclusion)
- [Field extraction](#field-extraction)
- [Base models and inheritance](#base-models-and-inheritance)
- [More examples](#more-examples)
- [Contribution](#contribution)


## Installation

```bash
$ npm i nestjs-graphql-tools
```

## Data Loader n+1 problem solver
#### Loader usage guide
  1. Decorate your resolver with `@GraphqlLoader()`
  2. Add `@Loader()` parameter as a first parameter
  3. @Loader will return you LoaderData interface which includes ids of entities and helpers for constructing sutable object for graphql

##### Example 1. One to many example.

```typescript
@Resolver(() => UserObjectType) 
export class UserResolver {

  @ResolveField(() => TaskObjectType)
  @GraphqlLoader()
  async tasks(
    @Loader() loader: LoaderData<TaskObjectType, number>,
    @Args('story_points') story_points: number, // custom search arg
  ) {
    const tasks = await getRepository(Task).find({
      where: {
        assignee_id: In<number>(loader.ids) // assignee_id is foreign key from Task to User table
        story_points
      }
    });

    return loader.helpers.mapOneToManyRelation(tasks, loader.ids, 'assignee_id'); // this helper will construct an object like { <assignee_id>: Task }. Graphql expects this shape.
  }
}
```

##### Example 2. Many to one relation.
```typescript
@Resolver(() => TaskObjectType)
export class TaskResolver {

  constructor(
    @InjectRepository(User) public readonly userRepository: Repository<User>
  ) {}

  @ResolveField(() => UserObjectType)
  @GraphqlLoader({
    foreignKey: 'assignee_id' // Here we're providing foreigh key. Decorator gather all the keys from parent and provide it in loader.ids
  })
  async assignee(
    @Loader() loader: LoaderData<TaskObjectType, number>,
    @Filter(() => UserObjectType) filter: Brackets,
  ) {
    const qb = this.userRepository.createQueryBuilder('u')
      .where(filter)
      .andWhere({
        id: In(loader.ids) // Here will be assigne_ids
      })
    const users = await qb.getMany();
    return loader.helpers.mapManyToOneRelation(users, loader.ids); // This helper provide the shape {assignee_id: User}
  }
}
```
## Polymorphic relations
`@GraphqlLoader` decorator provides ability to preload polymorphic relations
#### Usage
To be able to use it you need to decorate your resolver with `@GraphqlLoader` decorator. Decorator has parameter which allows to specify fields which needs to be gathered for polymorphic relation.

```typescript
@GraphqlLoader({
  polymorphic: {
    idField: 'description_id', // Name of polymorphic id attribute of the parent model
    typeField: 'description_type' // Name of polymorphic type attribute of the parent model
  }
})
```
This decorator will aggregate all types and provide ids for each type. All aggregated types will be aveilable in `@Loader` decorator. It has attribute which called `polymorphicTypes. 

##### PolmorphicTypes attribute shape 
```typescript
[
  {
    type: string | number
    ids: string[] | number[]
  }
]

```

##### Example 1

```typescript
// Parent class
// task.resolver.ts
@Resolver(() => TaskObjectType)
export class TaskResolver {
  constructor(
    @InjectRepository(Task) public readonly taskRepository: Repository<Task>,
    @InjectRepository(Description) public readonly descriptionRepository: Repository<Description>
  ) {}

  @ResolveField(() => [DescriptionObjectType])
  @GraphqlLoader()
  async descriptions(
    @Loader() loader: LoaderData<TaskObjectType, number>,
    @SelectedUnionTypes({ 
      nestedPolymorphicResolverName: 'descriptionable',
    }) selectedUnions: SelectedUnionTypesResult // <-- This decorator will gather and provide selected union types. NestedPolymorphicResolverName argument allows to specify where specifically it should gather the fields
  ) {
    // Mapping graphql types to the database types
    const selectedTypes = Array.from(selectedUnions.types.keys()).map(type => { 
      switch (type) {
        case DescriptionTextObjectType.name:
          return DescriptionType.Text;
        case DescriptionChecklistObjectType.name:
          return DescriptionType.Checklist;
      }
    });

    const qb = this.descriptionRepository.createQueryBuilder('d')
      .andWhere({
        task_id: In(loader.ids),
        description_type: In(selectedTypes) // finding only selected types
      })
    
    const descriptions = await qb.getMany();
    return loader.helpers.mapOneToManyRelation(descriptions, loader.ids, 'task_id');
  }
}


// Polymorphic resolver
// description.resolver.ts
@Resolver(() => DescriptionObjectType)
export class DescriptionResolver {
  constructor(
    @InjectRepository(DescriptionText) public readonly descriptionTextRepository: Repository<DescriptionText>,
    @InjectRepository(DescriptionChecklist) public readonly descriptionChecklistRepository: Repository<DescriptionChecklist>,
  ) {}
  
  @ResolveField(() => [DescriptionableUnion], { nullable: true })
  @GraphqlLoader({ // <-- We will load description_id field of parent model to the ids and description_type field to the type
    polymorphic: {
      idField: 'description_id',
      typeField: 'description_type'
    }
  })
  async descriptionable(
    @Loader() loader: PolymorphicLoaderData<[DescriptionText | DescriptionChecklist], number, DescriptionType>, // <-- It will return aggregated polymorphicTypes
    @SelectedUnionTypes() types: SelectedUnionTypesResult // <-- It will extract from the query and return selected union types
  ) {
    const results = []; // <-- We need to gather all entities to the single array

    for (const item of loader.polimorphicTypes) {
      switch(item.descriminator) {
        case DescriptionType.Text:
          const textDescriptions = await this.descriptionTextRepository.createQueryBuilder()
          .select(types.getFields(DescriptionTextObjectType))
          .where({
            id: In(item.ids)
          })
          .getRawMany();

          results.push({ descriminator: DescriptionType.Text, entities: textDescriptions })

          break;
        case DescriptionType.Checklist:
          const checklistDescriptions = await this.descriptionChecklistRepository.createQueryBuilder()
          .select(types.getFields(DescriptionChecklistObjectType))
          .where({
            id: In(item.ids)
          })
          .getRawMany();

          results.push({ descriminator: DescriptionType.Checklist, entities: checklistDescriptions })
          
          break;
        default: break;
      }
    }
    return loader.helpers.mapOneToManyPolymorphicRelation(results, loader.ids); // <-- This helper will change shape of responce to the shape which is sutable for graphql
  }
}
```
You can find complete example in src/descriptions folder


## Filters
Filter is giving ability to filter out entities by the condition. Condition looks similar to hasura interface using operators `eq, neq, gt, gte, lt, lte, in, like, notlike, between, notbetween, null`.
By default it generates filter based on provided model. It supports only first level of the tables hierachy. If you need to search in depth you can declare custom filters (example 3).

##### Example 1

```graphql
{
  users(where: {id: {eq: 1}}) {
    id
  }
}
```
##### Example 2
```graphql
{
  users(
    where: {
      and: [
        {
          email: {like: "yahoo.com"}
        }
        {
          email: {like: "google.com"}
        }
      ],
      or: {
        id: {
          between: [1,2,3]
        }
      }
    }
  ) {
    id
  }
}
```

#### Filter usage guide
1. Decorate your resolver with `@GraphqlFilter()` or `@GraphqlLoader()` (this one is already includes `@GraphqlFilter()` inside)
2. Add `@Filter()` parameter with type of `Brackets` from typeorm library
3. `@Filter()` will return typeorm compatible condition which you can use in your query builder.

##### Example 1. Query.

```typescript
@Resolver(() => UserObjectType)
export class UserResolver {
  constructor(
    @InjectRepository(Task) public readonly taskRepository: Repository<Task>,
    @InjectRepository(User) public readonly userRepository: Repository<User>
  ) {}

  @Query(() => [UserObjectType])
  @GraphqlFilter() // This decorator will put the data to the filter argument
  users(
    @Filter(() => UserObjectType) filter: Brackets, // It will return  typeorm condition
    @Args('task_title', {nullable: true}) taskTitle: string, // You can add custom additional filter if needed
  ) {
    const qb = this.userRepository.createQueryBuilder('u')
      .leftJoin('task', 't', 't.assignee_id = u.id')
      .where(filter)
      if (taskTitle) {
        qb.andWhere(`t.title ilike :title`, { title: `%${taskTitle}%` })
      }

    return qb.getMany()
  }
}
```

##### Example 2. Combination with loader

```typescript
@Resolver(() => UserObjectType)
export class UserResolver {
  constructor(@InjectRepository(Task) public readonly taskRepository: Repository<Task>) {}

  @ResolveField(() => TaskObjectType)
  @GraphqlLoader() // This decorator already includes @GraphqlFilter()
  async tasks(
    @Loader() loader: LoaderData<TaskObjectType, number>,
    @Filter(() => TaskObjectType) filter: Brackets,
  ) {
    const qb = this.taskRepository.createQueryBuilder()
    .where(filter)
    .andWhere({
      assignee_id: In<number>(loader.ids)
    });

    const tasks = await qb.getMany();
    
    return loader.helpers.mapOneToManyRelation(tasks, loader.ids, 'assignee_id');
  }
}
```
##### Example 3. Custom filters

```typescript
export class UserFilterInputType {
  @FilterField(() => String, { sqlExp: 't.title'})
  task_title: string;

  @FilterField(() => String, { sqlExp: 't.story_points'})
  task_story_points: number;
  
  @FilterField(() => String, { sqlExp: 'concat(u.fname, \' \', u.lname)'})
  full_name: string;
}

// Resolver
@Resolver(() => UserObjectType)
export class UserResolver {
  constructor(
    @InjectRepository(Task) public readonly taskRepository: Repository<Task>,
    @InjectRepository(StoryModel) public readonly storyRepository: Repository<StoryModel>,
    @InjectRepository(User) public readonly userRepository: Repository<User>
  ) {}

  @Query(() => [UserObjectType])
  @GraphqlFilter()
  @GraphqlSorting()
  users(
    @Filter(() => [UserObjectType, UserFilterInputType]) filter: Brackets, // <-- Object model and Filter model. It is possible to provide only one model or more that 2.
    @Sorting(() => UserObjectType, { sqlAlias: 'u' }) sorting: SortArgs<UserObjectType>
  ) {
    const qb = this.userRepository.createQueryBuilder('u')
      .leftJoin('task', 't', 't.assignee_id = u.id')
      .where(filter);
      
      if (sorting) {
        qb.orderBy(sorting)
      }

    return qb.getMany()
  }
}
```

## Exclusion
Sometimes you don't want to provide filters/sorting by all the fields in the dto. There's a couple decorators that can help with it `@FilterField({exclude: true}) ` and `@SortingField({exclude: true})`

##### Example
```typescript

@ObjectType()
export class User {
  @Field(() => String)
  fname: string;

  @Field(() => String)
  @FilterField({exclude: true})
  @SortingField({exclude: true})
  mname: string;

  @Field(() => String)
  lname: string;
}

export class UserResolver {
  @Query(() => [UserObjectType])
  @GraphqlFilter()
  @GraphqlSorting()
  users(
    @Filter(() => [UserObjectType], {sqlAlias: 'u'}) filter: Brackets,
    @Sorting(() => [UserObjectType], { sqlAlias: 'u' }) sorting: SortArgs<UserObjectType>
  ) {
    const qb = this.userRepository.createQueryBuilder('u')
      .where(filter);
      
      if (sorting) {
        qb.orderBy(sorting)
      }

    return qb.getMany()
  }
}

```

Now, if you try to build a query with the sorting an filtering by mname you'll get an error, because there's not such field in the graphql schema definition for sorting and filtering.

## Pagination
The library provides parameter decorator `@Paginator()` for the pagination. This decorator returns object like that

```typescript
{
  page: number,
  per_page: number
}

```

##### Full example

```typescript
@Resolver(() => TaskObjectType)
export class TaskResolver {
  constructor(@InjectRepository(Task) public readonly taskRepository: Repository<Task>) {}

  @Query(() => [TaskObjectType])
  async tasks(
   @Paginator() paginator: PaginatorArgs,
  ) {
    const qb = this.taskRepository.createQueryBuilder('t');
    
    if (paginator) {
      qb.offset(paginator.page * paginator.per_page).limit(paginator.per_page)
    }

    return qb.getMany();
  }
}
```

## Sorting
The library provides ability to make sorting. To make sorting works you need to decorate your resolver with `@GraphqlSorting()` or `@GraphqlLoader()`. It supports all types of sorting.
`[ASC/DESC] [NULLS FIRST/LAST]`

##### Example 1

```graphql
{
  users(
    order_by: {
      id: ASC_NULLS_LAST
    }
  ) {
    id
  }
}
```
```typescript
@Resolver(() => TaskObjectType)
export class TaskResolver {
  constructor(@InjectRepository(Task) public readonly taskRepository: Repository<Task>) {}

  @Query(() => [TaskObjectType])
  @GraphqlSorting()
  async tasks(
    /* SqlAlias is an ptional argument. Allows to provide alias in case if you have many tables joined. In current case it doesn't required */
    @Sorting(() => TaskObjectType, { sqlAlias: 't' }) sorting: SortArgs<TaskObjectType>
  ) {
    const qb = this.taskRepository.createQueryBuilder('t');
    
    if (sorting) {
      qb.orderBy(sorting);
    }
    return qb.getMany();
  }
}
```

##### Example 2. Sorting by custom fields
```typescript
// sorting.dto.ts
export class UserSortingInputType {
  @SortingField({sqlExp: 't.story_points'})
  task_story_points: number;
}

// user.resolver.ts
@Resolver(() => UserObjectType)
export class UserResolver {
  constructor(
    @InjectRepository(Task) public readonly taskRepository: Repository<Task>,
    @InjectRepository(StoryModel) public readonly storyRepository: Repository<StoryModel>,
    @InjectRepository(User) public readonly userRepository: Repository<User>
  ) {}

  @Query(() => [UserObjectType])
  @GraphqlSorting()
  users(
    /* SqlAlias is an optional argument. You can provide alias in case if you have many tables joined.
    Object model and Sorting model. Ability to provide 1+ model. It accepts both Object and Sorting models. Next model in array extends previous model overriding fields with the same names.
    */
    @Sorting(() => [UserObjectType, UserSortingInputType], { sqlAlias: 'u' }) sorting: SortArgs<UserObjectType>
  ) {
    const qb = this.userRepository.createQueryBuilder('u')
      .leftJoin('task', 't', 't.assignee_id = u.id');
      
      if (sorting) {
        qb.orderBy(sorting)
      }

    return qb.getMany()
  }
}
```

## Field extraction
The library allows to gather only requested field from the query and provides it as an array to the parameter variable.

##### Example

Simple graphql query
```graphql
{
  tasks {
    id
    title
  }
}

```
Resolver

```typescript
@Resolver(() => TaskObjectType)
export class TaskResolver {
  constructor(@InjectRepository(Task) public readonly taskRepository: Repository<Task>) {}

  @Query(() => [TaskObjectType])
  @GraphqlFilter()
  async tasks(
   @Filter(() => TaskObjectType) filter: Brackets,
   @SelectedFields({sqlAlias: 't'}) selectedFields: SelectedFieldsResult // Requested fields will be here. sqlAlias is optional thing. It useful in case if you're using alias in query builder
  ) {
    const res = await this.taskRepository.createQueryBuilder('t')
      .select(selectedFields.fieldsData.fieldsString) // fieldsString return array of strings
      .where(filter)
      .getMany();
    return res;
  }
}
```

The query will generate typeorm request with only requested fields
```sql
SELECT "t"."id" AS "t_id", "t"."title" AS "t_title" FROM "task" "t"
```

## Base models and inheritance
In order to make base model with common attributes it is required to decorate base model with the `@InheritedModel()` decorator. You can find usage of it in base.dto.ts file inside src folder.

##### Example
```typescript
@ObjectType()
@InheritedModel() // <-- Make inheritance possible. If you not decorate object with this decorator, you will not see these properties in "where" and sorting statements
export class BaseDTO {
  @Field(() => Int)
  id: number;

  // Timestamps
  @Field(() => Date)
  created_at: Date;

  @Field(() => Date)
  updated_at: Date;
}
```

## Options
Options are ENV variables that you can provide to configurate the lib
- `FILTER_OPERATION_PREFIX` - Operation prefix. You can make hasura-like prefix for where operators like _eq, _neq, etc. Example `FILTER_OPERATION_PREFIX=\_`


## More examples
You can find more examples in the src folder


## Contribution
If you want to contribute please create new PR with good description.

How to run the project:
1. Create a database
```bash
createdb -h localhost -U postgres nestjs_graphql_tools_development_public;
```
2. Fill out database config in `config/default.json`
3. Run dev server
```bash
npm i
npm run start:dev
```
On the first run, server will seed up the database with testing dataset.

4. Reach out `http://localhost:3000/graphql`

## License

NestJS Graphql tools is [GNU GPLv3 licensed](LICENSE).
