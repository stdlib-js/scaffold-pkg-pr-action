"use strict";
/**
* @license Apache-2.0
*
* Copyright (c) 2022 The Stdlib Authors.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*    http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// MODULES //
const core_1 = require("@actions/core");
const github_1 = require("@actions/github");
const path_1 = require("path");
const openai_1 = require("openai");
const fs_1 = require("fs");
const yaml_1 = require("yaml");
const time_current_year_1 = __importDefault(require("@stdlib/time-current-year"));
// VARIABLES //
const RE_YAML = /```yaml([\s\S]+?)```/;
const RE_JS = /```js([\s\S]+?)```/;
const RE_JSDOC_COMMENT = /\/\*\*([\s\S]+?)\*\//;
const PROMPTS_DIR = (0, path_1.join)(__dirname, '..', 'prompts');
const EXAMPLES_JS_FILE = (0, path_1.join)(PROMPTS_DIR, 'examples_js.txt');
const OPENAI_SETTINGS = {
    'model': 'code-davinci-002',
    'temperature': 0.7,
    'max_tokens': 2048,
    'top_p': 1,
    'frequency_penalty': 0,
    'presence_penalty': 0,
    'stop': ['Input (ts):', 'Input (jsdoc):', 'Input (README.md):']
};
const LICENSE_TXT = `/*
* @license Apache-2.0
*
* Copyright (c) ${(0, time_current_year_1.default)()} The Stdlib Authors.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*    http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
`;
const README_LICENSE = `<!--

@license Apache-2.0

Copyright (c) ${(0, time_current_year_1.default)()} The Stdlib Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

-->`;
// MAIN //
/**
* Main function.
*
* @returns {Promise<void>} promise indicating completion
*/
async function main() {
    const OPENAI_API_KEY = (0, core_1.getInput)('OPENAI_API_KEY', {
        required: true
    });
    const configuration = new openai_1.Configuration({
        'apiKey': OPENAI_API_KEY
    });
    const openai = new openai_1.OpenAIApi(configuration);
    const workDir = (0, path_1.join)(process.env.GITHUB_WORKSPACE);
    (0, core_1.debug)('Working directory: ' + workDir);
    (0, core_1.debug)('Prompts directory: ' + PROMPTS_DIR);
    switch (github_1.context.eventName) {
        case 'issue_comment': {
            (0, core_1.debug)('Received a comment, checking if it is a command...');
            // Extract the YAML code block:
            const matches = RE_YAML.exec(github_1.context.payload.comment.body);
            if (matches === null) {
                (0, core_1.debug)('No YAML code block found.');
                return;
            }
            (0, core_1.debug)('Found a YAML code block: ' + matches[1]);
            const yaml = (0, yaml_1.parse)(matches[1]);
            if (yaml.action !== 'scaffold') {
                (0, core_1.debug)('Not a scaffold command.');
                return;
            }
            const { path, alias, cli } = yaml;
            (0, core_1.debug)(`Scaffolding package: ${path} (${alias}) ${cli ? 'with CLI' : 'without CLI'}`);
            const pkgDir = (0, path_1.join)(workDir, 'lib', 'node_modules', '@stdlib', path);
            (0, core_1.debug)('Package directory: ' + pkgDir);
            if ((0, fs_1.existsSync)(pkgDir)) {
                (0, core_1.setFailed)('Package directory already exists.');
            }
            (0, fs_1.mkdirSync)(pkgDir, {
                'recursive': true
            });
            (0, fs_1.mkdirSync)((0, path_1.join)(pkgDir, 'benchmark'));
            (0, fs_1.mkdirSync)((0, path_1.join)(pkgDir, 'docs'));
            (0, fs_1.mkdirSync)((0, path_1.join)(pkgDir, 'docs', 'types'));
            (0, fs_1.mkdirSync)((0, path_1.join)(pkgDir, 'examples'));
            (0, fs_1.mkdirSync)((0, path_1.join)(pkgDir, 'lib'));
            (0, fs_1.mkdirSync)((0, path_1.join)(pkgDir, 'test'));
            const pkgJSON = {
                'name': `@stdlib/${path}`,
                "version": "0.0.0",
                "description": "",
                "license": "Apache-2.0",
                "author": {
                    "name": "The Stdlib Authors",
                    "url": "https://github.com/stdlib-js/stdlib/graphs/contributors"
                },
                "contributors": [
                    {
                        "name": "The Stdlib Authors",
                        "url": "https://github.com/stdlib-js/stdlib/graphs/contributors"
                    }
                ],
                "main": "./lib",
                "directories": {
                    "benchmark": "./benchmark",
                    "doc": "./docs",
                    "example": "./examples",
                    "lib": "./lib",
                    "test": "./test"
                },
                "types": "./docs/types",
                "scripts": {},
                "homepage": "https://github.com/stdlib-js/stdlib",
                "repository": {
                    "type": "git",
                    "url": "git://github.com/stdlib-js/stdlib.git"
                },
                "bugs": {
                    "url": "https://github.com/stdlib-js/stdlib/issues"
                },
                "dependencies": {},
                "devDependencies": {},
                "engines": {
                    "node": ">=0.10.0",
                    "npm": ">2.7.0"
                },
                "os": [
                    "aix",
                    "darwin",
                    "freebsd",
                    "linux",
                    "macos",
                    "openbsd",
                    "sunos",
                    "win32",
                    "windows"
                ],
                "keywords": []
            };
            (0, fs_1.writeFileSync)((0, path_1.join)(pkgDir, 'package.json'), JSON.stringify(pkgJSON, null, 2) + '\n');
            (0, core_1.setOutput)('path', path);
            (0, core_1.setOutput)('alias', alias);
            const jsCode = RE_JS.exec(github_1.context.payload.comment.body);
            if (jsCode === null) {
                (0, core_1.debug)('No JS code block found.');
                return;
            }
            (0, core_1.debug)('Found a JS code block, extract JSDoc...');
            const jsdoc = RE_JSDOC_COMMENT.exec(jsCode[1]);
            if (jsdoc === null) {
                (0, core_1.debug)('No JSDoc comment found.');
                return;
            }
            try {
                const response = await openai.createCompletion({
                    'prompt': EXAMPLES_JS_FILE.replace('{{input}}', jsdoc[1]),
                    ...OPENAI_SETTINGS
                });
                if (response.data && response.data.choices) {
                    const txt = LICENSE_TXT + '\'use strict\';\n' + (response?.data?.choices[0].text || '');
                    (0, fs_1.writeFileSync)((0, path_1.join)(pkgDir, 'examples', 'index.js'), txt);
                }
            }
            catch (err) {
                (0, core_1.setFailed)(err.message);
            }
            break;
        }
        default:
            (0, core_1.setFailed)('Unsupported event name: ' + github_1.context.eventName);
    }
}
main();
//# sourceMappingURL=index.js.map