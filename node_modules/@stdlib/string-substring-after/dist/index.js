"use strict";var g=function(e,r){return function(){return r||e((r={exports:{}}).exports,r),r.exports}};var s=g(function(f,a){
var u=require('@stdlib/assert-is-string/dist').isPrimitive,m=require('@stdlib/assert-is-integer/dist').isPrimitive,n=require('@stdlib/error-tools-fmtprodmsg/dist');function v(e,r,t){var i;if(!u(e))throw new TypeError(n('1Pd3F',e));if(!u(r))throw new TypeError(n('1Pd39',r));if(arguments.length>2){if(!m(t))throw new TypeError(n('1Pd2z',t));i=e.indexOf(r,t)}else i=e.indexOf(r);return i===-1?"":e.substring(i+r.length)}a.exports=v
});var l=s();module.exports=l;
/** @license Apache-2.0 */
//# sourceMappingURL=index.js.map
