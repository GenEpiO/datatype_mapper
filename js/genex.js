"use strict";

var genex = function (regex, charset) {
  // This is a browserified snippet of https://github.com/fent/ret.js
  // (Copyright (C) 2011 by Roly Fentanes)
  var ret=(function(){var c=function(y){var n=0,j,q,g={type:d.ROOT,stack:[]},u=g,w=g.stack,f=[];var o=function(l){b.error(y,"Nothing to repeat at column "+(l-1))};var p=b.strToChars(y);j=p.length;while(n<j){q=p[n++];switch(q){case"\\":q=p[n++];switch(q){case"b":w.push(a.wordBoundary());break;case"B":w.push(a.nonWordBoundary());break;case"w":w.push(e.words());break;case"W":w.push(e.notWords());break;case"d":w.push(e.ints());break;case"D":w.push(e.notInts());break;case"s":w.push(e.whitespace());break;case"S":w.push(e.notWhitespace());break;default:if(/\d/.test(q)){w.push({type:d.REFERENCE,value:parseInt(q,10)})}else{w.push({type:d.CHAR,value:q.charCodeAt(0)})}}break;case"^":w.push(a.begin());break;case"$":w.push(a.end());break;case"[":var h;if(p[n]==="^"){h=true;n++}else{h=false}var x=b.tokenizeClass(p.slice(n),y);n+=x[1];w.push({type:d.SET,set:x[0],not:h});break;case".":w.push(e.anyChar());break;case"(":var v={type:d.GROUP,stack:[],remember:true};q=p[n];if(q==="?"){q=p[n+1];n+=2;if(q==="="){v.followedBy=true}else{if(q==="!"){v.notFollowedBy=true}else{if(q!==":"){b.error(y,"Invalid group, character '"+q+"' after '?' at column "+(n-1))}}}v.remember=false}w.push(v);f.push(u);u=v;w=v.stack;break;case")":if(f.length===0){b.error(y,"Unmatched ) at column "+(n-1))}u=f.pop();w=u.options?u.options[u.options.length-1]:u.stack;break;case"|":if(!u.options){u.options=[u.stack];delete u.stack}var s=[];u.options.push(s);w=s;break;case"{":var k=/^(\d+)(,(\d+)?)?\}/.exec(p.slice(n)),m,r;if(k!==null){m=parseInt(k[1],10);r=k[2]?k[3]?parseInt(k[3],10):Infinity:m;n+=k[0].length;w.push({type:d.REPETITION,min:m,max:r,value:w.pop()})}else{w.push({type:d.CHAR,value:123})}break;case"?":if(w.length===0){o(n)}w.push({type:d.REPETITION,min:0,max:1,value:w.pop()});break;case"+":if(w.length===0){o(n)}w.push({type:d.REPETITION,min:1,max:Infinity,value:w.pop()});break;case"*":if(w.length===0){o(n)}w.push({type:d.REPETITION,min:0,max:Infinity,value:w.pop()});break;default:w.push({type:d.CHAR,value:q.charCodeAt(0)})}}if(f.length!==0){b.error(y,"Unterminated group")}return g},d={ROOT:0,GROUP:1,POSITION:2,SET:3,RANGE:4,REPETITION:5,REFERENCE:6,CHAR:7},e=(function(){var g={};var h=function(){return[{type:d.RANGE,from:48,to:57}]};var j=function(){return[{type:d.CHAR,value:95},{type:d.RANGE,from:97,to:122},{type:d.RANGE,from:65,to:90}].concat(h())};var i=function(){return[{type:d.CHAR,value:9},{type:d.CHAR,value:10},{type:d.CHAR,value:11},{type:d.CHAR,value:12},{type:d.CHAR,value:13},{type:d.CHAR,value:32},{type:d.CHAR,value:160},{type:d.CHAR,value:5760},{type:d.CHAR,value:6158},{type:d.CHAR,value:8192},{type:d.CHAR,value:8193},{type:d.CHAR,value:8194},{type:d.CHAR,value:8195},{type:d.CHAR,value:8196},{type:d.CHAR,value:8197},{type:d.CHAR,value:8198},{type:d.CHAR,value:8199},{type:d.CHAR,value:8200},{type:d.CHAR,value:8201},{type:d.CHAR,value:8202},{type:d.CHAR,value:8232},{type:d.CHAR,value:8233},{type:d.CHAR,value:8239},{type:d.CHAR,value:8287},{type:d.CHAR,value:12288},{type:d.CHAR,value:65279}]};var f=function(){return[{type:d.CHAR,value:10},{type:d.CHAR,value:13},{type:d.CHAR,value:8232},{type:d.CHAR,value:8233}]};g.words=function(){return{type:d.SET,set:j(),not:false}};g.notWords=function(){return{type:d.SET,set:j(),not:true}};g.ints=function(){return{type:d.SET,set:h(),not:false}};g.notInts=function(){return{type:d.SET,set:h(),not:true}};g.whitespace=function(){return{type:d.SET,set:i(),not:false}};g.notWhitespace=function(){return{type:d.SET,set:i(),not:true}};g.anyChar=function(){return{type:d.SET,set:f(),not:true}};return g})(),b=(function(){var h={};var f="@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^ ?";var g={"0":0,t:9,n:10,v:11,f:12,r:13};h.strToChars=function(j){var i=/(\[\\b\])|\\(?:u([A-F0-9]{4})|x([A-F0-9]{2})|(0?[0-7]{2})|c([@A-Z\[\\\]\^?])|([0tnvfr]))/g;j=j.replace(i,function(u,q,p,r,k,n,m){var l=q?8:p?parseInt(p,16):r?parseInt(r,16):k?parseInt(k,8):n?f.indexOf(n):m?g[m]:undefined;var o=String.fromCharCode(l);if(/[\[\]{}\^$.|?*+()]/.test(o)){o="\\"+o}return o});return j};h.tokenizeClass=function(m,j){var l=[],k=/\\(?:(w)|(d)|(s)|(W)|(D)|(S))|((?:(?:\\)(.)|([^\]\\]))-(?:\\)?([^\]]))|(\])|(?:\\)?(.)/g,i,n;while((i=k.exec(m))!=null){if(i[1]){l.push(e.words())}else{if(i[2]){l.push(e.ints())}else{if(i[3]){l.push(e.whitespace())}else{if(i[4]){l.push(e.notWords())}else{if(i[5]){l.push(e.notInts())}else{if(i[6]){l.push(e.notWhitespace())}else{if(i[7]){l.push({type:d.RANGE,from:(i[8]||i[9]).charCodeAt(0),to:i[10].charCodeAt(0)})}else{if(n=i[12]){l.push({type:d.CHAR,value:n.charCodeAt(0)})}else{return[l,k.lastIndex]}}}}}}}}}h.error(j,"Unterminated character class")};h.error=function(i,j){throw new SyntaxError("Invalid regular expression: /"+i+"/: "+j)};return h})(),a={wordBoundary:function(){return{type:t.POSITION,value:"b"}},nonWordBoundary:function(){return{type:t.POSITION,value:"B"}},begin:function(){return{type:t.POSITION,value:"^"}},end:function(){return{type:t.POSITION,value:"$"}}};return c.types=d,c.sets=e,c.util=b,c.positions=a,c})();

  // replacement for _
  var _={difference:function(n,r){var e=[];return n.forEach(function(n){-1===r.indexOf(n)&&e.push(n)},this),e},intersection:function(n,r){for(var e=0,t=0,f=new Array;e<n.length&&t<r.length;)n[e]<r[t]?e++:n[e]>r[t]?t++:(f.push(n[e]),e++,t++);return f}};

  if (Object.prototype.toString.call(regex) == '[object RegExp]') {
    regex = regex.source;
  } else if (typeof regex != 'string') {
    regex = String(regex);
  }

  try {
    var tokens = ret(regex);
  } catch (exception) {
    return false;
  }

  var group = [];
  var genex = {
    charset: ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~',
    count: function () {
      function count(input) {
        var result = 0;

        if ((input.type === ret.types.ROOT) || (input.type === ret.types.GROUP)) {
          if (input.hasOwnProperty('stack')) {
            input.options = [input.stack];
          }

          input.options.forEach(function (stack) {
            var value = 1;

            stack.forEach(function (node) {
              value *= Math.max(1, count(node));
            });

            result += value;
          });
        } else if (input.type === ret.types.SET) {
          var set = [];

          input.set.forEach(function (stack) {
            if (stack.type === ret.types.SET) {
              var data = [];

              stack.set.forEach(function (node) {
                if (node.type === ret.types.RANGE) {
                  for (var i = node.from; i <= node.to; ++i) {
                    data.push(i);
                  }
                } else if (node.type === ret.types.CHAR) {
                  data.push(node.value);
                }
              });

              set = set.concat((stack.not) ? _.difference(genex.charset, data) : _.intersection(genex.charset, data));
            } else if (stack.type === ret.types.RANGE) {
              for (var i = stack.from; i <= stack.to; ++i) {
                set.push(i);
              }
            } else if (stack.type === ret.types.CHAR) {
              set.push(stack.value);
            }
          });

          result = ((input.not) ? _.difference(genex.charset, set) : _.intersection(genex.charset, set)).length;
        } else if (input.type === ret.types.REPETITION) {
          if (input.max === Infinity) {
            result = input.max;
          } else if ((input.value = count(input.value)) > 1) {
            if (input.min === input.max) {
              result = Math.pow(input.value, input.min);
            } else {
              result = (Math.pow(input.value, input.max + 1) - 1) / (input.value - 1);

              if (input.min > 0) {
                result -= (Math.pow(input.value, input.min + 0) - 1) / (input.value - 1);

                if (isNaN(result)) {
                  result = Infinity;
                }
              }
            }
          } else {
            result = input.max - input.min + 1;
          }
        } else if ((input.type === ret.types.REFERENCE) || (input.type === ret.types.CHAR)) {
          result = 1;
        }

        return Math.max(1, result);
      }

      if (Array.isArray(genex.charset) !== true) {
        genex.charset = genex.charset.split('').map(function (value) {
          return value.charCodeAt(0);
        });
      }

      return count(tokens);
    },
    generate: function (callback) {
      function generate(input) {
        if ((input.type === ret.types.ROOT) || (input.type === ret.types.GROUP)) {
          if (input.hasOwnProperty('stack')) {
            input.options = [input.stack];
          }

          input.options = input.options.map(function (stack) {
            if (stack.length === 0) {
              stack = [null];
            }

            return new Stack(stack.map(function (node) {
              return generate(node);
            }));
          });

          if (input.options.length > 1) {
            input.options = [new Option(input.options)];
          }

          input.options = input.options.shift();

          if ((input.type === ret.types.GROUP) && (input.remember)) {
            group.push(input.options);
          }

          return input.options;
        } else if (input.type === ret.types.SET) {
          var set = [];

          input.set.forEach(function (stack) {
            if (stack.type === ret.types.SET) {
              var data = [];

              stack.set.forEach(function (node) {
                if (node.type === ret.types.RANGE) {
                  for (var i = node.from; i <= node.to; ++i) {
                    data.push(i);
                  }
                } else if (node.type === ret.types.CHAR) {
                  data.push(node.value);
                }
              });

              set = set.concat((stack.not) ? _.difference(genex.charset, data) : _.intersection(genex.charset, data));
            } else if (stack.type === ret.types.RANGE) {
              for (var i = stack.from; i <= stack.to; ++i) {
                set.push(i);
              }
            } else if (stack.type === ret.types.CHAR) {
              set.push(stack.value);
            }
          });

          set = ((input.not) ? _.difference(genex.charset, set) : _.intersection(genex.charset, set)).map(function (value) {
            return String.fromCharCode(value);
          });

          if (set.length > 0) {
            return new Set(set);
          }
        } else if (input.type === ret.types.REPETITION) {
          if (input.max === 0) {
            return new Set(['']);
          }
          return new Repetition(generate(input.value), input.min, input.max);
        } else if ((input.type === ret.types.REFERENCE) && (group.hasOwnProperty(input.value - 1))) {
          return new Reference(group[input.value - 1]);
        } else if (input.type === ret.types.CHAR) {
          return new Set([String.fromCharCode(input.value)]);
        }

        return new Set(['']);
      }

      if (Array.isArray(genex.charset) !== true) {
        genex.charset = genex.charset.split('').map(function (value) {
          return value.charCodeAt(0);
        });
      }

      var iterator = generate(tokens);

      if (typeof callback === 'function') {
        iterator.forEach(function (value) {
          callback(iterator.current());
        });
      } else {
        for (iterator.rewind(); iterator.valid(); iterator.next()) {
          console.log(iterator.current());
        }
      }

      return true;
    }
  };

  return genex;
};

