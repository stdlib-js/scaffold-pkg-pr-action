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
// MODULES //
// VARIABLES //
const RE_EXAMPLES_SECTION = /<section class="examples">([\s\S]+?)<!-- \/\.examples -->/;
// MAIN //
function extractExamplesSection(readme) {
    const match = RE_EXAMPLES_SECTION.exec(readme);
    if (match === null) {
        return '';
    }
    let txt = match[1];
    // Replace Windows line endings with Unix line endings:
    txt = txt.replace(/\r\n/g, '\n');
    // Remove any HTML comments:
    txt = txt.replace(/<!--([\s\S]*?)-->/g, '');
    // Remove any closing </section> tags:
    txt = txt.replace(/<\/section>/g, '');
    // Remove any opening <section class=""> tags:
    txt = txt.replace(/<section class="[^"]+">/g, '');
    // Remove multiple newlines (Unix):
    txt = txt.replace(/(\n)+/g, '\n');
    return txt;
}
module.exports = extractExamplesSection;
//# sourceMappingURL=extract_examples_section.js.map