"use strict";var u=function(r,t){return function(){return t||r((t={exports:{}}).exports,t),t.exports}};var a=u(function(L,f){
var x=typeof String.prototype.trim!="undefined";f.exports=x
});var e=u(function(N,s){
var y=String.prototype.trim;s.exports=y
});var c=u(function(R,v){
var n=e(),S=" \n	\r\n\f\v\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF",o="\u180E";function b(){return n.call(S)===""&&n.call(o)===o}v.exports=b
});var p=u(function(T,l){
var d=require('@stdlib/string-base-replace/dist'),g=/^[\u0020\f\n\r\t\v\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]*([\S\s]*?)[\u0020\f\n\r\t\v\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]*$/;function I(r){return d(r,g,"$1")}l.exports=I
});var q=u(function(U,m){
var $=e();function h(r){return $.call(r)}m.exports=h
});var k=a(),A=c(),B=p(),E=q(),i;k&&A()?i=E:i=B;module.exports=i;
/** @license Apache-2.0 */
//# sourceMappingURL=index.js.map
