Input (jsdoc):
/**
* Tests if a value is between two values.
*
* @param {*} value - value to test
* @param {*} a - left comparison value
* @param {*} b - right comparison value
* @param {string} [left="closed"] - indicates whether the left comparison value is inclusive
* @param {string} [right="closed"] - indicates whether the right comparison value is inclusive
* @throws {TypeError} `left` must be a recognized string
* @throws {TypeError} `right` must be a recognized string
* @returns {boolean} boolean indicating whether a value is between two values
*
* @example
* var bool = isBetween( 3.14, 3.0, 4.0 );
* // returns true
*
* @example
* var bool = isBetween( 4.5, 3.0, 4.0 );
* // returns false
*
* @example
* var bool = isBetween( 3.14, 3.14, 4.0 );
* // returns true
*
* @example
* var bool = isBetween( 3.14, 3.14, 4.0, 'open', 'closed' );
* // returns false
*
* @example
* var bool = isBetween( 3.14, 3.0, 3.14 );
* // returns true
*
* @example
* var bool = isBetween( 3.14, 3.0, 3.14, 'closed', 'open' );
* // returns false
*/

Output (README.md):

# isBetween

> Test if a value is between two values.

<section class="usage">

## Usage

```javascript
var isBetween = require( '@stdlib/assert/is-between' );
```

#### isBetween( value, a, b\[, left, right] )

Tests if a `value` is between two values `a` (left comparison value) and `b` (right comparison value).

```javascript
var bool = isBetween( 4, 3, 5 );
// returns true

bool = isBetween( 2, 3, 5 );
// returns false

bool = isBetween( 6, 3, 5 );
// returns false
```

By default, the function assumes that `a` and `b` are inclusive.

```javascript
var bool = isBetween( 3, 3, 5 );
// returns true

bool = isBetween( 3, 3, 5, 'closed', 'closed' );
// returns true

bool = isBetween( 5, 3, 5 );
// returns true

bool = isBetween( 5, 3, 5, 'closed', 'closed' );
// returns true
```

To make `a` and/or `b` exclusive, set the respective arguments to `'open'`.

```javascript
var bool = isBetween( 3, 3, 5, 'open', 'closed' );
// returns false

bool = isBetween( 5, 3, 5, 'closed', 'open' );
// returns false
```

</section>

<!-- /.usage -->

<section class="notes">

## Notes

-   If `a` and `b` are inclusive, the comparison is equivalent to

    ```text
    a <= v <= b
    ```

-   If `a` is exclusive and `b` is inclusive, the comparison is equivalent to

    ```text
    a < v <= b
    ```

-   If `a` is inclusive and `b` is exclusive, the comparison is equivalent to

    ```text
    a <= v < b
    ```

-   If `a` and `b` are exclusive, the comparison is equivalent to

    ```text
    a < v < b
    ```

-   If provided non-numeric values, comparisons are performed according to lexicographic order.

</section>

<!-- /.notes -->

<section class="examples">

## Examples

<!-- eslint no-undef: "error" -->

```javascript
var randu = require( '@stdlib/random/base/randu' );
var round = require( '@stdlib/math/base/special/round' );
var isBetween = require( '@stdlib/assert/is-between' );

var bool;
var a;
var b;
var v;
var i;

for ( i = 0; i < 100; i++ ) {
    a = round( (randu()*10.0) + 5.0 );
    b = round( (randu()*10.0) + 15.0 );
    v = round( randu()*25.0 );
    bool = isBetween( v, a, b, 'open', 'closed' );
    console.log( '%d < %d <= %d: %s', a, v, b, bool.toString() );
}
```

</section>

<!-- /.examples -->

<!-- Section for related `stdlib` packages. Do not manually edit this section, as it is automatically populated. -->

<section class="related">

</section>

<!-- /.related -->

<!-- Section for all links. Make sure to keep an empty line after the `section` element and another before the `/section` close. -->

<section class="links">

<!-- <related-links> -->

<!-- </related-links> -->

</section>

<!-- /.links -->

Input (jsdoc):
{{input}}

Output (README.md):