var Set = function (data) {
  this.i = 0;
  this.data = data;

  this.rewind = function () {
    this.i = 0;
  };

  this.valid = function () {
    return this.i < this.data.length;
  };

  this.current = function () {
    return this.data[this.i];
  };

  this.next = function () {
    ++this.i;
  };

  this.clone = function () {
    return new Set(this.data);
  };
};

var Stack = function (data) {
  if (data.length === 0) {
    data = new Set(['']);
  }

  this.data = data;

  this.rewind = function () {
    for (var i in this.data) {
      this.data[i].rewind();
    }
  };

  this.valid = function () {
    return this.data[0].valid();
  };

  this.current = function () {
    var result = '';

    for (var i in this.data) {
      result += this.data[i].current();
    }

    return result;
  };

  this.next = function () {
    if (this.valid()) {
      var i = this.data.length;

      while (this.data[--i].next(), i > 0 && !this.data[i].valid()) {
        this.data[i].rewind();
      }
    }
  };

  this.clone = function () {
    return new Stack(this.data.map(function (iterator) {
      return iterator.clone();
    }));
  };

  this.forEach = function (callback) {
    for (this.rewind(); this.valid(); this.next()) {
      callback(this.current());
    }
  };
};

var Option = function (data) {
  this.i = 0;
  this.data = data;

  this.rewind = function () {
    this.i = 0;

    for (var i in this.data) {
      this.data[i].rewind();
    }
  };

  this.valid = function () {
    return this.i < this.data.length;
  };

  this.current = function () {
    return this.data[this.i].current();
  };

  this.next = function () {
    if (this.valid()) {
      this.data[this.i].next();

      while (this.valid() && !this.data[this.i].valid()) {
        ++this.i;
      }
    }
  };

  this.clone = function () {
    return new Option(this.data.map(function (iterator) {
      return iterator.clone();
    }));
  };

  this.forEach = function (callback) {
    for (this.rewind(); this.valid(); this.next()) {
      callback(this.current());
    }
  };
};

var Reference = function (data) {
  this.i = 0;
  this.data = data;

  this.rewind = function () {
    this.i = 0;
  };

  this.valid = function () {
    return this.i < this.data.length;
  };

  this.current = function () {
    return this.data.current();
  };

  this.next = function () {
    ++this.i;
  };

  this.clone = function () {
    return new Reference(this.data);
  };
};

var Repetition = function (data, min, max) {
  var stack = [];

  for (var i = 0; i < min; ++i) {
    stack.push(data.clone());
  }

  if (max > min) {
    stack.push(new Option([new Set(['']), new Repetition(data, 1, max - min)]));
  }

  return new Stack(stack);
};

if (typeof module != 'undefined' && module.exports)
  module.exports = genex;
else
  window.genex = genex;

