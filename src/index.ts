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

import { debug, getInput, setFailed } from '@actions/core';
import { context } from '@actions/github';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { parse } from 'yaml';
import currentYear from '@stdlib/time-current-year';


// VARIABLES //

const RE_YAML = /```yaml([\s\S]+?)```/;
const RE_JS = /```js([\s\S]+?)```/;
const RE_JSDOC_COMMENT = /\/\*\*([\s\S]+?)\*\//;
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
	const openapi = getInput( 'OPENAI_API_KEY', { 
		required: true 
	});
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
		break;
	}
	default:
		setFailed( 'Unsupported event name: ' + context.eventName );
	}

}

main();