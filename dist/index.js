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
Object.defineProperty(exports, "__esModule", { value: true });
// MODULES //
const core_1 = require("@actions/core");
const github_1 = require("@actions/github");
const yaml_1 = require("yaml");
// VARIABLES //
const RE_YAML = /```yaml([\s\S]+?)```/;
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
    switch (github_1.context.eventName) {
        case 'issue_comment': {
            (0, core_1.debug)('Received a comment, checking if it is a command...');
            // Extract the YAML code block:
            const matches = RE_YAML.exec(github_1.context.payload.comment.body);
            if (matches === null) {
                (0, core_1.debug)('No YAML code block found.');
                return;
            }
            (0, core_1.debug)('Found a YAML code block.');
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