<!--

@license Apache-2.0

Copyright (c) 2022 The Stdlib Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

-->

---

# Scaffold Package

> GitHub action for scaffolding a new `stdlib` package via GPT-3.

---

## Description

This repository contains a GitHub action for scaffolding a new `stdlib` package via GPT-3. 

There are currently four supported ways of using the action:

### 1. Assigning a PR to the `stdlib-bot` account when a `README.md` file is present

#### 1a) New package's `README.md` file

A workflow that is triggered when a pull request is assigned to the `stdlib-bot` user account. The action automatically scaffolds a new package's contents based off a new `README.md`. This assumes that the pull request branch contains a finished `README.md` file for the new package (readme-driven development). 

In case the pull request originates from a branch on the main repo, the action will then commit the scaffolded package contents to the pull request branch and push them to the main repository. In case the pull request originates from a fork, the action will create a new branch of the name `scaffold<issue-number>/<pkg>` and push it to the main repository (where `<pkg>` is the name of the package after `@stdlib` such as `math/base/special/abs` and `<issue-number>` is the pull request number). 

#### 1b) Modified `README.md` file of an existing package

A workflow that is triggered when a pull request with a modified `README.md` file is assigned to the `stdlib-bot` user account. The action automatically updates the package's contents based off the `README.md` by adding new files that are currently missing. A common use-case is adding new sections for e.g. a C implementation or a CLI interface to a package that currently only has a JavaScript implementation and then triggering the action to scaffold the new files. 

In case the pull request originates from a branch on the main repo, the action will then commit the updated package contents to the pull request branch and push them to the main repository. In case the pull request originates from a fork, the action will create a new branch of the name `scaffold<issue-number>/<pkg>` and push it to the main repository (where `<pkg>` is the name of the package after `@stdlib` such as `math/base/special/abs` and `<issue-number>` is the pull request number).

### 2. Pushing a `README.md` file to a branch of the main repository that starts with `scaffold/` 

#### 2a) New package's `README.md` file

A workflow that is triggered when a `README.md` file is pushed to a branch of the main repository that starts with `scaffold/`. The action automatically scaffolds a new package's contents based off a new `README.md`. This assumes that the branch contains a finished `README.md` file for the new package (readme-driven development).

The action will then commit the scaffolded package contents to the branch and push them to the main repository.

#### 2b) Modified `README.md` file of an existing package

A workflow that is triggered when a `README.md` file is pushed to a branch of the main repository that starts with `scaffold/`. The action automatically updates the package's contents based off the `README.md` by adding new files that are currently missing. A common use-case is adding new sections for e.g. a C implementation or a CLI interface to a package that currently only has a JavaScript implementation and then triggering the action to scaffold the new files.

### 3. Manually triggering the action via the GitHub Actions tab 

A workflow that is triggered when the action is manually triggered via the GitHub Actions tab by dispatching a new workflow run. The following inputs are required:

-   `package path`: The path to the package for which to scaffold the contents. The path is relative to the `@stdlib` root directory. For example, to scaffold contents for the `@stdlib/math/base/special/abs` package, the path would be `math/base/special/abs`.
-   `scaffold type`: The type of scaffolding to perform. The following types are supported:
    -   `native-addon`: Scaffolds a native addon implementation for an existing package.

### 4. Add a scaffold comment to a RFC issue thread to scaffold a new package PR based on the RFC

In a GitHub RFC issue, one may add a scaffolding comment. The comment should contain the JSDoc of all the exports of the package. The action will then automatically scaffold  package contents based off the comment, commit the scaffolded package contents to a new branch and open a pull request. The comment should be of the form:

````md
```yaml
action: scaffold
alias: <alias>
path: <path>
cli: <cli>
```

```js
<jsdoc>
```
````

where `<alias>` is the package alias, `<path>` is the package path, and `<cli>` is an optional CLI command that the package should support. `<jsdoc>` should be a JSDoc comment containing the JSDoc comment for the main export of the package and all its other exports. For example,

````md
```yaml
action: scaffold
alias: erf
path: math/base/special/erf
```

```js
/**
* Evaluates the error function.
* 
* @param {number} x - input value
* @returns {number} function value
* 
* @example
* var v = erf( 2.0 );
* // returns ~0.9953
*
* @example
* var v = erf( NaN );
* // returns NaN
*/
```
````

## Example Workflow

```yml
# Workflow name:
name: test

# Workflow triggers:
on:
  issue_comment:
    types: [created]

# Workflow jobs:
jobs:
  scaffold:
    # Define the type of virtual host machine on which to run the job:
    runs-on: ubuntu-latest

    # Define the sequence of job steps...
    steps:
      # Checkout the current branch:
      - uses: actions/checkout@v3

      # Run the command to scaffold a package:
      - name: Scaffold package
        id: scaffold
        uses: ./
        with:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}

      # Create a pull request:
      - name: Create pull request
        uses: peter-evans/create-pull-request@v3
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          commit-message: Add `${{ steps.scaffold.outputs.alias }}`
          title: Add `${{ steps.scaffold.outputs.alias }}` package
          body: |
            This PR adds the `${{ steps.scaffold.outputs.alias }}` package.
            
            ## Notes
            
            *   :warning: The package was scaffolded using the stdlib bot, which uses AI to generate package content. The generated content is not guaranteed to be correct, and will require manual review and editing. :warning:
          branch: ${{ steps.scaffold.outputs.path }}
```

## Inputs

-   `OPENAI_API_KEY`: OpenAI API key.
-   `GITHUB_TOKEN`: GitHub token.

## Outputs

-   `alias`: package alias.
-   `dir`: package directory in the repository.
-   `path`: package path.

## License

See [LICENSE][stdlib-license].


## Copyright

Copyright &copy; 2022-2024. The Stdlib [Authors][stdlib-authors].

<!-- Section for all links. Make sure to keep an empty line after the `section` element and another before the `/section` close. -->

<section class="links">

[stdlib]: https://github.com/stdlib-js/stdlib

[stdlib-authors]: https://github.com/stdlib-js/stdlib/graphs/contributors

[stdlib-license]: https://raw.githubusercontent.com/stdlib-js/assign-issue-on-label-action/master/LICENSE

</section>

<!-- /.links -->
