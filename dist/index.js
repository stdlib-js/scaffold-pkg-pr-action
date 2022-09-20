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
const string_substring_after_1 = __importDefault(require("@stdlib/string-substring-after"));
const extract_examples_section_1 = __importDefault(require("./extract_examples_section"));
const extract_usage_section_1 = __importDefault(require("./extract_usage_section"));
// VARIABLES //
const RE_YAML = /```yaml([\s\S]+?)```/;
const RE_JS = /```js([\s\S]+?)```/;
const PROMPTS_DIR = (0, path_1.join)(__dirname, '..', 'prompts');
const OPENAI_SETTINGS = {
    'model': 'code-davinci-002',
    'temperature': 0.7,
    'max_tokens': 1024,
    'top_p': 1,
    'frequency_penalty': 0,
    'presence_penalty': 0,
    'stop': ['Input (ts):', 'Input (jsdoc):', 'Input (README.md):', 'Output (']
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
const SEE_ALSO = `

    See Also
    --------`;
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
        case 'pull_request': {
            // Check whether PR was assigned to the "stdlib-bot" user:
            if (github_1.context.payload.pull_request.assignee.login !== 'stdlib-bot') {
                (0, core_1.debug)('PR not assigned to stdlib-bot. Skipping...');
                return;
            }
            // Get the files created by the PR via the GitHub API:
            const token = (0, core_1.getInput)('GITHUB_TOKEN');
            const octokit = (0, github_1.getOctokit)(token);
            const files = await octokit.rest.pulls.listFiles({
                'owner': github_1.context.repo.owner,
                'repo': github_1.context.repo.repo,
                'pull_number': github_1.context.payload.pull_request.number
            });
            (0, core_1.debug)('Files: ' + JSON.stringify(files.data));
            // Check whether the PR contains a new package's README.md file:
            const readme = files.data.find(f => {
                return f.filename.endsWith('README.md') && f.status === 'added';
            });
            if (readme === void 0) {
                (0, core_1.debug)('PR does not contain a new package\'s README.md file. Skipping...');
                return;
            }
            // Extract the directory path for the new package:
            const dir = readme.filename.replace('/README.md', '');
            // Load the package's README.md file:
            const readmePath = (0, path_1.join)(workDir, readme.filename);
            const readmeText = (0, fs_1.readFileSync)(readmePath, 'utf8');
            (0, core_1.debug)('New package directory: ' + dir);
            // Hash map of whether the PR contains a new package's files:
            const has = {
                'docs/types/index.d.ts': false,
                'docs/types/test.ts': false,
                'lib/index.js': false,
                'test/test.js': false,
                'benchmark/benchmark.js': false,
                'examples/index.js': false,
                'docs/repl.txt': false
            };
            files.data.forEach(f => {
                if (f.filename.endsWith('docs/types/index.d.ts')) {
                    has['docs/types/index.d.ts'] = true;
                }
                if (f.filename.endsWith('lib/index.js')) {
                    has['lib/index.js'] = true;
                }
                if (f.filename.endsWith('test/test.js')) {
                    has['test/test.js'] = true;
                }
                if (f.filename.endsWith('benchmark/benchmark.js')) {
                    has['benchmark/benchmark.js'] = true;
                }
                if (f.filename.endsWith('examples/index.js')) {
                    has['examples/index.js'] = true;
                }
                if (f.filename.endsWith('docs/repl.txt')) {
                    has['docs/repl.txt'] = true;
                }
                if (f.filename.endsWith('docs/types/test.ts')) {
                    has['docs/types/test.ts'] = true;
                }
            });
            const usageSection = (0, extract_usage_section_1.default)(readmeText);
            const examplesSection = (0, extract_examples_section_1.default)(readmeText);
            if (!has['docs/repl.txt']) {
                (0, core_1.debug)('PR does not contain a new package\'s REPL file. Scaffolding...');
                try {
                    const response = await openai.createCompletion({
                        ...OPENAI_SETTINGS,
                        'model': 'davinci:ft-carnegie-mellon-university-2022-09-17-02-09-31',
                        'prompt': usageSection + examplesSection + '\n|>|\n\n',
                        'stop': ['END']
                    });
                    if (response.data && response.data.choices) {
                        const txt = (response?.data?.choices[0].text || '') + SEE_ALSO;
                        try {
                            (0, fs_1.mkdirSync)((0, path_1.join)(dir, 'docs'));
                        }
                        catch (err) {
                            (0, core_1.debug)('Unable to create `docs` directory. Error: ' + err.message);
                        }
                        (0, fs_1.writeFileSync)((0, path_1.join)(dir, 'docs', 'repl.txt'), txt);
                    }
                }
                catch (err) {
                    (0, core_1.debug)(err);
                    (0, core_1.setFailed)(err.message);
                }
            }
            if (!has['lib/index.js']) {
                (0, core_1.debug)('PR does not contain a new package\'s index file. Scaffolding...');
                try {
                    const PROMPT = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'from-readme', 'index_js.txt'), 'utf8')
                        .replace('{{input}}', usageSection.replace(/(\n)+/g, '\n'));
                    (0, core_1.debug)('Prompt: ' + PROMPT);
                    const response = await openai.createCompletion({
                        ...OPENAI_SETTINGS,
                        'prompt': PROMPT
                    });
                    if (response.data && response.data.choices) {
                        const txt = LICENSE_TXT + '\n\'use strict\';\n' + (response?.data?.choices[0].text || '');
                        try {
                            (0, fs_1.mkdirSync)((0, path_1.join)(dir, 'lib'));
                        }
                        catch (err) {
                            (0, core_1.debug)('Unable to create `lib` directory. Error: ' + err.message);
                        }
                        (0, fs_1.writeFileSync)((0, path_1.join)(dir, 'lib', 'index.js'), txt);
                    }
                }
                catch (err) {
                    (0, core_1.debug)(err);
                    (0, core_1.setFailed)(err.message);
                }
            }
            if (!has['examples/index.js']) {
                (0, core_1.debug)('PR does not contain a new package\'s examples file. Scaffolding...');
                try {
                    const PROMPT = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'from-readme', 'examples_js.txt'), 'utf8')
                        .replace('{{input}}', examplesSection);
                    (0, core_1.debug)('Prompt: ' + PROMPT);
                    const response = await openai.createCompletion({
                        ...OPENAI_SETTINGS,
                        'prompt': PROMPT
                    });
                    if (response.data && response.data.choices) {
                        const txt = LICENSE_TXT + '\n\'use strict\';\n' + (response?.data?.choices[0].text || '');
                        try {
                            (0, fs_1.mkdirSync)((0, path_1.join)(dir, 'examples'));
                        }
                        catch (err) {
                            (0, core_1.debug)('Unable to create `examples` directory. Error: ' + err.message);
                        }
                        (0, fs_1.writeFileSync)((0, path_1.join)(dir, 'examples', 'index.js'), txt);
                    }
                }
                catch (err) {
                    (0, core_1.debug)(err);
                    (0, core_1.setFailed)(err.message);
                }
            }
            (0, core_1.setOutput)('dir', dir);
            (0, core_1.setOutput)('path', (0, string_substring_after_1.default)(dir, 'lib/node_modules/@stdlib/'));
            (0, core_1.setOutput)('alias', usageSection.substring(0, usageSection.indexOf(' =')));
            break;
        }
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
            (0, core_1.setOutput)('dir', pkgDir);
            (0, core_1.setOutput)('path', path);
            (0, core_1.setOutput)('alias', alias);
            const jsCode = RE_JS.exec(github_1.context.payload.comment.body);
            if (jsCode === null) {
                (0, core_1.debug)('No JS code block found.');
                return;
            }
            (0, core_1.debug)('Found a JS code block...');
            try {
                const EXAMPLES_JS_FILE = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'from-jsdoc', 'examples_js.txt'), 'utf8');
                const prompt = EXAMPLES_JS_FILE.replace('{{input}}', jsCode[1]);
                (0, core_1.debug)('Prompt: ' + prompt);
                const response = await openai.createCompletion({
                    ...OPENAI_SETTINGS,
                    'prompt': prompt
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
                const README_MD_FILE = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'from-jsdoc', 'readme_md.txt'), 'utf8');
                const response = await openai.createCompletion({
                    ...OPENAI_SETTINGS,
                    'prompt': README_MD_FILE.replace('{{input}}', jsCode[1])
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
                const BENCHMARK_JS_FILE = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'from-jsdoc', 'benchmark_js.txt'), 'utf8');
                const response = await openai.createCompletion({
                    ...OPENAI_SETTINGS,
                    'prompt': BENCHMARK_JS_FILE.replace('{{input}}', jsCode[1])
                });
                if (response.data && response.data.choices) {
                    const txt = LICENSE_TXT + '\n\'use strict\';\n' + (response?.data?.choices[0].text || '');
                    (0, fs_1.writeFileSync)((0, path_1.join)(pkgDir, 'benchmark', 'benchmark.js'), txt);
                }
            }
            catch (err) {
                (0, core_1.setFailed)(err.message);
            }
            try {
                const INDEX_JS_FILE = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'from-jsdoc', 'index_js.txt'), 'utf8');
                const response = await openai.createCompletion({
                    ...OPENAI_SETTINGS,
                    'prompt': INDEX_JS_FILE.replace('{{input}}', jsCode[1])
                });
                if (response.data && response.data.choices) {
                    const txt = LICENSE_TXT + '\n\'use strict\';\n' + (response?.data?.choices[0].text || '');
                    (0, fs_1.writeFileSync)((0, path_1.join)(pkgDir, 'lib', 'index.js'), txt);
                }
            }
            catch (err) {
                (0, core_1.setFailed)(err.message);
            }
            try {
                const TEST_JS_FILE = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'from-jsdoc', 'test_js.txt'), 'utf8');
                const response = await openai.createCompletion({
                    ...OPENAI_SETTINGS,
                    'prompt': TEST_JS_FILE.replace('{{input}}', jsCode[1])
                });
                if (response.data && response.data.choices) {
                    const txt = LICENSE_TXT + '\n\'use strict\';\n' + (response?.data?.choices[0].text || '');
                    (0, fs_1.writeFileSync)((0, path_1.join)(pkgDir, 'test', 'test.js'), txt);
                }
            }
            catch (err) {
                (0, core_1.setFailed)(err.message);
            }
            try {
                const REPL_TXT_FILE = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'from-jsdoc', 'repl_txt.txt'), 'utf8');
                const response = await openai.createCompletion({
                    ...OPENAI_SETTINGS,
                    'prompt': REPL_TXT_FILE.replace('{{input}}', jsCode[1])
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
                const INDEX_D_TS_FILE = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'from-jsdoc', 'index_d_ts.txt'), 'utf8');
                const response = await openai.createCompletion({
                    ...OPENAI_SETTINGS,
                    'prompt': INDEX_D_TS_FILE.replace('{{input}}', jsCode[1])
                });
                if (response.data && response.data.choices) {
                    ts = response?.data?.choices[0].text || '';
                    const txt = LICENSE_TXT + '\n// TypeScript Version: 2.0\n' + ts;
                    (0, fs_1.writeFileSync)((0, path_1.join)(pkgDir, 'docs', 'types', 'index.d.ts'), txt);
                }
            }
            catch (err) {
                (0, core_1.setFailed)(err.message);
            }
            try {
                const TEST_TS_FILE = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'from-ts', 'test_ts.txt'), 'utf8');
                const response = await openai.createCompletion({
                    ...OPENAI_SETTINGS,
                    'prompt': TEST_TS_FILE.replace('{{input}}', ts)
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
                        ...OPENAI_SETTINGS,
                        'prompt': USAGE_TXT_FILE.replace('{{jsdoc}}', jsCode[1]).replace('{{cli}}', cli)
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
                    const CLI_OPTS_JSON_FILE = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'from-jsdoc', 'cli_opts_json.txt'), 'utf8');
                    const response = await openai.createCompletion({
                        ...OPENAI_SETTINGS,
                        'prompt': CLI_OPTS_JSON_FILE.replace('{{jsdoc}}', jsCode[1])
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
                    const CLI_FILE = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'from-jsdoc', 'cli.txt'), 'utf8');
                    const response = await openai.createCompletion({
                        ...OPENAI_SETTINGS,
                        'prompt': CLI_FILE.replace('{{jsdoc}}', jsCode[1])
                    });
                    if (response.data && response.data.choices) {
                        const txt = '#!/usr/bin/env node\n\n' + LICENSE_TXT + '\n\'use strict\';\n' + (response?.data?.choices[0].text || '');
                        (0, fs_1.writeFileSync)((0, path_1.join)(pkgDir, 'bin', 'cli'), txt);
                    }
                }
                catch (err) {
                    (0, core_1.setFailed)(err.message);
                }
                try {
                    const TEST_CLI_JS_FILE = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'from-jsdoc', 'test_cli_js.txt'), 'utf8');
                    const response = await openai.createCompletion({
                        'prompt': TEST_CLI_JS_FILE.replace('{{jsdoc}}', jsCode[1]),
                        ...OPENAI_SETTINGS
                    });
                    if (response.data && response.data.choices) {
                        const txt = LICENSE_TXT + '\n\'use strict\';\n' + (response?.data?.choices[0].text || '');
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