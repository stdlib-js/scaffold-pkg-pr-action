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
import { context } from '@actions/github';
import { join } from 'path';
import { Configuration, OpenAIApi } from 'openai';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { parse } from 'yaml';
import currentYear from '@stdlib/time-current-year';


// VARIABLES //

const RE_YAML = /```yaml([\s\S]+?)```/;
const RE_JS = /```js([\s\S]+?)```/;
const PROMPTS_DIR = join( __dirname, '..', 'prompts' );
const OPENAI_SETTINGS = {
	'model': 'code-davinci-002',
	'temperature': 0.7,
	'max_tokens': 2048,
	'top_p': 1,
	'frequency_penalty': 0,
	'presence_penalty': 0,
	'stop': [ 'Input (ts):', 'Input (jsdoc):', 'Input (README.md):' ]
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
		setOutput( 'path', path );
		setOutput( 'alias', alias );
		
		const jsCode = RE_JS.exec( context.payload.comment.body );
		if ( jsCode === null ) {
			debug( 'No JS code block found.' );
			return;
		}
		debug( 'Found a JS code block...' );
		try {
			const EXAMPLES_JS_FILE = readFileSync( join( PROMPTS_DIR, 'examples_js.txt' ), 'utf8' );
			const prompt = EXAMPLES_JS_FILE.replace( '{{input}}', jsCode[ 1 ] );
			debug( 'Prompt: '+prompt );
			const response = await openai.createCompletion({
				'prompt': prompt,
				...OPENAI_SETTINGS
			});
			if ( response.data && response.data.choices ) {
				const txt = LICENSE_TXT + '\n\'use strict\';\n' + ( response?.data?.choices[ 0 ].text || '' ) + '\n';
				writeFileSync( join( pkgDir, 'examples', 'index.js' ), txt );
			}
		} catch ( err ) {
			setFailed( err.message );
		}
		try {
			const README_MD_FILE = readFileSync( join( PROMPTS_DIR, 'readme_md.txt' ), 'utf8' );
			const response = await openai.createCompletion({
				'prompt': README_MD_FILE.replace( '{{input}}', jsCode[ 1 ] ),
				...OPENAI_SETTINGS
			});
			if ( response.data && response.data.choices ) {
				const txt = README_LICENSE + ( response?.data?.choices[ 0 ].text || '' );
				writeFileSync( join( pkgDir, 'README.md' ), txt );
			}
		} catch ( err ) {
			setFailed( err.message );
		}
		try {
			const BENCHMARK_JS_FILE = readFileSync( join( PROMPTS_DIR, 'benchmark_js.txt' ), 'utf8' );
			const response = await openai.createCompletion({
				'prompt': BENCHMARK_JS_FILE.replace( '{{input}}', jsCode[ 1 ] ),
				...OPENAI_SETTINGS
			});
			if ( response.data && response.data.choices ) {
				const txt = LICENSE_TXT + '\'use strict\';\n\n' + ( response?.data?.choices[ 0 ].text || '' );
				writeFileSync( join( pkgDir, 'benchmark', 'benchmark.js' ), txt );
			}
		} catch ( err ) {
			setFailed( err.message );
		}
		try {
			const INDEX_JS_FILE = readFileSync( join( PROMPTS_DIR, 'index_js.txt' ), 'utf8' );
			const response = await openai.createCompletion({
				'prompt': INDEX_JS_FILE.replace( '{{input}}', jsCode[ 1 ] ),
				...OPENAI_SETTINGS
			});
			if ( response.data && response.data.choices ) {
				const txt = LICENSE_TXT + '\'use strict\';\n\n' + ( response?.data?.choices[ 0 ].text || '' );
				writeFileSync( join( pkgDir, 'lib', 'index.js' ), txt );
			}
		} catch ( err ) {
			setFailed( err.message );
		}
		try {
			const TEST_JS_FILE = readFileSync( join( PROMPTS_DIR, 'test_js.txt' ), 'utf8' );
			const response = await openai.createCompletion({
				'prompt': TEST_JS_FILE.replace( '{{input}}', jsCode[ 1 ] ),
				...OPENAI_SETTINGS
			});
			if ( response.data && response.data.choices ) {
				const txt = LICENSE_TXT + '\'use strict\';\n\n' + ( response?.data?.choices[ 0 ].text || '' );
				writeFileSync( join( pkgDir, 'test', 'test.js' ), txt );
			}
		} catch ( err ) {
			setFailed( err.message );
		}
		try {
			const REPL_TXT_FILE = readFileSync( join( PROMPTS_DIR, 'repl_txt.txt' ), 'utf8' );
			const response = await openai.createCompletion({
				'prompt': REPL_TXT_FILE.replace( '{{input}}', jsCode[ 1 ] ),
				...OPENAI_SETTINGS
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
			const INDEX_D_TS_FILE = readFileSync( join( PROMPTS_DIR, 'index_d_ts.txt' ), 'utf8' );
			const response = await openai.createCompletion({
				'prompt': INDEX_D_TS_FILE.replace( '{{input}}', jsCode[ 1 ] ),
				...OPENAI_SETTINGS
			});
			if ( response.data && response.data.choices ) {
				ts = response?.data?.choices[ 0 ].text || '';
				const txt = LICENSE_TXT + '// TypeScript Version: 2.0\n' + ts;			
				writeFileSync( join( pkgDir, 'docs', 'types', 'index.d.ts' ), txt );
			}
		} catch ( err ) {
			setFailed( err.message );
		}
		try {
			const TEST_TS_FILE = readFileSync( join( PROMPTS_DIR, 'test_ts.txt' ), 'utf8' );
			const response = await openai.createCompletion({
				'prompt': TEST_TS_FILE.replace( '{{input}}', ts ),
				...OPENAI_SETTINGS
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
					'prompt': USAGE_TXT_FILE.replace( '{{input}}', jsCode[ 1 ] ).replace( '{{cli}}', cli ),
					...OPENAI_SETTINGS
				});
				if ( response.data && response.data.choices ) {
					const txt = response?.data?.choices[ 0 ].text || '';
					writeFileSync( join( pkgDir, 'docs', 'usage.txt' ), txt );
				}
			} catch ( err ) {
				setFailed( err.message );
			}
			try {
				const CLI_OPTS_JSON_FILE = readFileSync( join( PROMPTS_DIR, 'cli_opts_json.txt' ), 'utf8' );
				const response = await openai.createCompletion({
					'prompt': CLI_OPTS_JSON_FILE.replace( '{{jsdoc}}', jsCode[ 1 ] ),
					...OPENAI_SETTINGS
				});
				if ( response.data && response.data.choices ) {
					const json = response?.data?.choices[ 0 ].text || '';
					writeFileSync( join( pkgDir, 'etc', 'cli_opts.json' ), json );
				}
			} catch ( err ) {
				setFailed( err.message );
			}
			try {
				const CLI_FILE = readFileSync( join( PROMPTS_DIR, 'cli.txt' ), 'utf8' );
				const response = await openai.createCompletion({
					'prompt': CLI_FILE.replace( '{{input}}', jsCode[ 1 ] ),
					...OPENAI_SETTINGS
				});
				if ( response.data && response.data.choices ) {
					const txt = LICENSE_TXT + '\'use strict\';\n\n' + ( response?.data?.choices[ 0 ].text || '' );
					writeFileSync( join( pkgDir, 'bin', 'cli' ), txt );
				}
			} catch ( err ) {
				setFailed( err.message );
			}
			try {
				const TEST_CLI_JS_FILE = readFileSync( join( PROMPTS_DIR, 'test_cli_js.txt' ), 'utf8' );
				const response = await openai.createCompletion({
					'prompt': TEST_CLI_JS_FILE.replace( '{{input}}', jsCode[ 1 ] ),
					...OPENAI_SETTINGS
				});
				if ( response.data && response.data.choices ) {
					const txt = LICENSE_TXT + '\'use strict\';\n\n' + ( response?.data?.choices[ 0 ].text || '' );
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