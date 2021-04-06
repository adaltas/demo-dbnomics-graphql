
import fetch from 'node-fetch';
import express from 'express';
import { Request } from 'express';
import { graphqlHTTP } from 'express-graphql';
import { URLSearchParams } from "url";
import { createSchema, CallBackendArguments } from 'swagger-to-graphql';

const app = express();

async function callBackend({
  requestOptions: {path, query, headers, body, method},
}: CallBackendArguments<Request>) {
  const baseUrl = "https://api.db.nomics.world/v22";
  const url = `${baseUrl}${path}?${new URLSearchParams(query as Record<
    string,
    string
  >)}`;
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body && JSON.stringify(body),
  });
  const text = await response.text();
  if (200 <= response.status && response.status < 300) {
    try {
      return JSON.parse(text);
    } catch (e) {
      return text;
    }
  }
  throw new Error(`Response: ${response.status} - ${text}`);
}

const defaultQuery = `query adaltas {
  # Retun the list of providers present inside DBnomics
  get_providers {
    nb_datasets
    nb_series
    providers {
      docs {
        code
        name
      }
    }
  }
  # Let's use the OECD (Organisation for Economic Co-operation and Development)
  # Return all its dataset
  # get_providers_provider_code(provider_code: "OECD") {
  #   provider {
  #     code
  #   }
  #   category_tree {
  #     code
  #     name
  #   }
  # }
  # Note, it is also possible to search by keywords
  # get_search(q: "MEI", limit: 100) {
  #   results {
  #     docs {
  #       provider_name
  #       provider_code
  #       code
  #       nb_series
  #       name
  #     }
  #   }
  # }
  # Let's use MEI (Main Economic Indicators Publication)
  # Return all it series
  # get_series_provider_code_dataset_code(
  #   dataset_code: "MEI"
  #   provider_code: "OECD"
  # ) {
  #   series {
  #     docs {
  #       dataset_code
  #       provider_code
  #       series_code
  #     }
  #   }
  # }
  # Let's use the "USA.B6BLTT01.CXCUSA.Q" serie
  # Return the dataset
  # get_series_provider_code_dataset_code_series_code(
  #   dataset_code: "MEI"
  #   provider_code: "OECD"
  #   series_code: "USA.B6BLTT01.CXCUSA.Q"
  # ) {
  #   series {
  #     docs {
  #       series_code
  #       dataset_code
  #       provider_code
  #     }
  #   }
  #   dataset
  # }
}`;

createSchema({
  swaggerSchema: `https://api.db.nomics.world/v22/apispec_1.json`,
  callBackend,
})
  .then(schema => {
    app.use(
      '/graphql',
      graphqlHTTP(() => {
        return {
          schema,
          graphiql: {
            defaultQuery: defaultQuery
          },
        };
      }),
    );
    app.listen(3000, 'localhost', () => {
      console.info('http://localhost:3000/graphql');
    });
  })
  .catch(e => {
    console.log(e);
  });