"use strict";var o=function(e,r){return function(){return r||e((r={exports:{}}).exports,r),r.exports}};var a=o(function(S,n){
function c(){var e=""+this.re;return this.im<0?e+=" - "+-this.im:e+=" + "+this.im,e+="i",e}n.exports=c
});var u=o(function(T,s){
function b(){var e={};return e.type="Complex64",e.re=this.re,e.im=this.im,e}s.exports=b
});var h=o(function(d,v){
var l=require('@stdlib/assert-is-number/dist').isPrimitive,m=require('@stdlib/utils-define-property/dist'),i=require('@stdlib/utils-define-nonenumerable-read-only-property/dist'),p=require('@stdlib/number-float64-base-to-float32/dist'),f=require('@stdlib/error-tools-fmtprodmsg/dist'),y=a(),E=u();function t(e,r){if(!(this instanceof t))throw new TypeError(f('0Gp0G'));if(!l(e))throw new TypeError(f('0Gp3e',e));if(!l(r))throw new TypeError(f('0Gp3f',r));return m(this,"re",{configurable:!1,enumerable:!0,writable:!1,value:p(e)}),m(this,"im",{configurable:!1,enumerable:!0,writable:!1,value:p(r)}),this}i(t,"BYTES_PER_ELEMENT",4);i(t.prototype,"BYTES_PER_ELEMENT",4);i(t.prototype,"byteLength",8);i(t.prototype,"toString",y);i(t.prototype,"toJSON",E);v.exports=t
});var w=h();module.exports=w;
/** @license Apache-2.0 */
//# sourceMappingURL=index.js.map
