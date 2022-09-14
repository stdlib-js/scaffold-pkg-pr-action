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
const yaml_1 = require("yaml");
const time_current_year_1 = __importDefault(require("@stdlib/time-current-year"));
// VARIABLES //
const RE_YAML = /```yaml([\s\S]+?)```/;
const RE_JS = /```js([\s\S]+?)```/;
const RE_JSDOC_COMMENT = /\/\*\*([\s\S]+?)\*\//;
const PROMPTS_DIR = (0, path_1.join)(__dirname, '..', 'prompts');
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
    const openapi = (0, core_1.getInput)('OPENAI_API_KEY', {
        required: true
    });
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
            break;
        }
        default:
            (0, core_1.setFailed)('Unsupported event name: ' + github_1.context.eventName);
    }
}
main();
//# sourceMappingURL=index.js.map