"use strict";var o=function(e,r){return function(){return r||e((r={exports:{}}).exports,r),r.exports}};var s=o(function(S,n){
function v(){var e=""+this.re;return this.im<0?e+=" - "+-this.im:e+=" + "+this.im,e+="i",e}n.exports=v
});var a=o(function(d,u){
function c(){var e={};return e.type="Complex128",e.re=this.re,e.im=this.im,e}u.exports=c
});var h=o(function(q,f){
var l=require('@stdlib/assert-is-number/dist').isPrimitive,m=require('@stdlib/utils-define-property/dist'),i=require('@stdlib/utils-define-nonenumerable-read-only-property/dist'),p=require('@stdlib/error-tools-fmtprodmsg/dist'),b=s(),y=a();function t(e,r){if(!(this instanceof t))throw new TypeError(p('0Gr0G'));if(!l(e))throw new TypeError(p('0Gr3e',e));if(!l(r))throw new TypeError(p('0Gr3f',r));return m(this,"re",{configurable:!1,enumerable:!0,writable:!1,value:e}),m(this,"im",{configurable:!1,enumerable:!0,writable:!1,value:r}),this}i(t,"BYTES_PER_ELEMENT",8);i(t.prototype,"BYTES_PER_ELEMENT",8);i(t.prototype,"byteLength",16);i(t.prototype,"toString",b);i(t.prototype,"toJSON",y);f.exports=t
});var E=h();module.exports=E;
/** @license Apache-2.0 */
//# sourceMappingURL=index.js.map
