[![REUSE status](https://api.reuse.software/badge/github.com/SAP/ui5-tooling-webc)](https://api.reuse.software/info/github.com/SAP/ui5-tooling-webc)

# UI5 Tooling for Web Components

Provides [UI5 Tooling](https://sap.github.io/ui5-tooling/) Extensions to include [UI5 Web Components](https://sap.github.io/ui5-webcomponents/) projects into [OpenUI5](https://openui5.org/) / [SAPUI5](https://ui5.sap.com).

> **Attention**: This project is in an experimental state. Significant changes are likely to occur, including potential breaking changes.

## Overview

The repository contains the NPM package: `@ui5/tooling-webc`. This package provides scripts to prebuild and generate UI5 library wrapper projects for UI5 Web Components and a custom middleware to be used for the development of UI5 library wrapper projects and a direct consumption of the UI5 Web Components projects. In other words, it enables to use UI5 Web Components as OpenUI5/SAPUI5 controls. 

Inside this package the most important scripts can be found at the following places:

```text
bin
├── generate.js   // generation binary => ui5-webc-generate
└── prebuild.js   // prebuild binary => ui5-webc-prebuild

lib
├── generate.js   // generation script
├── prebuild.js   // prebuild script
├── middleware.js // UI5 server middleware for serving web-components-based projects
└── task.js       // UI5 build task for third-party libraries only
```

## Getting Started

### Requirements

- [Node.js](https://nodejs.org/) (**version 16 or higher**)
- [Yarn](https://yarnpkg.com/en)

### Setup

The project is using `npm`. To get started with the local development, just run the following commands:

```sh
# Install dependencies
npm install

# Create a link
npm link
```

Now you can link the package for local testing by calling the following command: 

```sh
# Link it
npm install @ui5/tooling-webc
```

That's it, all set!

### Consumption

#### 1. Add the dependency

Use the NPM package manager of your choice to add the `@ui5/tooling-webc` as a `devDependency` to your UI5 library:

```shell
# NPM
npm i --save-dev @ui5/tooling-webc

# yarn
yarn add -D @ui5/tooling-webc

# PNPM
pnpm add -D @ui5/tooling-webc
```

#### 2. Configure the tooling extension

Add the necessary configuration to your UI5 library in the `ui5.yaml` file. The configuration should go to `customConfiguration` -> `ui5-tooling-webc`.

For example:

```yaml
customConfiguration:
  ui5-tooling-webc:
    <YOUR CONFIGURATION GOES HERE>
```

For more details on the supported `ui5-tooling-webc:` configuration settings, click [here](./docs/settings.md).

### 3. Use the binaries

The tooling extension comes with two binaries which can be called directly (eventually by using `npx`):

```sh
# create the runtime for the web components
ui5-webc-prebuild

# create the wrapper controls
ui5-webc-generate
```

Optionally, add these as part of your library's build tasks:

```json
{
  "scripts": {
    "prebuild": "ui5-webc-prebuild",
    "generate": "ui5-webc-generate"
  }
}
```

### 4. Using the middleware

1. Define the dependency in `$yourapp/package.json`:

    ```json
    "devDependencies": {
        // ...
        "@ui5/tooling-webc": "*"
        // ...
    },
    "ui5": {
      "dependencies": [
        // ...
        "@ui5/tooling-webc",
        // ...
      ]
    }
    ```

    > As the devDependencies are not recognized by the UI5 tooling, they need to be listed in the `ui5 > dependencies` array. In addition, once using the `ui5 > dependencies` array you need to list all UI5 tooling relevant dependencies.

2. Configure it in `$yourapp/ui5.yaml`:

    ```yaml
    server:
      customMiddleware:
        - name: ui5-tooling-webc-middleware
          afterMiddleware: compression
    ```

That's all.

## Support, Feedback, Contributing

This project is open to feature requests/suggestions, bug reports etc. via [GitHub issues](https://github.com/SAP/ui5-tooling-webc/issues). Contribution and feedback are encouraged and always welcome. For more information about how to contribute, the project structure, as well as additional contribution information, see our [Contribution Guidelines](CONTRIBUTING.md).

## Code of Conduct

We as members, contributors, and leaders pledge to make participation in our community a harassment-free experience for everyone. By participating in this project, you agree to abide by its [Code of Conduct](CODE_OF_CONDUCT.md) at all times.

## Licensing

Copyright 2022 SAP SE. Please see our [LICENSE](LICENSE) for copyright and license information. Detailed information including third-party components and their licensing/copyright information is available [via the REUSE tool](https://api.reuse.software/info/github.com/SAP/ui5-tooling-webc).
