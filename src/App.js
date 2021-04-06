// flow
import React, { Component } from "react";
import GraphiQL from "graphiql";
import GraphiQLExplorer from "graphiql-explorer";
import { createSchema } from 'swagger-to-graphql';

import {
  Source,
  parse,
  execute,
} from 'graphql'

import { makeDefaultArg, getDefaultScalarArgValue } from "./CustomArgs";

import "graphiql/graphiql.css";
import "./App.css";

const DEFAULT_QUERY = `# shift-option/alt-click on a query below to jump to it in the explorer
# option/alt-click on a field in the explorer to select all subfields
query dbnomics {
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
  #     docs
  #   }
  # }
  # Let's use the "UA5M.CSCICP03.IXNSA.M" serie
  # Return the dataset
  # get_series_provider_code_dataset_code_series_code(
  #   dataset_code: "MEI"
  #   provider_code: "OECD"
  #   series_code: "A5M.CSCICP03.IXNSA.M"
  #   observations: "1"
  # ) {
  #   series {
  #     docs
  #   }
  # }
}`;

async function callBackend({
  requestOptions: {path, query, headers, body, method},
}) {
  const baseUrl = "https://api.db.nomics.world/v22";
  const url = `${baseUrl}${path}?${new URLSearchParams(query)}`;
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

class App extends Component {
  _graphiql;
  state = { schema: null, query: DEFAULT_QUERY, explorerIsOpen: true };
  fetcher = async ({query}, schema) => {
    const documentAST = parse(new Source(query, 'GraphQL request'));
    const result = await execute({
      schema: schema,
      document: documentAST,
    });
    return result;
  }
  async componentDidMount() {
    const swaggerSchemaReq = await fetch(`https://api.db.nomics.world/v22/apispec_1.json`)
    const swaggerSchemaText = await swaggerSchemaReq.text();
    const swaggerSchema = JSON.parse(swaggerSchemaText);
    swaggerSchema.paths
    ["/series"]
    .get.responses[200].schema.properties.series.properties.docs.items = {
      type: 'object'
    }
    swaggerSchema.paths
    ["/series/{provider_code}/{dataset_code}"]
    .get.responses[200].schema.properties.series.properties.docs.items = {
      type: 'object'
    }
    swaggerSchema.paths
    ["/series/{provider_code}/{dataset_code}/{series_code}"]
    .get.responses[200].schema.properties.series.properties.docs.items = {
      type: 'object'
    }
    const schema = await createSchema({
      swaggerSchema: swaggerSchema,
      callBackend,
    })
    this.setState({schema: schema})
  }

  _handleInspectOperation = (
    cm,
    mousePos
  ) => {
    const parsedQuery = parse(this.state.query || "");

    if (!parsedQuery) {
      console.error("Couldn't parse query document");
      return null;
    }

    var token = cm.getTokenAt(mousePos);
    var start = { line: mousePos.line, ch: token.start };
    var end = { line: mousePos.line, ch: token.end };
    var relevantMousePos = {
      start: cm.indexFromPos(start),
      end: cm.indexFromPos(end)
    };

    var position = relevantMousePos;

    var def = parsedQuery.definitions.find(definition => {
      if (!definition.loc) {
        console.log("Missing location information for definition");
        return false;
      }

      const { start, end } = definition.loc;
      return start <= position.start && end >= position.end;
    });

    if (!def) {
      console.error(
        "Unable to find definition corresponding to mouse position"
      );
      return null;
    }

    var operationKind =
      def.kind === "OperationDefinition"
        ? def.operation
        : def.kind === "FragmentDefinition"
        ? "fragment"
        : "unknown";

    var operationName =
      def.kind === "OperationDefinition" && !!def.name
        ? def.name.value
        : def.kind === "FragmentDefinition" && !!def.name
        ? def.name.value
        : "unknown";

    var selector = `.graphiql-explorer-root #${operationKind}-${operationName}`;

    var el = document.querySelector(selector);
    el && el.scrollIntoView();
  };

  _handleEditQuery = (query) => this.setState({ query });

  _handleToggleExplorer = () => {
    this.setState({ explorerIsOpen: !this.state.explorerIsOpen });
  };

  render() {
    const { query, schema } = this.state;
    return (
      <div className="graphiql-container">
        <GraphiQLExplorer
          schema={schema}
          query={query}
          onEdit={this._handleEditQuery}
          onRunOperation={operationName =>
            this._graphiql.handleRunQuery(operationName)
          }
          explorerIsOpen={this.state.explorerIsOpen}
          onToggleExplorer={this._handleToggleExplorer}
          getDefaultScalarArgValue={getDefaultScalarArgValue}
          makeDefaultArg={makeDefaultArg}
        />
        <GraphiQL
          ref={ref => (this._graphiql = ref)}
          fetcher={(params) => {return this.fetcher(params, this.state.schema)}}
          schema={schema}
          query={query}
          onEditQuery={this._handleEditQuery}
        >
          <GraphiQL.Toolbar>
            <GraphiQL.Button
              onClick={() => this._graphiql.handlePrettifyQuery()}
              label="Prettify"
              title="Prettify Query (Shift-Ctrl-P)"
            />
            <GraphiQL.Button
              onClick={() => this._graphiql.handleToggleHistory()}
              label="History"
              title="Show History"
            />
            <GraphiQL.Button
              onClick={this._handleToggleExplorer}
              label="Explorer"
              title="Toggle Explorer"
            />
          </GraphiQL.Toolbar>
        </GraphiQL>
      </div>
    );
  }
}

export default App;