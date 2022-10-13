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
const string_trim_1 = __importDefault(require("@stdlib/string-trim"));
const string_replace_1 = __importDefault(require("@stdlib/string-replace"));
const extract_examples_section_1 = __importDefault(require("./extract_examples_section"));
const extract_usage_section_1 = __importDefault(require("./extract_usage_section"));
const extract_cli_section_1 = __importDefault(require("./extract_cli_section"));
// VARIABLES //
const RE_YAML = /```yaml([\s\S]+?)```/;
const RE_JS = /```js([\s\S]+?)```/;
const RE_CLI_USAGE = /```text(\nUsage:[\s\S]+?)```/;
const RE_CLI_ALIAS = /Usage: ([a-z-]+) \[options\]/;
const RE_JSDOC = /\/\*\*[\s\S]+?\*\//;
const RE_MAIN_JSDOC = /(?:\/\/ MAIN \/\/|'use strict';)\r?\n\r?\n(\/\*\*[\s\S]*?\*\/)[\s\S]*?module\.exports = (.*?);$/;
const PROMPTS_DIR = (0, path_1.join)(__dirname, '..', 'prompts');
const SNIPPETS_DIR = (0, path_1.join)(__dirname, '..', 'snippets');
const WAIT_TIME = 10000; // 10 seconds
const CURRENT_YEAR = String((0, time_current_year_1.default)());
const OPENAI_SETTINGS = {
    'model': 'code-davinci-002',
    'temperature': 0.7,
    'max_tokens': 1024,
    'top_p': 1,
    'frequency_penalty': 0,
    'presence_penalty': 0,
    'stop': ['Input (', 'Output ('],
    // 'user': context.actor
};
const LICENSE_TXT = `/**
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
// FUNCTIONS //
function writeToDisk(dir, filename, data) {
    try {
        (0, fs_1.mkdirSync)(dir);
    }
    catch (err) {
        (0, core_1.debug)(`Unable to create ${dir} directory. Error: ${err.message}.`);
    }
    // Ensure that there is a trailing newline:
    if (data[data.length - 1] !== '\n') {
        data += '\n';
    }
    (0, fs_1.writeFileSync)((0, path_1.join)(dir, filename), data);
}
function writePackageJSON(dir, pkg, cli) {
    const pkgJSON = {
        'name': `@stdlib/${pkg}`,
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
    (0, fs_1.writeFileSync)((0, path_1.join)(dir, 'package.json'), JSON.stringify(pkgJSON, null, 2) + '\n');
}
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function extractDepsFromIncludes(dependencies, code) {
    // Find all `#include "stdlib/...` statements and add them to the `dependencies` set:
    const RE_STDLIB_INCLUDES = /#include "stdlib\/([^"]+)\.h"/g;
    let match = RE_STDLIB_INCLUDES.exec(code);
    while (match !== null) {
        const include = match[1];
        dependencies.add(`"@stdlib/${(0, string_replace_1.default)(include, '_', '-')}"`);
        match = RE_STDLIB_INCLUDES.exec(code);
    }
    return dependencies;
}
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
    const token = (0, core_1.getInput)('GITHUB_TOKEN');
    const addedFiles = (0, core_1.getInput)('added-files');
    const octokit = (0, github_1.getOctokit)(token);
    (0, core_1.debug)('Working directory: ' + workDir);
    (0, core_1.debug)('Prompts directory: ' + PROMPTS_DIR);
    // Bail if the action is triggered from outside of the `stdlib-js' organization:
    const org = github_1.context.repo.owner;
    if (org !== 'stdlib-js') {
        return (0, core_1.setFailed)('Action is for internal use and must be triggered from within the `stdlib-js` organization.');
    }
    switch (github_1.context.eventName) {
        case 'push':
        case 'pull_request':
        case 'pull_request_target': {
            let files;
            // Check whether PR was assigned to the "stdlib-bot" user:
            if (github_1.context.eventName === 'pull_request' || github_1.context.eventName === 'pull_request_target') {
                if (github_1.context.payload.pull_request.assignee.login !== 'stdlib-bot') {
                    (0, core_1.debug)('PR not assigned to stdlib-bot. Skipping...');
                    return;
                }
                if (addedFiles) {
                    files = addedFiles.split(' ');
                }
                else {
                    const res = await octokit.rest.pulls.listFiles({
                        'owner': github_1.context.repo.owner,
                        'repo': github_1.context.repo.repo,
                        'pull_number': github_1.context.payload.pull_request.number
                    });
                    files = res.data
                        .filter(file => file.status === 'added')
                        .map(file => file.filename);
                }
            }
            else {
                files = addedFiles.split(' ');
            }
            // Check whether the PR contains a new package's README.md file:
            const readme = files.find(f => {
                return f.endsWith('README.md');
            });
            if (readme === void 0) {
                (0, core_1.debug)('PR does not contain a new package\'s README.md file. Skipping...');
                return;
            }
            // Extract the directory path for the new package:
            const dir = readme.replace('/README.md', '');
            // Load the package's README.md file:
            const readmePath = (0, path_1.join)(workDir, readme);
            const readmeText = (0, fs_1.readFileSync)(readmePath, 'utf8');
            (0, core_1.debug)('New package directory: ' + dir);
            // Hash map of whether the PR contains a new package's files:
            const has = {
                'benchmark/benchmark.js': false,
                'bin/cli': false,
                'docs/types/index.d.ts': false,
                'docs/types/test.ts': false,
                'docs/repl.txt': false,
                'docs/usage.txt': false,
                'etc/cli_opts.json': false,
                'examples/index.js': false,
                'lib/index.js': false,
                'lib/main.js': false,
                'test/test.js': false,
                'test/test.cli.js': false
            };
            files.forEach(f => {
                if (f.endsWith('benchmark/benchmark.js')) {
                    has['benchmark/benchmark.js'] = true;
                }
                if (f.endsWith('bin/cli')) {
                    has['bin/cli'] = true;
                }
                if (f.endsWith('docs/types/index.d.ts')) {
                    has['docs/types/index.d.ts'] = true;
                }
                if (f.endsWith('docs/types/test.ts')) {
                    has['docs/types/test.ts'] = true;
                }
                if (f.endsWith('docs/repl.txt')) {
                    has['docs/repl.txt'] = true;
                }
                if (f.endsWith('docs/usage.txt')) {
                    has['docs/usage.txt'] = true;
                }
                if (f.endsWith('etc/cli_opts.json')) {
                    has['etc/cli_opts.json'] = true;
                }
                if (f.endsWith('examples/index.js')) {
                    has['examples/index.js'] = true;
                }
                if (f.endsWith('lib/index.js')) {
                    has['lib/index.js'] = true;
                }
                if (f.endsWith('lib/main.js')) {
                    has['lib/main.js'] = true;
                }
                if (f.endsWith('test/test.js')) {
                    has['test/test.js'] = true;
                }
                if (f.endsWith('test/test.cli.js')) {
                    has['test/test.cli.js'] = true;
                }
            });
            const usageSection = (0, extract_usage_section_1.default)(readmeText);
            const examplesSection = (0, extract_examples_section_1.default)(readmeText);
            const cliSection = (0, extract_cli_section_1.default)(readmeText);
            let jsdoc;
            let cli;
            if (!has['docs/repl.txt']) {
                (0, core_1.debug)('PR does not contain a new package\'s REPL file. Scaffolding...');
                try {
                    const response = await openai.createCompletion({
                        ...OPENAI_SETTINGS,
                        'model': 'davinci:ft-carnegie-mellon-university-2022-09-17-02-09-31',
                        'prompt': usageSection + examplesSection + '\n|>|\n\n',
                        'stop': ['END', '|>|']
                    });
                    if (response.data && response.data.choices) {
                        const txt = (response?.data?.choices[0].text || '') + SEE_ALSO;
                        writeToDisk((0, path_1.join)(dir, 'docs'), 'repl.txt', txt);
                    }
                }
                catch (err) {
                    (0, core_1.debug)(err);
                    (0, core_1.setFailed)(err.message);
                }
                await sleep(WAIT_TIME);
            }
            if (!has['lib/index.js']) {
                (0, core_1.debug)('PR does not contain a new package\'s index file. Scaffolding...');
                try {
                    const response = await openai.createCompletion({
                        ...OPENAI_SETTINGS,
                        'model': 'davinci:ft-carnegie-mellon-university:readme-to-index-2022-10-04-19-00-45',
                        'prompt': usageSection + '\n|>|\n\n',
                        'stop': ['END', '|>|']
                    });
                    if (response.data && response.data.choices) {
                        const txt = LICENSE_TXT + '\n\'use strict\';\n' + (response?.data?.choices[0].text || '');
                        writeToDisk((0, path_1.join)(dir, 'lib'), 'index.js', txt);
                    }
                }
                catch (err) {
                    (0, core_1.debug)(err);
                    (0, core_1.setFailed)(err.message);
                }
                await sleep(WAIT_TIME);
            }
            if (!has['lib/main.js']) {
                (0, core_1.debug)('PR does not contain a new package\'s main file. Scaffolding...');
                try {
                    const PROMPT = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'from-readme', 'main_js.txt'), 'utf8')
                        .replace('{{input}}', usageSection);
                    (0, core_1.debug)('Prompt: ' + PROMPT);
                    const response = await openai.createCompletion({
                        ...OPENAI_SETTINGS,
                        'prompt': PROMPT
                    });
                    if (response.data && response.data.choices) {
                        let txt = response?.data?.choices[0].text || '';
                        jsdoc = RE_JSDOC.exec(txt);
                        txt = LICENSE_TXT + '\n\'use strict\';\n' + txt;
                        writeToDisk((0, path_1.join)(dir, 'lib'), 'main.js', txt);
                    }
                }
                catch (err) {
                    (0, core_1.debug)(err);
                    (0, core_1.setFailed)(err.message);
                }
                await sleep(WAIT_TIME);
            }
            if (jsdoc) {
                if (!has['benchmark/benchmark.js']) {
                    try {
                        const PROMPT = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'from-jsdoc', 'benchmark_js.txt'), 'utf8')
                            .replace('{{input}}', jsdoc[0]);
                        const response = await openai.createCompletion({
                            ...OPENAI_SETTINGS,
                            'prompt': PROMPT
                        });
                        if (response.data && response.data.choices) {
                            const txt = LICENSE_TXT + '\n\'use strict\';\n' + (response?.data?.choices[0].text || '');
                            writeToDisk((0, path_1.join)(dir, 'benchmark'), 'benchmark.js', txt);
                        }
                    }
                    catch (err) {
                        (0, core_1.setFailed)(err.message);
                    }
                    await sleep(WAIT_TIME);
                }
                let ts = '';
                if (!has['docs/types/index.d.ts']) {
                    try {
                        const PROMPT = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'from-jsdoc', 'index_d_ts.txt'), 'utf8')
                            .replace('{{input}}', jsdoc[0]);
                        const response = await openai.createCompletion({
                            ...OPENAI_SETTINGS,
                            'prompt': PROMPT
                        });
                        if (response.data && response.data.choices) {
                            ts = response?.data?.choices[0].text || '';
                            const txt = LICENSE_TXT + '\n// TypeScript Version: 2.0\n' + ts;
                            writeToDisk((0, path_1.join)(dir, 'docs', 'types'), 'index.d.ts', txt);
                        }
                    }
                    catch (err) {
                        (0, core_1.setFailed)(err.message);
                    }
                    await sleep(WAIT_TIME);
                }
                if (!has['docs/types/test.ts']) {
                    try {
                        const PROMPT = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'from-ts', 'test_ts.txt'), 'utf8')
                            .replace('{{input}}', ts);
                        const response = await openai.createCompletion({
                            ...OPENAI_SETTINGS,
                            'prompt': PROMPT
                        });
                        if (response.data && response.data.choices) {
                            let txt = response?.data?.choices[0].text || '';
                            txt = LICENSE_TXT + txt;
                            writeToDisk((0, path_1.join)(dir, 'docs', 'types'), 'test.ts', txt);
                        }
                    }
                    catch (err) {
                        (0, core_1.setFailed)(err.message);
                    }
                    await sleep(WAIT_TIME);
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
                        writeToDisk((0, path_1.join)(dir, 'examples'), 'index.js', txt);
                    }
                }
                catch (err) {
                    (0, core_1.debug)(err);
                    (0, core_1.setFailed)(err.message);
                }
                await sleep(WAIT_TIME);
            }
            if (!has['test/test.js']) {
                try {
                    const PROMPT = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'from-readme', 'test_js.txt'), 'utf8')
                        .replace('{{input}}', usageSection);
                    const response = await openai.createCompletion({
                        ...OPENAI_SETTINGS,
                        'prompt': PROMPT
                    });
                    if (response.data && response.data.choices) {
                        const txt = LICENSE_TXT + '\n\'use strict\';\n' + (response?.data?.choices[0].text || '');
                        writeToDisk((0, path_1.join)(dir, 'test'), 'test.js', txt);
                    }
                }
                catch (err) {
                    (0, core_1.setFailed)(err.message);
                }
                await sleep(WAIT_TIME);
            }
            if (cliSection) {
                cli = RE_CLI_ALIAS.exec(cliSection);
                if (!has['bin/cli']) {
                    const PROMPT = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'from-readme', 'cli.txt'), 'utf8')
                        .replace('{{input}}', cliSection);
                    (0, core_1.debug)('Prompt: ' + PROMPT);
                    const response = await openai.createCompletion({
                        ...OPENAI_SETTINGS,
                        'prompt': PROMPT
                    });
                    if (response.data && response.data.choices) {
                        const txt = '#!/usr/bin/env node\n\n' + LICENSE_TXT + '\n\'use strict\';\n\n' + (response?.data?.choices[0].text || '');
                        writeToDisk((0, path_1.join)(dir, 'bin'), 'cli', txt);
                    }
                    await sleep(WAIT_TIME);
                }
                if (!has['docs/usage.txt']) {
                    const matches = RE_CLI_USAGE.exec(cliSection);
                    if (matches) {
                        const txt = matches[1] + '\n';
                        writeToDisk((0, path_1.join)(dir, 'docs'), 'usage.txt', txt);
                    }
                    await sleep(WAIT_TIME);
                }
                if (!has['etc/cli_opts.json']) {
                    const response = await openai.createCompletion({
                        ...OPENAI_SETTINGS,
                        'model': 'davinci:ft-carnegie-mellon-university:readme-cli-to-opts-2022-10-04-21-04-27',
                        'prompt': cliSection + '\n|>|\n\n',
                        'stop': ['END', '|>|']
                    });
                    if (response.data && response.data.choices) {
                        const txt = (0, string_trim_1.default)(response?.data?.choices[0].text || '') + '\n';
                        writeToDisk((0, path_1.join)(dir, 'etc'), 'cli_opts.json', txt);
                    }
                    await sleep(WAIT_TIME);
                }
                if (!has['test/test.cli.js']) {
                    const PROMPT = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'from-readme', 'test_cli_js.txt'), 'utf8')
                        .replace('{{input}}', cliSection);
                    (0, core_1.debug)('Prompt: ' + PROMPT);
                    const response = await openai.createCompletion({
                        ...OPENAI_SETTINGS,
                        'max_tokens': OPENAI_SETTINGS.max_tokens * 4,
                        'prompt': PROMPT
                    });
                    if (response.data && response.data.choices) {
                        const txt = LICENSE_TXT + '\n\'use strict\';\n' + (response?.data?.choices[0].text || '');
                        writeToDisk((0, path_1.join)(dir, 'test'), 'test.cli.js', txt);
                    }
                    await sleep(WAIT_TIME);
                }
                let stdinErrorFixture = (0, fs_1.readFileSync)((0, path_1.join)(SNIPPETS_DIR, 'test', 'fixtures', 'stdin_error_js_txt.txt'), 'utf8');
                stdinErrorFixture = stdinErrorFixture.replace('{{year}}', CURRENT_YEAR);
                writeToDisk((0, path_1.join)(dir, 'test', 'fixtures'), 'stdin_error.js.txt', stdinErrorFixture);
            }
            const path = (0, string_substring_after_1.default)(dir, 'lib/node_modules/@stdlib/');
            (0, core_1.setOutput)('dir', dir);
            (0, core_1.setOutput)('path', path);
            (0, core_1.setOutput)('alias', usageSection.substring(0, usageSection.indexOf(' =')));
            writePackageJSON(dir, path, cli ? cli[1] : null);
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
            writePackageJSON(pkgDir, path, cli);
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
                    writeToDisk((0, path_1.join)(pkgDir, 'examples'), 'index.js', txt);
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
                    writeToDisk(pkgDir, 'README.md', txt);
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
                    writeToDisk((0, path_1.join)(pkgDir, 'benchmark'), 'benchmark.js', txt);
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
                    writeToDisk((0, path_1.join)(pkgDir, 'lib'), 'index.js', txt);
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
                    writeToDisk((0, path_1.join)(pkgDir, 'test'), 'test.js', txt);
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
                    writeToDisk((0, path_1.join)(pkgDir, 'docs'), 'repl.txt', txt);
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
                    writeToDisk((0, path_1.join)(pkgDir, 'docs', 'types'), 'index.d.ts', txt);
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
                    writeToDisk((0, path_1.join)(pkgDir, 'docs', 'types'), 'test.ts', txt);
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
                        writeToDisk((0, path_1.join)(pkgDir, 'docs'), 'usage.txt', txt);
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
                        writeToDisk((0, path_1.join)(pkgDir, 'etc'), 'cli_opts.json', json);
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
                        const txt = '#!/usr/bin/env node\n\n' + LICENSE_TXT + '\n\'use strict\';\n\n' + (response?.data?.choices[0].text || '');
                        writeToDisk((0, path_1.join)(pkgDir, 'bin'), 'cli', txt);
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
                        writeToDisk((0, path_1.join)(pkgDir, 'test'), 'test.cli.js', txt);
                    }
                }
                catch (err) {
                    (0, core_1.setFailed)(err.message);
                }
            }
            break;
        }
        case 'workflow_dispatch': {
            // Case: Workflow was manually triggered:
            const pkgPath = (0, core_1.getInput)('pkg', { required: true });
            const actionType = (0, core_1.getInput)('type', { required: true });
            const pkgDir = (0, path_1.join)(workDir, 'lib', 'node_modules', '@stdlib', pkgPath);
            if (actionType === 'native-addon') {
                const main = (0, fs_1.readFileSync)((0, path_1.join)(pkgDir, 'lib', 'main.js'), 'utf8');
                const jsdocMatch = main.match(RE_MAIN_JSDOC);
                const RE_EXPORT_NAME = /module\.exports = ([^;]+);/;
                const aliasMatch = main.match(RE_EXPORT_NAME);
                (0, core_1.debug)('Package alias: ' + aliasMatch[1]);
                (0, fs_1.mkdirSync)((0, path_1.join)(pkgDir, 'src'));
                (0, fs_1.mkdirSync)((0, path_1.join)(pkgDir, 'include', 'stdlib', pkgPath), {
                    'recursive': true
                });
                let makefile = (0, fs_1.readFileSync)((0, path_1.join)(SNIPPETS_DIR, 'src', 'Makefile.txt'), 'utf8');
                makefile = makefile.replace('{{year}}', CURRENT_YEAR);
                writeToDisk((0, path_1.join)(pkgDir, 'src'), 'Makefile', makefile);
                let bindingGyp = (0, fs_1.readFileSync)((0, path_1.join)(SNIPPETS_DIR, 'binding_gyp.txt'), 'utf8');
                bindingGyp = bindingGyp.replace('{{year}}', CURRENT_YEAR);
                writeToDisk(pkgDir, 'binding.gyp', bindingGyp);
                let includeGypi = (0, fs_1.readFileSync)((0, path_1.join)(SNIPPETS_DIR, 'include_gypi.txt'), 'utf8');
                includeGypi = includeGypi.replace('{{year}}', CURRENT_YEAR);
                writeToDisk(pkgDir, 'include.gypi', includeGypi);
                let native = (0, fs_1.readFileSync)((0, path_1.join)(SNIPPETS_DIR, 'lib', 'native_js.txt'), 'utf8');
                native = native.replace('{{year}}', CURRENT_YEAR);
                native = (0, string_replace_1.default)(native, '{{jsdoc}}', jsdocMatch[1]);
                native = (0, string_replace_1.default)(native, '{{alias}}', aliasMatch[1]);
                const reParams = new RegExp('function ' + aliasMatch[1] + '\\(([^)]+)\\)', 'm');
                const paramsMatch = main.match(reParams);
                (0, core_1.debug)('Function parameters: ' + paramsMatch[1]);
                native = (0, string_replace_1.default)(native, '{{params}}', paramsMatch[1]);
                writeToDisk((0, path_1.join)(pkgDir, 'lib'), 'native.js', native);
                const code = (0, string_substring_after_1.default)(main, '\'use strict\';');
                const dependencies = new Set();
                try {
                    const addon = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'js-to-c', 'addon_c.txt'), 'utf8');
                    const response = await openai.createCompletion({
                        ...OPENAI_SETTINGS,
                        'prompt': addon.replace('{{input}}', code)
                    });
                    if (response.data && response.data.choices) {
                        const txt = LICENSE_TXT + (response?.data?.choices[0].text || '');
                        extractDepsFromIncludes(dependencies, txt);
                        writeToDisk((0, path_1.join)(pkgDir, 'src'), 'addon.c', txt);
                    }
                }
                catch (err) {
                    (0, core_1.setFailed)(err.message);
                }
                try {
                    const addon = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'js-to-c', 'main_c.txt'), 'utf8');
                    const response = await openai.createCompletion({
                        ...OPENAI_SETTINGS,
                        'prompt': addon.replace('{{input}}', code)
                    });
                    if (response.data && response.data.choices) {
                        const txt = LICENSE_TXT + (response?.data?.choices[0].text || '');
                        extractDepsFromIncludes(dependencies, txt);
                        writeToDisk((0, path_1.join)(pkgDir, 'src'), aliasMatch[1] + '.c', txt);
                    }
                }
                catch (err) {
                    (0, core_1.setFailed)(err.message);
                }
                try {
                    const addon = (0, fs_1.readFileSync)((0, path_1.join)(PROMPTS_DIR, 'js-to-c', 'main_h.txt'), 'utf8');
                    const response = await openai.createCompletion({
                        ...OPENAI_SETTINGS,
                        'prompt': addon.replace('{{input}}', code)
                    });
                    if (response.data && response.data.choices) {
                        const txt = LICENSE_TXT + (response?.data?.choices[0].text || '');
                        writeToDisk((0, path_1.join)(pkgDir, 'include', 'stdlib', pkgPath), aliasMatch[1] + '.h', txt);
                    }
                }
                catch (err) {
                    (0, core_1.setFailed)(err.message);
                }
                let manifest = (0, fs_1.readFileSync)((0, path_1.join)(SNIPPETS_DIR, 'manifest_json.txt'), 'utf8');
                manifest = (0, string_replace_1.default)(manifest, '{{dependencies}}', Array.from(dependencies).join('\n,\t\t\t\t'));
                manifest = (0, string_replace_1.default)(manifest, '{{src}}', '"./src/' + aliasMatch[1] + '.c"');
                writeToDisk(pkgDir, 'manifest.json', manifest);
            }
            break;
        }
        default:
            (0, core_1.setFailed)('Unsupported event name: ' + github_1.context.eventName);
    }
}
main();
//# sourceMappingURL=index.js.map