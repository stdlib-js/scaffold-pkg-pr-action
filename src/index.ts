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

// MODULES //

import { debug, getInput, setFailed, setOutput } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { join } from 'path';
import { Configuration, OpenAIApi } from 'openai';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { parse } from 'yaml';
import currentYear from '@stdlib/time-current-year';
import substringAfter from '@stdlib/string-substring-after';
import extractExamplesSection from './extract_examples_section';
import extractUsageSection from './extract_usage_section';
import extractCLISection from './extract_cli_section';


// VARIABLES //

const RE_YAML = /```yaml([\s\S]+?)```/;
const RE_JS = /```js([\s\S]+?)```/;
const PROMPTS_DIR = join( __dirname, '..', 'prompts' );
const OPENAI_SETTINGS = {
	'model': 'code-davinci-002',
	'temperature': 0.7,
	'max_tokens': 1024,
	'top_p': 1,
	'frequency_penalty': 0,
	'presence_penalty': 0,
	'stop': [ 'Input (ts):', 'Input (jsdoc):', 'Input (README.md):', 'Output (' ]
};
const LICENSE_TXT = `/*
* @license Apache-2.0
*
* Copyright (c) ${currentYear()} The Stdlib Authors.
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

Copyright (c) ${currentYear()} The Stdlib Authors.

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
async function main(): Promise<void> {
	const OPENAI_API_KEY = getInput( 'OPENAI_API_KEY', { 
		required: true 
	});
	const configuration = new Configuration({
		'apiKey': OPENAI_API_KEY
	});
	const openai = new OpenAIApi( configuration );
	const workDir = join( process.env.GITHUB_WORKSPACE );
	debug( 'Working directory: '+workDir );
	debug( 'Prompts directory: '+PROMPTS_DIR );

	switch ( context.eventName ) {
	case 'pull_request': {
		// Check whether PR was assigned to the "stdlib-bot" user:
		if ( context.payload.pull_request.assignee.login !== 'stdlib-bot' ) {
			debug( 'PR not assigned to stdlib-bot. Skipping...' );
			return;
		}
		// Get the files created by the PR via the GitHub API:
		const token = getInput( 'GITHUB_TOKEN' );
		const octokit = getOctokit( token );
		
		const files = await octokit.rest.pulls.listFiles({
			'owner': context.repo.owner,
			'repo': context.repo.repo,
			'pull_number': context.payload.pull_request.number
		});
		debug( 'Files: '+JSON.stringify( files.data ) );
		
		// Check whether the PR contains a new package's README.md file:
		const readme = files.data.find( f => {
			return f.filename.endsWith( 'README.md' ) && f.status === 'added';
		});
		if ( readme === void 0 ) {
			debug( 'PR does not contain a new package\'s README.md file. Skipping...' );
			return;
		}
		// Extract the directory path for the new package:
		const dir = readme.filename.replace( '/README.md', '' );
		
		// Load the package's README.md file:
		const readmePath = join( workDir, readme.filename );
		const readmeText = readFileSync( readmePath, 'utf8' );
		
		debug( 'New package directory: '+dir );
		
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
			'test/test.js': false,
			'test/test.cli.js': false
		};
		files.data.forEach( f => {
			if ( f.filename.endsWith( 'benchmark/benchmark.js' ) ) {
				has['benchmark/benchmark.js'] = true;
			}
			if ( f.filename.endsWith( 'bin/cli' ) ) {
				has['bin/cli'] = true;
			}
			if ( f.filename.endsWith( 'docs/types/index.d.ts' ) ) {
				has['docs/types/index.d.ts'] = true;
			}
			if ( f.filename.endsWith( 'docs/types/test.ts' ) ) {
				has['docs/types/test.ts'] = true;
			}
			if ( f.filename.endsWith( 'docs/repl.txt' ) ) {
				has['docs/repl.txt'] = true;
			}
			if ( f.filename.endsWith( 'docs/usage.txt' ) ) {
				has['docs/usage.txt'] = true;
			}
			if ( f.filename.endsWith( 'etc/cli_opts.json' ) ) {
				has['etc/cli_opts.json'] = true;
			}
			if ( f.filename.endsWith( 'examples/index.js' ) ) {
				has['examples/index.js'] = true;
			}
			if ( f.filename.endsWith( 'lib/index.js' ) ) {
				has['lib/index.js'] = true;
			}
			if ( f.filename.endsWith( 'test/test.js' ) ) {
				has['test/test.js'] = true;
			}
			if ( f.filename.endsWith( 'test/test.cli.js' ) ) {
				has['test/test.cli.js'] = true;
			}
		});
		const usageSection = extractUsageSection( readmeText );
		const examplesSection = extractExamplesSection( readmeText );
		const cliSection = extractCLISection( readmeText );
		if ( !has['docs/repl.txt'] ) {
			debug( 'PR does not contain a new package\'s REPL file. Scaffolding...' );
			try {
				const response = await openai.createCompletion({
					...OPENAI_SETTINGS,
					'model': 'davinci:ft-carnegie-mellon-university-2022-09-17-02-09-31',
					'prompt': usageSection + examplesSection + '\n|>|\n\n',
					'stop': [ 'END' ]
				});
				if ( response.data && response.data.choices ) {
					const txt = ( response?.data?.choices[ 0 ].text || '' ) + SEE_ALSO;
					try {
						mkdirSync( join( dir, 'docs' ) );
					}
					catch ( err ) {
						debug( 'Unable to create `docs` directory. Error: '+err.message );
					}
					writeFileSync( join( dir, 'docs', 'repl.txt' ), txt );
				}
			} catch ( err ) {
				debug( err );
				setFailed( err.message );
			}
		}
		if ( !has['lib/index.js'] ) {
			debug( 'PR does not contain a new package\'s index file. Scaffolding...' );
			try {
				const response = await openai.createCompletion({
					'model': 'davinci:ft-carnegie-mellon-university:readme-to-index-2022-10-04-19-00-45',
					'prompt': usageSection + '\n|>|\n\n',
					'stop': [ 'END' ]
				});
				if ( response.data && response.data.choices ) {
					const txt = LICENSE_TXT + '\n\'use strict\';\n' + ( response?.data?.choices[ 0 ].text || '' );
					try {
						mkdirSync( join( dir, 'lib' ) );
					}
					catch ( err ) {
						debug( 'Unable to create `lib` directory. Error: '+err.message );
					}
					writeFileSync( join( dir, 'lib', 'index.js' ), txt );
				}
			} catch ( err ) {
				debug( err );
				setFailed( err.message );
			}
		}
		if ( !has['examples/index.js'] ) {
			debug( 'PR does not contain a new package\'s examples file. Scaffolding...' );
			try {
				const PROMPT = readFileSync( join( PROMPTS_DIR, 'from-readme', 'examples_js.txt' ), 'utf8' )
					.replace( '{{input}}', examplesSection );
				debug( 'Prompt: '+PROMPT );
				const response = await openai.createCompletion({
					...OPENAI_SETTINGS,
					'prompt': PROMPT
				});
				if ( response.data && response.data.choices ) {
					const txt = LICENSE_TXT + '\n\'use strict\';\n' + ( response?.data?.choices[ 0 ].text || '' );
					try {
						mkdirSync( join( dir, 'examples' ) );
					}
					catch ( err ) {
						debug( 'Unable to create `examples` directory. Error: '+err.message );
					}
					writeFileSync( join( dir, 'examples', 'index.js' ), txt );
				}
			} catch ( err ) {
				debug( err );
				setFailed( err.message );
			}
		}	
		if ( cliSection ) {
			if ( !has[ 'bin/cli' ] ) {
				const PROMPT = readFileSync( join( PROMPTS_DIR, 'from-readme', 'cli.txt' ), 'utf8' )
					.replace( '{{input}}', cliSection );
				debug( 'Prompt: '+PROMPT );
				const response = await openai.createCompletion({
					...OPENAI_SETTINGS,
					'prompt': PROMPT
				});
				if ( response.data && response.data.choices ) {
					const txt = ( response?.data?.choices[ 0 ].text || '' );
					try {
						mkdirSync( join( dir, 'bin' ) );
					}
					catch ( err ) {
						debug( 'Unable to create `bin` directory. Error: '+err.message );
					}
					writeFileSync( join( dir, 'bin', 'cli' ), txt );
				}
			}
			if ( !has[ 'docs/usage.txt' ] ) {
				const PROMPT = readFileSync( join( PROMPTS_DIR, 'from-readme', 'usage_txt.txt' ), 'utf8' )
					.replace( '{{input}}', cliSection );
				debug( 'Prompt: '+PROMPT );
				const response = await openai.createCompletion({
					...OPENAI_SETTINGS,
					'prompt': PROMPT
				});
				if ( response.data && response.data.choices ) {
					const txt = ( response?.data?.choices[ 0 ].text || '' );
					try {
						mkdirSync( join( dir, 'docs' ) );
					}
					catch ( err ) {
						debug( 'Unable to create `docs` directory. Error: '+err.message );
					}
					writeFileSync( join( dir, 'docs', 'usage.txt' ), txt );
				}
			}
			if ( !has[ 'etc/cli_opts.json' ] ) {
				const PROMPT = readFileSync( join( PROMPTS_DIR, 'from-readme', 'cli_opts_json.txt' ), 'utf8' )
					.replace( '{{input}}', cliSection );
				debug( 'Prompt: '+PROMPT );
				const response = await openai.createCompletion({
					...OPENAI_SETTINGS,
					'prompt': PROMPT
				});
				if ( response.data && response.data.choices ) {
					const txt = ( response?.data?.choices[ 0 ].text || '' );
					try {
						mkdirSync( join( dir, 'etc' ) );
					}
					catch ( err ) {
						debug( 'Unable to create `etc` directory. Error: '+err.message );
					}
					writeFileSync( join( dir, 'etc', 'cli_opts.json' ), txt );
				}
			}
			if ( !has[ 'test/test.cli.js' ] ) {
				const PROMPT = readFileSync( join( PROMPTS_DIR, 'from-readme', 'test_cli_js.txt' ), 'utf8' )
					.replace( '{{input}}', cliSection );
				debug( 'Prompt: '+PROMPT );
				const response = await openai.createCompletion({
					...OPENAI_SETTINGS,
					'prompt': PROMPT
				});
				if ( response.data && response.data.choices ) {
					const txt = ( response?.data?.choices[ 0 ].text || '' );
					try {
						mkdirSync( join( dir, 'test' ) );
					}
					catch ( err ) {
						debug( 'Unable to create `test` directory. Error: '+err.message );
					}
					writeFileSync( join( dir, 'test', 'test.cli.js' ), txt );
				}
			}
		}
		setOutput( 'dir', dir );	
		setOutput( 'path', substringAfter( dir, 'lib/node_modules/@stdlib/' ) );
		setOutput( 'alias', usageSection.substring( 0, usageSection.indexOf( ' =' ) ) );
		break;
	}
	case 'issue_comment': {
		debug( 'Received a comment, checking if it is a command...' );
		
		// Extract the YAML code block:
		const matches = RE_YAML.exec( context.payload.comment.body );
		if ( matches === null ) {
			debug( 'No YAML code block found.' );
			return;
		}
		debug( 'Found a YAML code block: '+matches[ 1 ] );
		const yaml = parse( matches[ 1 ] );
		if ( yaml.action !== 'scaffold' ) {
			debug( 'Not a scaffold command.' );
			return;
		}
		const { path, alias, cli } = yaml;
		debug( `Scaffolding package: ${path} (${alias}) ${cli ? 'with CLI' : 'without CLI'}` );
		const pkgDir = join( workDir, 'lib', 'node_modules', '@stdlib', path );
		debug( 'Package directory: '+pkgDir );
		if ( existsSync( pkgDir ) ) {
			setFailed( 'Package directory already exists.' );
		}
		mkdirSync( pkgDir, {
			'recursive': true
		});
		mkdirSync( join( pkgDir, 'benchmark' ) );
		mkdirSync( join( pkgDir, 'docs' ) );
		mkdirSync( join( pkgDir, 'docs', 'types' ) );
		mkdirSync( join( pkgDir, 'examples' ) );
		mkdirSync( join( pkgDir, 'lib' ) );
		mkdirSync( join( pkgDir, 'test' ) );
		if ( cli ) {
			mkdirSync( join( pkgDir, 'bin' ) );
			mkdirSync( join( pkgDir, 'etc' ) );
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
			...( cli ? {
				"bin": {
					[cli]: "./bin/cli"
				}			
			} : {} ),
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
		writeFileSync( join( pkgDir, 'package.json' ), JSON.stringify( pkgJSON, null, 2 )+'\n' );
		setOutput( 'dir', pkgDir );
		setOutput( 'path', path );
		setOutput( 'alias', alias );
		
		const jsCode = RE_JS.exec( context.payload.comment.body );
		if ( jsCode === null ) {
			debug( 'No JS code block found.' );
			return;
		}
		debug( 'Found a JS code block...' );
		try {
			const EXAMPLES_JS_FILE = readFileSync( join( PROMPTS_DIR, 'from-jsdoc', 'examples_js.txt' ), 'utf8' );
			const prompt = EXAMPLES_JS_FILE.replace( '{{input}}', jsCode[ 1 ] );
			debug( 'Prompt: '+prompt );
			const response = await openai.createCompletion({
				...OPENAI_SETTINGS,
				'prompt': prompt
			});
			if ( response.data && response.data.choices ) {
				const txt = LICENSE_TXT + '\n\'use strict\';\n' + ( response?.data?.choices[ 0 ].text || '' ) + '\n';
				writeFileSync( join( pkgDir, 'examples', 'index.js' ), txt );
			}
		} catch ( err ) {
			setFailed( err.message );
		}
		try {
			const README_MD_FILE = readFileSync( join( PROMPTS_DIR, 'from-jsdoc', 'readme_md.txt' ), 'utf8' );
			const response = await openai.createCompletion({
				...OPENAI_SETTINGS,
				'prompt': README_MD_FILE.replace( '{{input}}', jsCode[ 1 ] )
			});
			if ( response.data && response.data.choices ) {
				const txt = README_LICENSE + ( response?.data?.choices[ 0 ].text || '' );
				writeFileSync( join( pkgDir, 'README.md' ), txt );
			}
		} catch ( err ) {
			setFailed( err.message );
		}
		try {
			const BENCHMARK_JS_FILE = readFileSync( join( PROMPTS_DIR, 'from-jsdoc', 'benchmark_js.txt' ), 'utf8' );
			const response = await openai.createCompletion({
				...OPENAI_SETTINGS,
				'prompt': BENCHMARK_JS_FILE.replace( '{{input}}', jsCode[ 1 ] )
			});
			if ( response.data && response.data.choices ) {
				const txt = LICENSE_TXT + '\n\'use strict\';\n' + ( response?.data?.choices[ 0 ].text || '' );
				writeFileSync( join( pkgDir, 'benchmark', 'benchmark.js' ), txt );
			}
		} catch ( err ) {
			setFailed( err.message );
		}
		try {
			const INDEX_JS_FILE = readFileSync( join( PROMPTS_DIR, 'from-jsdoc', 'index_js.txt' ), 'utf8' );
			const response = await openai.createCompletion({
				...OPENAI_SETTINGS,
				'prompt': INDEX_JS_FILE.replace( '{{input}}', jsCode[ 1 ] )
			});
			if ( response.data && response.data.choices ) {
				const txt = LICENSE_TXT + '\n\'use strict\';\n' + ( response?.data?.choices[ 0 ].text || '' );
				writeFileSync( join( pkgDir, 'lib', 'index.js' ), txt );
			}
		} catch ( err ) {
			setFailed( err.message );
		}
		try {
			const TEST_JS_FILE = readFileSync( join( PROMPTS_DIR, 'from-jsdoc', 'test_js.txt' ), 'utf8' );
			const response = await openai.createCompletion({
				...OPENAI_SETTINGS,
				'prompt': TEST_JS_FILE.replace( '{{input}}', jsCode[ 1 ] )
			});
			if ( response.data && response.data.choices ) {
				const txt = LICENSE_TXT + '\n\'use strict\';\n' + ( response?.data?.choices[ 0 ].text || '' );
				writeFileSync( join( pkgDir, 'test', 'test.js' ), txt );
			}
		} catch ( err ) {
			setFailed( err.message );
		}
		try {
			const REPL_TXT_FILE = readFileSync( join( PROMPTS_DIR, 'from-jsdoc', 'repl_txt.txt' ), 'utf8' );
			const response = await openai.createCompletion({
				...OPENAI_SETTINGS,
				'prompt': REPL_TXT_FILE.replace( '{{input}}', jsCode[ 1 ] )
			});
			if ( response.data && response.data.choices ) {
				const txt = response?.data?.choices[ 0 ].text || '';
				writeFileSync( join( pkgDir, 'docs', 'repl.txt' ), txt );
			}
		} catch ( err ) {
			setFailed( err.message );
		}
		let ts = '';
		try {
			const INDEX_D_TS_FILE = readFileSync( join( PROMPTS_DIR, 'from-jsdoc', 'index_d_ts.txt' ), 'utf8' );
			const response = await openai.createCompletion({
				...OPENAI_SETTINGS,
				'prompt': INDEX_D_TS_FILE.replace( '{{input}}', jsCode[ 1 ] )
			});
			if ( response.data && response.data.choices ) {
				ts = response?.data?.choices[ 0 ].text || '';
				const txt = LICENSE_TXT + '\n// TypeScript Version: 2.0\n' + ts;			
				writeFileSync( join( pkgDir, 'docs', 'types', 'index.d.ts' ), txt );
			}
		} catch ( err ) {
			setFailed( err.message );
		}
		try {
			const TEST_TS_FILE = readFileSync( join( PROMPTS_DIR, 'from-ts', 'test_ts.txt' ), 'utf8' );
			const response = await openai.createCompletion({
				...OPENAI_SETTINGS,
				'prompt': TEST_TS_FILE.replace( '{{input}}', ts )
			});
			if ( response.data && response.data.choices ) {
				let txt = response?.data?.choices[ 0 ].text || '';
				txt = LICENSE_TXT + txt;
				writeFileSync( join( pkgDir, 'docs', 'types', 'test.ts' ), txt );
			}
		} catch ( err ) {
			setFailed( err.message );
		}
		
		if ( cli ) {
			// Case: Package contains a CLI:
			try {
				const USAGE_TXT_FILE = readFileSync( join( PROMPTS_DIR, 'usage_txt.txt' ), 'utf8' );
				const response = await openai.createCompletion({
					...OPENAI_SETTINGS,
					'prompt': USAGE_TXT_FILE.replace( '{{jsdoc}}', jsCode[ 1 ] ).replace( '{{cli}}', cli )
				});
				if ( response.data && response.data.choices ) {
					const txt = response?.data?.choices[ 0 ].text || '';
					writeFileSync( join( pkgDir, 'docs', 'usage.txt' ), txt );
				}
			} catch ( err ) {
				setFailed( err.message );
			}
			try {
				const CLI_OPTS_JSON_FILE = readFileSync( join( PROMPTS_DIR, 'from-jsdoc', 'cli_opts_json.txt' ), 'utf8' );
				const response = await openai.createCompletion({
					...OPENAI_SETTINGS,
					'prompt': CLI_OPTS_JSON_FILE.replace( '{{jsdoc}}', jsCode[ 1 ] )
				});
				if ( response.data && response.data.choices ) {
					const json = response?.data?.choices[ 0 ].text || '';
					writeFileSync( join( pkgDir, 'etc', 'cli_opts.json' ), json );
				}
			} catch ( err ) {
				setFailed( err.message );
			}
			try {
				const CLI_FILE = readFileSync( join( PROMPTS_DIR, 'from-jsdoc', 'cli.txt' ), 'utf8' );
				const response = await openai.createCompletion({
					...OPENAI_SETTINGS,
					'prompt': CLI_FILE.replace( '{{jsdoc}}', jsCode[ 1 ] )
				});
				if ( response.data && response.data.choices ) {
					const txt = '#!/usr/bin/env node\n\n' + LICENSE_TXT + '\n\'use strict\';\n' + ( response?.data?.choices[ 0 ].text || '' );
					writeFileSync( join( pkgDir, 'bin', 'cli' ), txt );
				}
			} catch ( err ) {
				setFailed( err.message );
			}
			try {
				const TEST_CLI_JS_FILE = readFileSync( join( PROMPTS_DIR, 'from-jsdoc', 'test_cli_js.txt' ), 'utf8' );
				const response = await openai.createCompletion({
					'prompt': TEST_CLI_JS_FILE.replace( '{{jsdoc}}', jsCode[ 1 ] ),
					...OPENAI_SETTINGS
				});
				if ( response.data && response.data.choices ) {
					const txt = LICENSE_TXT + '\n\'use strict\';\n' + ( response?.data?.choices[ 0 ].text || '' );
					writeFileSync( join( pkgDir, 'test', 'test.cli.js' ), txt );
				}
			} catch ( err ) {
				setFailed( err.message );
			}
		}
		break;
	}
	default:
		setFailed( 'Unsupported event name: ' + context.eventName );
	}

}

main();