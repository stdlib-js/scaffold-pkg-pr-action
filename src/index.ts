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
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { parse } from 'yaml';
import currentYear from '@stdlib/time-current-year';


// VARIABLES //

const RE_YAML = /```yaml([\s\S]+?)```/;
const RE_JS = /```js([\s\S]+?)```/;
const PROMPTS_DIR = join( __dirname, '..', 'prompts' );
const EXAMPLES_JS_FILE = join( PROMPTS_DIR, 'examples_js.txt' );
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
			const response = await openai.createCompletion({
				'prompt': EXAMPLES_JS_FILE.replace( '{{input}}', jsCode[ 1 ] ),
				...OPENAI_SETTINGS
			});
			if ( response.data && response.data.choices ) {
				const txt = LICENSE_TXT + '\n\'use strict\';\n' + ( response?.data?.choices[ 0 ].text || '' );
				writeFileSync( join( pkgDir, 'examples', 'index.js' ), txt );
			}
		} catch ( err ) {
			setFailed( err.message );
		}
		break;
	}
	default:
		setFailed( 'Unsupported event name: ' + context.eventName );
	}

}

main();