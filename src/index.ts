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
import hasOwnProp from '@stdlib/assert-has-own-property';
import currentYear from '@stdlib/time-current-year';
import substringAfter from '@stdlib/string-substring-after';
import trim from '@stdlib/string-trim';
import replace from '@stdlib/string-replace';
import extractExamplesSection from './extract_examples_section';
import extractUsageSection from './extract_usage_section';
import extractCLISection from './extract_cli_section';
import extractCSection from './extract_c_section';
import { info } from 'console';


// VARIABLES //

const RE_YAML = /```yaml([\s\S]+?)```/;
const RE_JS = /```js([\s\S]+?)```/;
const RE_CLI_USAGE = /```text(\nUsage:[\s\S]+?)```/;
const RE_CLI_ALIAS = /Usage: ([a-z-]+) \[options\]/;
const RE_JSDOC = /\/\*\*[\s\S]+?\*\//;
const RE_MAIN_JSDOC = /(?:\/\/ MAIN \/\/|'use strict';)\r?\n\r?\n(\/\*\*[\s\S]*?\*\/)[\s\S]*?module\.exports = (.*?);\s*$/;
const PROMPTS_DIR = join( __dirname, '..', 'prompts' );
const SNIPPETS_DIR = join( __dirname, '..', 'snippets' );
const WAIT_TIME = 10000; // 10 seconds
const CURRENT_YEAR =  String( currentYear() );
const OPENAI_SETTINGS = {
	'model': 'code-davinci-002',
	'temperature': 0.7,
	'max_tokens': 1024,
	'top_p': 1,
	'frequency_penalty': 0,
	'presence_penalty': 0,
	'stop': [ 'Input (', 'Output (' ],
	// 'user': context.actor
};
const LICENSE_TXT = `/**
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


// FUNCTIONS //

function writeToDisk( dir: string, filename: string, data: string ): void {
	try {
		mkdirSync( dir );
	}
	catch ( err ) {
		debug( `Unable to create ${dir} directory. Error: ${err.message}.` );
	}
	// Ensure that there is a trailing newline:
	if ( data[ data.length-1 ] !== '\n' ) {
		data += '\n';
	}
	writeFileSync( join( dir, filename ), data );
}

function writePackageJSON( dir: string, pkg: string, cli?: string ): void {
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
	writeFileSync( join( dir, 'package.json' ), JSON.stringify( pkgJSON, null, 2 )+'\n' );
}

async function sleep( ms: number ): Promise<void> {
	return new Promise( resolve => setTimeout( resolve, ms ) );
}

function extractDepsFromIncludes( dependencies: Set<string>, code: string ): Set<string> {
	// Find all `#include "stdlib/...` statements and add them to the `dependencies` set:
	const RE_STDLIB_INCLUDES = /#include "stdlib\/([^"]+)\.h"/g;
	let match = RE_STDLIB_INCLUDES.exec( code );
	while ( match !== null ) {
		const include = match[ 1 ];
		dependencies.add( `"@stdlib/${replace( include, '_', '-' )}"` );
		match = RE_STDLIB_INCLUDES.exec( code );
	}
	return dependencies;
}

	
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
	const token = getInput( 'GITHUB_TOKEN' );
	const addedFiles = getInput( 'added-files' );
	const octokit = getOctokit( token );
	debug( 'Working directory: '+workDir );
	debug( 'Prompts directory: '+PROMPTS_DIR );
	
	// Bail if the action is triggered from outside of the `stdlib-js' organization:
	const org = context.repo.owner;
	if ( org !== 'stdlib-js' ) {
		return setFailed( 'Action is for internal use and must be triggered from within the `stdlib-js` organization.' );
	}
	switch ( context.eventName ) {
	case 'push':
	case 'pull_request': 
	case 'pull_request_target': {
		let files: string[];
		
		// Check whether PR was assigned to the "stdlib-bot" user:
		if ( context.eventName === 'pull_request' || context.eventName === 'pull_request_target' ) {
			if ( context.payload.pull_request.assignee.login !== 'stdlib-bot' ) {
				debug( 'PR not assigned to stdlib-bot. Skipping...' );
				return;
			}
			if ( addedFiles ) {
				files = addedFiles.split( ' ' );
			} else {
				const res = await octokit.rest.pulls.listFiles({
					'owner': context.repo.owner,
					'repo': context.repo.repo,
					'pull_number': context.payload.pull_request.number
				});
				files = res.data
					.filter( file => file.status === 'added' || file.status === 'modified' )
					.map( file => file.filename );
			}
		}
		else {
			files = addedFiles.split( ' ' );
		}
			
		// Check whether the PR contains a new package's README.md file or a modified README.md file:
		const readme = files.find( f => {
			return f.endsWith( 'README.md' );
		});
		if ( readme === void 0 ) {
			debug( 'PR does not contain a new package\'s README.md file or a modified README.md file. Skipping...' );
			return;
		}
		// Extract the directory path for the new package:
		const pkgDir = readme.replace( '/README.md', '' );
		const pkgPath = substringAfter( pkgDir, 'lib/node_modules/@stdlib/' );
		
		// Load the package's README.md file:
		const readmePath = join( workDir, readme );
		const readmeText = readFileSync( readmePath, 'utf8' );
		
		debug( 'New package directory: '+pkgDir );
		
		// Hash map of whether the PR contains package files:
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
			'lib/native.js': false,
			'test/test.js': false,
			'test/test.cli.js': false,
			'binding.gyp': false,
			'include.gypi': false,
			'src/Makefile': false,
			'src/addon.c': false,
			'package.json': false
		};
		for ( const key in has ) {
			if ( hasOwnProp( has, key ) ) {
				if ( 
					files.some( f => f.endsWith( key ) ) || // File is part of pull request...
					existsSync( join( pkgDir, key ) ) // Repository already includes respective file...
				) {
					has[ key ] = true;
				}
			}
		}
		info( 'Existing files: '+JSON.stringify( has, null, 2 ) ); 
		const usageSection = extractUsageSection( readmeText );
		const examplesSection = extractExamplesSection( readmeText );
		const cliSection = extractCLISection( readmeText );
		const cSection = extractCSection( readmeText );
		let jsdoc;
		let cli;
		if ( !has['docs/repl.txt'] ) {
			debug( 'PR does not contain a new package\'s REPL file. Scaffolding...' );
			try {
				const response = await openai.createCompletion({
					...OPENAI_SETTINGS,
					'model': 'davinci:ft-carnegie-mellon-university-2022-09-17-02-09-31',
					'prompt': usageSection + examplesSection + '\n|>|\n\n',
					'stop': [ 'END', '|>|' ]
				});
				if ( response.data && response.data.choices ) {
					const txt = ( response?.data?.choices[ 0 ].text || '' ) + SEE_ALSO;
					writeToDisk( join( pkgDir, 'docs' ), 'repl.txt', txt );
				}
			} catch ( err ) {
				debug( err );
				setFailed( err.message );
			}
			await sleep( WAIT_TIME );
		}
		if ( !has['lib/index.js'] ) {
			debug( 'PR does not contain a new package\'s index file. Scaffolding...' );
			try {
				const response = await openai.createCompletion({
					...OPENAI_SETTINGS,
					'model': 'davinci:ft-carnegie-mellon-university:readme-to-index-2022-10-04-19-00-45',
					'prompt': usageSection + '\n|>|\n\n',
					'stop': [ 'END', '|>|' ]
				});
				if ( response.data && response.data.choices ) {
					const txt = LICENSE_TXT + '\n\'use strict\';\n' + ( response?.data?.choices[ 0 ].text || '' );
					writeToDisk( join( pkgDir, 'lib' ), 'index.js', txt );
				}
			} catch ( err ) {
				debug( err );
				setFailed( err.message );
			}
			await sleep( WAIT_TIME );
		}
		if ( !has['lib/main.js'] ) {
			debug( 'PR does not contain a new package\'s main file. Scaffolding...' );
			try {
				const PROMPT = readFileSync( join( PROMPTS_DIR, 'from-readme', 'main_js.txt' ), 'utf8' )
					.replace( '{{input}}', usageSection );
				debug( 'Prompt: '+PROMPT );
				const response = await openai.createCompletion({
					...OPENAI_SETTINGS,
					'prompt': PROMPT
				});
				if ( response.data && response.data.choices ) {
					let txt = response?.data?.choices[ 0 ].text || '';
					jsdoc = RE_JSDOC.exec( txt );
					txt = LICENSE_TXT + '\n\'use strict\';\n' + txt;
					writeToDisk( join( pkgDir, 'lib' ), 'main.js', txt );
				}
			} catch ( err ) {
				debug( err );
				setFailed( err.message );
			}
			await sleep( WAIT_TIME );
		}
		if ( jsdoc ) {
			if ( !has['benchmark/benchmark.js'] ) {
				try {
					const PROMPT = readFileSync( join( PROMPTS_DIR, 'from-jsdoc', 'benchmark_js.txt' ), 'utf8' )
						.replace( '{{input}}', jsdoc[ 0 ] );
					const response = await openai.createCompletion({
						...OPENAI_SETTINGS,
						'prompt': PROMPT
					});
					if ( response.data && response.data.choices ) {
						const txt = LICENSE_TXT + '\n\'use strict\';\n' + ( response?.data?.choices[ 0 ].text || '' );
						writeToDisk( join( pkgDir, 'benchmark' ), 'benchmark.js', txt );
					}
				} catch ( err ) {
					setFailed( err.message );
				}
				await sleep( WAIT_TIME );
			}
			let ts = '';
			if ( !has['docs/types/index.d.ts'] ) {
				try {
					const PROMPT = readFileSync( join( PROMPTS_DIR, 'from-jsdoc', 'index_d_ts.txt' ), 'utf8' )
						.replace( '{{input}}', jsdoc[ 0 ] );
					const response = await openai.createCompletion({
						...OPENAI_SETTINGS,
						'prompt': PROMPT
					});
					if ( response.data && response.data.choices ) {
						ts = response?.data?.choices[ 0 ].text || '';
						const txt = LICENSE_TXT + '\n// TypeScript Version: 2.0\n' + ts;			
						writeToDisk( join( pkgDir, 'docs', 'types' ), 'index.d.ts', txt );
					}
				} catch ( err ) {
					setFailed( err.message );
				}
				await sleep( WAIT_TIME );
			}
			if ( !has['docs/types/test.ts'] ) {
				try {
					const PROMPT = readFileSync( join( PROMPTS_DIR, 'from-ts', 'test_ts.txt' ), 'utf8' )
						.replace( '{{input}}', ts );
					const response = await openai.createCompletion({
						...OPENAI_SETTINGS,
						'prompt': PROMPT
					});
					if ( response.data && response.data.choices ) {
						let txt = response?.data?.choices[ 0 ].text || '';
						txt = LICENSE_TXT + txt;
						writeToDisk( join( pkgDir, 'docs', 'types' ), 'test.ts', txt );
					}
				} catch ( err ) {
					setFailed( err.message );
				}
				await sleep( WAIT_TIME );
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
					writeToDisk( join( pkgDir, 'examples' ), 'index.js', txt );
				}
			} catch ( err ) {
				debug( err );
				setFailed( err.message );
			}
			await sleep( WAIT_TIME );
		}	
		if ( !has['test/test.js'] ) {
			try {
				const PROMPT = readFileSync( join( PROMPTS_DIR, 'from-readme', 'test_js.txt' ), 'utf8' )
					.replace( '{{input}}', usageSection );
				const response = await openai.createCompletion({
					...OPENAI_SETTINGS,
					'prompt': PROMPT
				});
				if ( response.data && response.data.choices ) {
					const txt = LICENSE_TXT + '\n\'use strict\';\n' + ( response?.data?.choices[ 0 ].text || '' );
					writeToDisk( join( pkgDir, 'test' ), 'test.js', txt );
				}
			} catch ( err ) {
				setFailed( err.message );
			}
			await sleep( WAIT_TIME );
		}
		if ( cliSection ) {
			cli = RE_CLI_ALIAS.exec( cliSection );
			if ( !has[ 'bin/cli' ] ) {
				const PROMPT = readFileSync( join( PROMPTS_DIR, 'from-readme', 'cli.txt' ), 'utf8' )
					.replace( '{{input}}', cliSection );
				debug( 'Prompt: '+PROMPT );
				const response = await openai.createCompletion({
					...OPENAI_SETTINGS,
					'prompt': PROMPT
				});
				if ( response.data && response.data.choices ) {
					const txt = '#!/usr/bin/env node\n\n' + LICENSE_TXT + '\n\'use strict\';\n\n' + ( response?.data?.choices[ 0 ].text || '' );
					writeToDisk( join( pkgDir, 'bin' ), 'cli', txt );
				}
				await sleep( WAIT_TIME );
			}
			if ( !has[ 'docs/usage.txt' ] ) {
				const matches = RE_CLI_USAGE.exec( cliSection );
				if ( matches ) {
					const txt = matches[ 1 ] + '\n';
					writeToDisk( join( pkgDir, 'docs' ), 'usage.txt', txt );
				}
				await sleep( WAIT_TIME );
			}
			if ( !has[ 'etc/cli_opts.json' ] ) {
				const response = await openai.createCompletion({
					...OPENAI_SETTINGS,
					'model': 'davinci:ft-carnegie-mellon-university:readme-cli-to-opts-2022-10-04-21-04-27',
					'prompt': cliSection + '\n|>|\n\n',
					'stop': [ 'END', '|>|' ]
				});
				if ( response.data && response.data.choices ) {
					const txt = trim( response?.data?.choices[ 0 ].text || '' ) + '\n';
					writeToDisk( join( pkgDir, 'etc' ), 'cli_opts.json', txt );
				}
				await sleep( WAIT_TIME );
			}
			if ( !has[ 'test/test.cli.js' ] ) {
				const PROMPT = readFileSync( join( PROMPTS_DIR, 'from-readme', 'test_cli_js.txt' ), 'utf8' )
					.replace( '{{input}}', cliSection );
				debug( 'Prompt: '+PROMPT );
				const response = await openai.createCompletion({
					...OPENAI_SETTINGS,
					'max_tokens': OPENAI_SETTINGS.max_tokens * 4,
					'prompt': PROMPT
				});
				if ( response.data && response.data.choices ) {
					const txt =  LICENSE_TXT + '\n\'use strict\';\n' + ( response?.data?.choices[ 0 ].text || '' );
					writeToDisk( join( pkgDir, 'test' ), 'test.cli.js', txt );
				}
				await sleep( WAIT_TIME );
			}
			let stdinErrorFixture = readFileSync( join( SNIPPETS_DIR, 'test', 'fixtures', 'stdin_error_js_txt.txt' ), 'utf8' );
			stdinErrorFixture = stdinErrorFixture.replace( '{{year}}', CURRENT_YEAR );
			writeToDisk( join( pkgDir, 'test', 'fixtures' ), 'stdin_error.js.txt', stdinErrorFixture );
		}
		if ( cSection ) {
			if ( !has[ 'src/Makefile' ] ) {
				let makefile = readFileSync( join( SNIPPETS_DIR, 'src', 'Makefile.txt' ), 'utf8' );
				makefile = makefile.replace( '{{year}}', CURRENT_YEAR );
				writeToDisk( join( pkgDir, 'src' ), 'Makefile', makefile );
			}
			if ( !has[ 'binding.gyp' ] ) {
				let bindingGyp = readFileSync( join( SNIPPETS_DIR, 'binding_gyp.txt' ), 'utf8' );
				bindingGyp = bindingGyp.replace( '{{year}}', CURRENT_YEAR );
				writeToDisk( pkgDir, 'binding.gyp', bindingGyp );
			}
			if ( !has[ 'include.gypi' ] ) {
				let includeGypi = readFileSync( join( SNIPPETS_DIR, 'include_gypi.txt' ), 'utf8' );
				includeGypi = includeGypi.replace( '{{year}}', CURRENT_YEAR );
				writeToDisk( pkgDir, 'include.gypi', includeGypi );	
			}
			const main = readFileSync( join( pkgDir, 'lib', 'main.js' ), 'utf8' );
			info( 'main: '+main );
			const jsdocMatch = main.match( RE_MAIN_JSDOC );
			const RE_EXPORT_NAME = /module\.exports = ([^;]+);/;
			const aliasMatch = main.match( RE_EXPORT_NAME );
			debug( 'Package alias: '+aliasMatch[ 1 ] );
			
			if ( !has[ 'lib/native.js' ] ) {
				let native = readFileSync( join( SNIPPETS_DIR, 'lib', 'native_js.txt' ), 'utf8' );
				native = native.replace( '{{year}}', CURRENT_YEAR );
				native = replace( native, '{{jsdoc}}', jsdocMatch[ 1 ] );
				native = replace( native, '{{alias}}', aliasMatch[ 1 ] );
				const reParams = new RegExp( 'function '+aliasMatch[ 1 ]+'\\(([^)]+)\\)', 'm' );
				const paramsMatch = main.match( reParams );
				
				debug( 'Function parameters: '+paramsMatch[ 1 ] );
				native = replace( native, '{{params}}', paramsMatch[ 1 ] );
				writeToDisk( join( pkgDir, 'lib' ), 'native.js', native );
			}
			
			const includePath =  join( pkgDir, 'include', 'stdlib', pkgPath );
			if ( !existsSync( includePath ) ) {
				mkdirSync( includePath, {
					'recursive': true
				});
			}			
			const code = substringAfter( main, '\'use strict\';' );
			const dependencies: Set<string> = new Set();
			if ( !has[ 'src/addon.c' ] ) {
				try {
					const addon = readFileSync( join( PROMPTS_DIR, 'js-to-c', 'addon_c.txt' ), 'utf8' );
					const response = await openai.createCompletion({
						...OPENAI_SETTINGS,
						'prompt': addon.replace( '{{input}}', code )
					});
					if ( response.data && response.data.choices ) {
						const txt = LICENSE_TXT + ( response?.data?.choices[ 0 ].text || '' );
						extractDepsFromIncludes( dependencies, txt );
						writeToDisk( join( pkgDir, 'src' ), 'addon.c', txt );
					}
				} catch ( err ) {
					setFailed( err.message );
				}
			}
			if ( !existsSync( join( pkgDir, 'src', aliasMatch[ 1 ], '.c' ) ) ) {
				try {
					const addon = readFileSync( join( PROMPTS_DIR, 'js-to-c', 'main_c.txt' ), 'utf8' );
					const response = await openai.createCompletion({
						...OPENAI_SETTINGS,
						'prompt': addon.replace( '{{input}}', code )
					});
					if ( response.data && response.data.choices ) {
						const txt = LICENSE_TXT + ( response?.data?.choices[ 0 ].text || '' );
						extractDepsFromIncludes( dependencies, txt );
						writeToDisk( join( pkgDir, 'src' ), aliasMatch[ 1 ] +'.c', txt );
					}
				} catch ( err ) {
					setFailed( err.message );
				}
			}
			if ( !existsSync( join( pkgDir, 'src', aliasMatch[ 1 ], '.h' ) ) ) {
				try {
					const addon = readFileSync( join( PROMPTS_DIR, 'js-to-c', 'main_h.txt' ), 'utf8' );
					const response = await openai.createCompletion({
						...OPENAI_SETTINGS,
						'prompt': addon.replace( '{{input}}', code )
					});
					if ( response.data && response.data.choices ) {
						const txt = LICENSE_TXT + ( response?.data?.choices[ 0 ].text || '' );
						writeToDisk( join( pkgDir, 'include', 'stdlib', pkgPath ), aliasMatch[ 1 ] +'.h', txt );
					}
				} catch ( err ) {
					setFailed( err.message );
				}
			}
			if ( !has[ 'manifest.json' ] ) {
				let manifest =  readFileSync( join( SNIPPETS_DIR, 'manifest_json.txt' ), 'utf8' );
				manifest = replace( manifest, '{{dependencies}}',  Array.from( dependencies ).join( '\n,\t\t\t\t' ) );
				manifest = replace( manifest, '{{src}}', '"./src/'+aliasMatch[ 1 ]+'.c"' );
				writeToDisk( pkgDir, 'manifest.json', manifest );
			}
		}
		if ( !has[ 'package.json' ] ) {
			writePackageJSON( pkgDir, pkgPath, cli ? cli[ 1 ] : null );
		}
		setOutput( 'dir', pkgDir );	
		setOutput( 'path', pkgPath );
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
		
		writePackageJSON( pkgDir, path, cli );
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
				writeToDisk( join( pkgDir, 'examples' ), 'index.js', txt );
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
				writeToDisk( pkgDir, 'README.md', txt );
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
				writeToDisk( join( pkgDir, 'benchmark' ), 'benchmark.js', txt );
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
				writeToDisk( join( pkgDir, 'lib' ), 'index.js', txt );
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
				writeToDisk( join( pkgDir, 'test' ), 'test.js', txt );
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
				writeToDisk( join( pkgDir, 'docs' ), 'repl.txt', txt );
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
				writeToDisk( join( pkgDir, 'docs', 'types' ), 'index.d.ts', txt );
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
				writeToDisk( join( pkgDir, 'docs', 'types' ), 'test.ts', txt );
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
					writeToDisk( join( pkgDir, 'docs' ), 'usage.txt', txt );
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
					writeToDisk( join( pkgDir, 'etc' ), 'cli_opts.json', json );
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
					const txt = '#!/usr/bin/env node\n\n' + LICENSE_TXT + '\n\'use strict\';\n\n' + ( response?.data?.choices[ 0 ].text || '' );
					writeToDisk( join( pkgDir, 'bin' ), 'cli', txt );
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
					writeToDisk( join( pkgDir, 'test' ), 'test.cli.js', txt );
				}
			} catch ( err ) {
				setFailed( err.message );
			}
		}
		break;
	}
	case 'workflow_dispatch': {
		// Case: Workflow was manually triggered:
		const pkgPath = getInput( 'pkg', { required: true });
		const actionType = getInput( 'type', { required: true });
		const pkgDir = join( workDir, 'lib', 'node_modules', '@stdlib', pkgPath );
		
		if ( actionType === 'native-addon' ) {
			let makefile = readFileSync( join( SNIPPETS_DIR, 'src', 'Makefile.txt' ), 'utf8' );
			makefile = makefile.replace( '{{year}}', CURRENT_YEAR );
			writeToDisk( join( pkgDir, 'src' ), 'Makefile', makefile );
			
			let bindingGyp = readFileSync( join( SNIPPETS_DIR, 'binding_gyp.txt' ), 'utf8' );
			bindingGyp = bindingGyp.replace( '{{year}}', CURRENT_YEAR );
			writeToDisk( pkgDir, 'binding.gyp', bindingGyp );
			
			let includeGypi = readFileSync( join( SNIPPETS_DIR, 'include_gypi.txt' ), 'utf8' );
			includeGypi = includeGypi.replace( '{{year}}', CURRENT_YEAR );
			writeToDisk( pkgDir, 'include.gypi', includeGypi );
		
			const main = readFileSync( join( pkgDir, 'lib', 'main.js' ), 'utf8' );
			const jsdocMatch = main.match( RE_MAIN_JSDOC );
			const RE_EXPORT_NAME = /module\.exports = ([^;]+);/;
			const aliasMatch = main.match( RE_EXPORT_NAME );
			debug( 'Package alias: '+aliasMatch[ 1 ] );
			
			mkdirSync( join( pkgDir, 'src' ) );
			mkdirSync( join( pkgDir, 'include', 'stdlib', pkgPath ), {
				'recursive': true
			});
				
			let native = readFileSync( join( SNIPPETS_DIR, 'lib', 'native_js.txt' ), 'utf8' );
			native = native.replace( '{{year}}', CURRENT_YEAR );
			native = replace( native, '{{jsdoc}}', jsdocMatch[ 1 ] );
			native = replace( native, '{{alias}}', aliasMatch[ 1 ] );
			const reParams = new RegExp( 'function '+aliasMatch[ 1 ]+'\\(([^)]+)\\)', 'm' );
			const paramsMatch = main.match( reParams );
			
			debug( 'Function parameters: '+paramsMatch[ 1 ] );
			native = replace( native, '{{params}}', paramsMatch[ 1 ] );
			writeToDisk( join( pkgDir, 'lib' ), 'native.js', native );
						
			const code = substringAfter( main, '\'use strict\';' );
			const dependencies: Set<string> = new Set();
			try {
				const addon = readFileSync( join( PROMPTS_DIR, 'js-to-c', 'addon_c.txt' ), 'utf8' );
				const response = await openai.createCompletion({
					...OPENAI_SETTINGS,
					'prompt': addon.replace( '{{input}}', code )
				});
				if ( response.data && response.data.choices ) {
					const txt = LICENSE_TXT + ( response?.data?.choices[ 0 ].text || '' );
					extractDepsFromIncludes( dependencies, txt );
					writeToDisk( join( pkgDir, 'src' ), 'addon.c', txt );
				}
			} catch ( err ) {
				setFailed( err.message );
			}
			try {
				const addon = readFileSync( join( PROMPTS_DIR, 'js-to-c', 'main_c.txt' ), 'utf8' );
				const response = await openai.createCompletion({
					...OPENAI_SETTINGS,
					'prompt': addon.replace( '{{input}}', code )
				});
				if ( response.data && response.data.choices ) {
					const txt = LICENSE_TXT + ( response?.data?.choices[ 0 ].text || '' );
					extractDepsFromIncludes( dependencies, txt );
					writeToDisk( join( pkgDir, 'src' ), aliasMatch[ 1 ] +'.c', txt );
				}
			} catch ( err ) {
				setFailed( err.message );
			}
			try {
				const addon = readFileSync( join( PROMPTS_DIR, 'js-to-c', 'main_h.txt' ), 'utf8' );
				const response = await openai.createCompletion({
					...OPENAI_SETTINGS,
					'prompt': addon.replace( '{{input}}', code )
				});
				if ( response.data && response.data.choices ) {
					const txt = LICENSE_TXT + ( response?.data?.choices[ 0 ].text || '' );
					writeToDisk( join( pkgDir, 'include', 'stdlib', pkgPath ), aliasMatch[ 1 ] +'.h', txt );
				}
			} catch ( err ) {
				setFailed( err.message );
			}
			let manifest =  readFileSync( join( SNIPPETS_DIR, 'manifest_json.txt' ), 'utf8' );
			manifest = replace( manifest, '{{dependencies}}',  Array.from( dependencies ).join( '\n,\t\t\t\t' ) );
			manifest = replace( manifest, '{{src}}', '"./src/'+aliasMatch[ 1 ]+'.c"' );
			writeToDisk( pkgDir, 'manifest.json', manifest );
		}
		break;	
	}
	default:
		setFailed( 'Unsupported event name: ' + context.eventName );
	}

}

main();