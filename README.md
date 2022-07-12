# UI5 Tooling for Web Components

**Warning: this project is still in an early stage and anything can change. Not recommended for productive usage.** 

## About this project

Provides [UI5 Tooling](https://sap.github.io/ui5-tooling/) Extensions to include [UI5 Web Components](https://sap.github.io/ui5-webcomponents/) projects into [OpenUI5](https://openui5.org/) / SAPUI5.

In other words, this project enables you to create OpenUI5 libraries out of UI5 Web Components packages. Thus,
you can have any UI5 Web Component as an OpenUI5 control!

## How to use

 1. Add UI5 Tooling for Web Components as a `devDependency` to your OpenUI5 library:

    ```shell
    yarn add -D @ui5/tooling-webc
    ```
    
    or
    
    ```shell
    npm i --save-dev @ui5/tooling-webc
    ```

 2. Add the necessary configuration to your OpenUI5 library's `ui5.yaml` file.

   The tasks/middleware, provided by this project, will use the `ui5.yaml` configuration, found under `customConfiguration` -> `ui5-tooling-webc`. 

   For example:

```yaml
customConfiguration:
  ui5-tooling-webc:
    <YOUR CONFIGURATION GOES HERE>
```

   For more details on the supported `ui5-tooling-webc:` configuration settings, click [here](./docs/settings.md).


 3. Use the binaries, provided by the package:

    - `ui5-webc-prebuild` (to create the runtime for the web components)
    - `ui5-webc-generate` (to create the OpenUI5 wrapper controls)

    Example:

    ```shell
    ui5-webc-prebuild
    ```
    
    and

    ```shell
    ui5-webc-generate
    ```

    Optionally, add these as part of your OpenUI5/SAPUI5 library's build tasks:

       ```json
       {
         "scripts": {
           "prebuild": "ui5-webc-prebuild",
           "generate": "ui5-webc-generate"
         }
       }
       ```
 4. Use the middleware, provided by this project:

    `ui5-tooling-webc-middleware`

## Requirements and Setup

- [Node.js](https://nodejs.org/) (**version 16 or higher**)
- [Yarn](https://yarnpkg.com/en)

## Support, Feedback, Contributing

This project is open to feature requests/suggestions, bug reports etc. via [GitHub issues](https://github.com/SAP/ui5-tooling-webc/issues). Contribution and feedback are encouraged and always welcome. For more information about how to contribute, the project structure, as well as additional contribution information, see our [Contribution Guidelines](CONTRIBUTING.md).

## Code of Conduct

We as members, contributors, and leaders pledge to make participation in our community a harassment-free experience for everyone. By participating in this project, you agree to abide by its [Code of Conduct](CODE_OF_CONDUCT.md) at all times.

## Licensing

Copyright 2022 SAP SE. Please see our [LICENSE](LICENSE) for copyright and license information.
