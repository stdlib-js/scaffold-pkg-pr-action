"use strict";var c=function(e,r){return function(){return r||e((r={exports:{}}).exports,r),r.exports}};var u=c(function(g,i){
var v=require('@stdlib/string-base-uppercase/dist'),a=require('@stdlib/string-base-replace/dist'),E=require('@stdlib/string-base-trim/dist'),n=/\s+/g,p=/[\-!"'(),–.:;<>?`{}|~\/\\\[\]_#$*&^@%]+/g,_=/([a-z0-9])([A-Z])/g;function o(e){return e=a(e,p," "),e=a(e,_,"$1 $2"),e=E(e),e=a(e,n,"_"),v(e)}i.exports=o
});var q=u();module.exports=q;
/** @license Apache-2.0 */
//# sourceMappingURL=index.js.map
