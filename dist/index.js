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
            if (cli) {
                (0, fs_1.mkdirSync)((0, path_1.join)(pkgDir, 'bin'));
                (0, fs_1.mkdirSync)((0, path_1.join)(pkgDir, 'etc'));
            }
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
                ...(cli ? {
                    "bin": {
                        [cli]: "./bin/cli"
                    }
                } : {}),
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
            (0, core_1.debug)('Found a JS code block...');
            try {
                const EXAMPLES_JS_FILE = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'examples_js.txt'), 'utf8');
                const prompt = EXAMPLES_JS_FILE.replace('{{input}}', jsCode[1]);
                (0, core_1.debug)('Prompt: ' + prompt);
                const response = await openai.createCompletion({
                    'prompt': prompt,
                    ...OPENAI_SETTINGS
                });
                if (response.data && response.data.choices) {
                    const txt = LICENSE_TXT + '\n\'use strict\';\n' + (response?.data?.choices[0].text || '') + '\n';
                    (0, fs_1.writeFileSync)((0, path_1.join)(pkgDir, 'examples', 'index.js'), txt);
                }
            }
            catch (err) {
                (0, core_1.setFailed)(err.message);
            }
            try {
                const README_MD_FILE = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'readme_md.txt'), 'utf8');
                const response = await openai.createCompletion({
                    'prompt': README_MD_FILE.replace('{{input}}', jsCode[1]),
                    ...OPENAI_SETTINGS
                });
                if (response.data && response.data.choices) {
                    const txt = README_LICENSE + (response?.data?.choices[0].text || '');
                    (0, fs_1.writeFileSync)((0, path_1.join)(pkgDir, 'README.md'), txt);
                }
            }
            catch (err) {
                (0, core_1.setFailed)(err.message);
            }
            try {
                const BENCHMARK_JS_FILE = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'benchmark_js.txt'), 'utf8');
                const response = await openai.createCompletion({
                    'prompt': BENCHMARK_JS_FILE.replace('{{input}}', jsCode[1]),
                    ...OPENAI_SETTINGS
                });
                if (response.data && response.data.choices) {
                    const txt = LICENSE_TXT + '\'use strict\';\n\n' + (response?.data?.choices[0].text || '');
                    (0, fs_1.writeFileSync)((0, path_1.join)(pkgDir, 'benchmark', 'benchmark.js'), txt);
                }
            }
            catch (err) {
                (0, core_1.setFailed)(err.message);
            }
            try {
                const INDEX_JS_FILE = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'index_js.txt'), 'utf8');
                const response = await openai.createCompletion({
                    'prompt': INDEX_JS_FILE.replace('{{input}}', jsCode[1]),
                    ...OPENAI_SETTINGS
                });
                if (response.data && response.data.choices) {
                    const txt = LICENSE_TXT + '\'use strict\';\n\n' + (response?.data?.choices[0].text || '');
                    (0, fs_1.writeFileSync)((0, path_1.join)(pkgDir, 'lib', 'index.js'), txt);
                }
            }
            catch (err) {
                (0, core_1.setFailed)(err.message);
            }
            try {
                const TEST_JS_FILE = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'test_js.txt'), 'utf8');
                const response = await openai.createCompletion({
                    'prompt': TEST_JS_FILE.replace('{{input}}', jsCode[1]),
                    ...OPENAI_SETTINGS
                });
                if (response.data && response.data.choices) {
                    const txt = LICENSE_TXT + '\'use strict\';\n\n' + (response?.data?.choices[0].text || '');
                    (0, fs_1.writeFileSync)((0, path_1.join)(pkgDir, 'test', 'test.js'), txt);
                }
            }
            catch (err) {
                (0, core_1.setFailed)(err.message);
            }
            try {
                const REPL_TXT_FILE = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'repl_txt.txt'), 'utf8');
                const response = await openai.createCompletion({
                    'prompt': REPL_TXT_FILE.replace('{{input}}', jsCode[1]),
                    ...OPENAI_SETTINGS
                });
                if (response.data && response.data.choices) {
                    const txt = response?.data?.choices[0].text || '';
                    (0, fs_1.writeFileSync)((0, path_1.join)(pkgDir, 'docs', 'repl.txt'), txt);
                }
            }
            catch (err) {
                (0, core_1.setFailed)(err.message);
            }
            let ts = '';
            try {
                const INDEX_D_TS_FILE = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'index_d_ts.txt'), 'utf8');
                const response = await openai.createCompletion({
                    'prompt': INDEX_D_TS_FILE.replace('{{input}}', jsCode[1]),
                    ...OPENAI_SETTINGS
                });
                if (response.data && response.data.choices) {
                    ts = response?.data?.choices[0].text || '';
                    const txt = LICENSE_TXT + '// TypeScript Version: 2.0\n' + ts;
                    (0, fs_1.writeFileSync)((0, path_1.join)(pkgDir, 'docs', 'types', 'index.d.ts'), txt);
                }
            }
            catch (err) {
                (0, core_1.setFailed)(err.message);
            }
            try {
                const TEST_TS_FILE = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'test_ts.txt'), 'utf8');
                const response = await openai.createCompletion({
                    'prompt': TEST_TS_FILE.replace('{{input}}', ts),
                    ...OPENAI_SETTINGS
                });
                if (response.data && response.data.choices) {
                    let txt = response?.data?.choices[0].text || '';
                    txt = LICENSE_TXT + txt;
                    (0, fs_1.writeFileSync)((0, path_1.join)(pkgDir, 'docs', 'types', 'test.ts'), txt);
                }
            }
            catch (err) {
                (0, core_1.setFailed)(err.message);
            }
            if (cli) {
                // Case: Package contains a CLI:
                try {
                    const USAGE_TXT_FILE = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'usage_txt.txt'), 'utf8');
                    const response = await openai.createCompletion({
                        'prompt': USAGE_TXT_FILE.replace('{{input}}', jsCode[1]).replace('{{cli}}', cli),
                        ...OPENAI_SETTINGS
                    });
                    if (response.data && response.data.choices) {
                        const txt = response?.data?.choices[0].text || '';
                        (0, fs_1.writeFileSync)((0, path_1.join)(pkgDir, 'docs', 'usage.txt'), txt);
                    }
                }
                catch (err) {
                    (0, core_1.setFailed)(err.message);
                }
                try {
                    const CLI_OPTS_JSON_FILE = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'cli_opts_json.txt'), 'utf8');
                    const response = await openai.createCompletion({
                        'prompt': CLI_OPTS_JSON_FILE.replace('{{jsdoc}}', jsCode[1]),
                        ...OPENAI_SETTINGS
                    });
                    if (response.data && response.data.choices) {
                        const json = response?.data?.choices[0].text || '';
                        (0, fs_1.writeFileSync)((0, path_1.join)(pkgDir, 'etc', 'cli_opts.json'), json);
                    }
                }
                catch (err) {
                    (0, core_1.setFailed)(err.message);
                }
                try {
                    const CLI_FILE = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'cli.txt'), 'utf8');
                    const response = await openai.createCompletion({
                        'prompt': CLI_FILE.replace('{{input}}', jsCode[1]),
                        ...OPENAI_SETTINGS
                    });
                    if (response.data && response.data.choices) {
                        const txt = LICENSE_TXT + '\'use strict\';\n\n' + (response?.data?.choices[0].text || '');
                        (0, fs_1.writeFileSync)((0, path_1.join)(pkgDir, 'bin', 'cli'), txt);
                    }
                }
                catch (err) {
                    (0, core_1.setFailed)(err.message);
                }
                try {
                    const TEST_CLI_JS_FILE = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'test_cli_js.txt'), 'utf8');
                    const response = await openai.createCompletion({
                        'prompt': TEST_CLI_JS_FILE.replace('{{input}}', jsCode[1]),
                        ...OPENAI_SETTINGS
                    });
                    if (response.data && response.data.choices) {
                        const txt = LICENSE_TXT + '\'use strict\';\n\n' + (response?.data?.choices[0].text || '');
                        (0, fs_1.writeFileSync)((0, path_1.join)(pkgDir, 'test', 'test.cli.js'), txt);
                    }
                }
                catch (err) {
                    (0, core_1.setFailed)(err.message);
                }
            }
            break;
        }
        default:
            (0, core_1.setFailed)('Unsupported event name: ' + github_1.context.eventName);
    }
}
main();
//# sourceMappingURL=index.js.map