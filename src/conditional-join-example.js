const { ApolloServer, gql } = require("apollo-server");
const knex = require("knex")({
  client: "sqlite3",
  connection: {
    filename: "./mydb.sqlite"
  }
});
const faker = require("faker");

const typeDefs = gql`
  type Author {
    id: ID!
    name: String!
  }

  type Book {
    id: ID!
    title: String
    author: Author!
  }

  type Query {
    books: [Book]
  }
`;

const resolvers = {
  Query: {
    books: async (_, __, ___, info) => {
      const shouldJoinAuthTable = !!info.fieldNodes
        .find(x => x.name.value === "books")
        .selectionSet.selections.find(x => x.name.value === "author");

      const qb = knex("books")
        .select()
        .limit(5);

      if (shouldJoinAuthTable) {
        qb.leftJoin("users", "users.id", "books.authorId");
      }

      const books = await qb;

      return shouldJoinAuthTable
        ? books.map(x => ({
            ...x,
            author: {
              id: x.authorId,
              name: x.name
            }
          }))
        : books;
    }
  }
};

knex("users")
  .select()
  .limit(1)
  .catch(async err => {
    if (err.message.includes("no such table")) {
      await knex.schema.createTable("users", table => {
        table.increments("id");
        table.string("name");
      });
      await knex.schema.createTable("books", table => {
        table.increments("id");
        table.string("title");
        table.integer("authorId");
        table.foreign("authorId").references("users.id");
      });
      for (let i = 0; i < 100; i++) {
        const ids = await knex("users").insert({
          name: faker.name.findName()
        });
        await knex("books").insert({
          title: faker.company.companyName(),
          authorId: ids[0]
        });
      }
    } else {
      throw err;
    }
  })
  .then(() => {
    const server = new ApolloServer({ typeDefs, resolvers });

    server.listen().then(({ url }) => {
      console.log(`🚀  Server ready at ${url}`);
    });
  });