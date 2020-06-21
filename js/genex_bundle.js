(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function difference(a, b) {
    return [a, b].reduce((a, b) => {
        return a.filter((c) => {
            return b.includes(c) !== true;
        });
    });
}
exports.difference = difference;
;

},{}],2:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function distinct(data) {
    return [...new Set(data.map((value) => JSON.stringify(value)))].map((value) => {
        return JSON.parse(value);
    });
}
exports.distinct = distinct;

},{}],3:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function intersection(a, b) {
    return [a, b].reduce((a, b) => {
        return a.filter((c) => {
            return b.includes(c) === true;
        });
    });
}
exports.intersection = intersection;

},{}],4:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const ret_1 = __importDefault(require("ret"));
const difference_1 = require("./helpers/difference");
const distinct_1 = require("./helpers/distinct");
const intersection_1 = require("./helpers/intersection");
const Literal_1 = require("./iterators/Literal");
const Option_1 = require("./iterators/Option");
const Reference_1 = require("./iterators/Reference");
const Repetition_1 = require("./iterators/Repetition");
const Stack_1 = require("./iterators/Stack");
class Genex {
    constructor(regex, charset) {
        this.tokens = null;
        if (regex instanceof RegExp) {
            regex = regex.source;
        }
        if (/[(][?]</.test(regex) === true) {
            throw new Error(`Unsupported lookbehind assertion.`);
        }
        if (charset == null) {
            charset = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';
        }
        this.tokens = ret_1.default(regex);
        this.charset = charset.split('').map((value) => value.charCodeAt(0));
    }
    count() {
        let groups = 0;
        const counter = (tokens) => {
            let result = 0;
            if (tokens.type === ret_1.default.types.ROOT || tokens.type === ret_1.default.types.GROUP) {
                if (tokens.hasOwnProperty('options') !== true) {
                    tokens.options = [tokens.stack];
                }
                tokens.options = distinct_1.distinct(tokens.options.map((stack) => {
                    return stack.filter((value) => value.hasOwnProperty('notFollowedBy') !== true);
                }));
                for (let stack of tokens.options) {
                    let value = 1;
                    for (let node of stack) {
                        value *= counter(node);
                    }
                    result += value;
                }
                if (tokens.type === ret_1.default.types.GROUP && tokens.remember === true) {
                    ++groups;
                }
            }
            else if (tokens.type === ret_1.default.types.POSITION) {
                if (['B', '^', '$'].includes(tokens.value) === true) {
                    result = 1;
                }
            }
            else if (tokens.type === ret_1.default.types.SET) {
                let set = [];
                for (let stack of tokens.set) {
                    if (stack.type === ret_1.default.types.SET) {
                        let data = [];
                        for (let node of stack.set) {
                            if (node.type === ret_1.default.types.RANGE) {
                                for (let i = node.from; i <= node.to; ++i) {
                                    data.push(i);
                                }
                            }
                            else if (node.type === ret_1.default.types.CHAR) {
                                data.push(node.value);
                            }
                        }
                        set = set.concat(stack.not ? difference_1.difference(this.charset, data) : intersection_1.intersection(this.charset, data));
                    }
                    else if (stack.type === ret_1.default.types.RANGE) {
                        for (let i = stack.from; i <= stack.to; ++i) {
                            set.push(i);
                        }
                    }
                    else if (stack.type === ret_1.default.types.CHAR) {
                        set.push(stack.value);
                    }
                }
                result = (tokens.not === true ? difference_1.difference(this.charset, set) : intersection_1.intersection(this.charset, set)).length;
            }
            else if (tokens.type === ret_1.default.types.REPETITION) {
                if (tokens.type === ret_1.default.types.REPETITION && tokens.min === 0 && tokens.max === 1) {
                    if (tokens.value.type === ret_1.default.types.REPETITION) {
                        tokens = tokens.value;
                    }
                }
                let count = counter(tokens.value);
                if (tokens.max === null) {
                    return Infinity;
                }
                if (count === 1) {
                    return tokens.max - tokens.min + 1;
                }
                result = (Math.pow(count, tokens.max + 1) - 1) / (count - 1);
                if (tokens.min > 0) {
                    result -= (Math.pow(count, tokens.min + 0) - 1) / (count - 1);
                }
            }
            else if (tokens.type === ret_1.default.types.REFERENCE) {
                if (tokens.value > groups) {
                    throw new Error(`Reference to non-existent capture group.`);
                }
                return 1;
            }
            else if (tokens.type === ret_1.default.types.CHAR) {
                return 1;
            }
            return isFinite(result) === true ? result : Infinity;
        };
        return counter(this.tokens);
    }
    generate(callback) {
        let groups = [];
        const generator = (tokens) => {
            if (tokens.type === ret_1.default.types.ROOT || tokens.type === ret_1.default.types.GROUP) {
                if (tokens.hasOwnProperty('options') !== true) {
                    tokens.options = [tokens.stack];
                }
                let result = distinct_1.distinct(tokens.options.map((stack) => {
                    return stack.filter((value) => value.hasOwnProperty('notFollowedBy') !== true);
                })).map((stack) => new Stack_1.Stack(stack.map((node) => generator(node))));
                if (result.length > 1) {
                    result = [new Option_1.Option(result)];
                }
                if (tokens.type === ret_1.default.types.GROUP && tokens.remember === true) {
                    groups.push(result[0]);
                }
                return result.shift();
            }
            else if (tokens.type === ret_1.default.types.POSITION) {
                if (['B', '^', '$'].includes(tokens.value) === true) {
                    return new Literal_1.Literal(['']);
                }
            }
            else if (tokens.type === ret_1.default.types.SET) {
                let set = [];
                for (let stack of tokens.set) {
                    if (stack.type === ret_1.default.types.SET) {
                        let data = [];
                        for (let node of stack.set) {
                            if (node.type === ret_1.default.types.RANGE) {
                                for (let i = node.from; i <= node.to; ++i) {
                                    data.push(i);
                                }
                            }
                            else if (node.type === ret_1.default.types.CHAR) {
                                data.push(node.value);
                            }
                        }
                        set = set.concat(stack.not ? difference_1.difference(this.charset, data) : intersection_1.intersection(this.charset, data));
                    }
                    else if (stack.type === ret_1.default.types.RANGE) {
                        for (let i = stack.from; i <= stack.to; ++i) {
                            set.push(i);
                        }
                    }
                    else if (stack.type === ret_1.default.types.CHAR) {
                        set.push(stack.value);
                    }
                }
                set = tokens.not === true ? difference_1.difference(this.charset, set) : intersection_1.intersection(this.charset, set);
                if (set.length === 0) {
                    set = [];
                }
                return new Literal_1.Literal(set.map((value) => String.fromCharCode(value)));
            }
            else if (tokens.type === ret_1.default.types.REPETITION) {
                if (tokens.type === ret_1.default.types.REPETITION && tokens.min === 0 && tokens.max === 1) {
                    if (tokens.value.type === ret_1.default.types.REPETITION) {
                        tokens = tokens.value;
                    }
                }
                return Repetition_1.Repetition(generator(tokens.value), tokens.min, tokens.max);
            }
            else if (tokens.type === ret_1.default.types.REFERENCE) {
                if (groups.hasOwnProperty(tokens.value - 1) !== true) {
                    throw new Error(`Reference to non-existent capture group.`);
                }
                return new Reference_1.Reference(groups[tokens.value - 1]);
            }
            else if (tokens.type === ret_1.default.types.CHAR) {
                return new Literal_1.Literal([String.fromCharCode(tokens.value)]);
            }
            return new Literal_1.Literal([]);
        };
        let values = generator(this.tokens);
        if (typeof callback === 'function') {
            for (let value of values) {
                if (callback(value) === false) {
                    return null;
                }
            }
            return null;
        }
        let result = [];
        for (let value of values) {
            result.push(value);
        }
        return result;
    }
}
module.exports = (regex, charset) => {
    return new Genex(regex, charset);
};

},{"./helpers/difference":1,"./helpers/distinct":2,"./helpers/intersection":3,"./iterators/Literal":5,"./iterators/Option":6,"./iterators/Reference":7,"./iterators/Repetition":8,"./iterators/Stack":9,"ret":10}],5:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Literal {
    constructor(data) {
        this.i = 0;
        this.data = data;
    }
    clone() {
        return new Literal(this.data);
    }
    current() {
        return this.data[this.i] || '';
    }
    next() {
        ++this.i;
    }
    rewind() {
        this.i = 0;
    }
    valid() {
        return this.i < this.data.length;
    }
}
exports.Literal = Literal;

},{}],6:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Option {
    constructor(data) {
        this.i = 0;
        this.data = data;
    }
    *[Symbol.iterator]() {
        for (this.rewind(); this.valid() === true; this.next()) {
            yield this.current();
        }
    }
    clone() {
        return new Option(this.data.map((iterator) => iterator.clone()));
    }
    current() {
        return this.data[this.i].current();
    }
    next() {
        if (this.valid() === true) {
            this.data[this.i].next();
            while (this.valid() === true && this.data[this.i].valid() !== true) {
                ++this.i;
            }
        }
    }
    rewind() {
        this.i = 0;
        for (let value of this.data) {
            value.rewind();
        }
    }
    valid() {
        return this.i < this.data.length;
    }
}
exports.Option = Option;

},{}],7:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Reference {
    constructor(data) {
        this.i = 0;
        this.data = data;
    }
    clone() {
        return new Reference(this.data);
    }
    current() {
        return this.data.current();
    }
    next() {
        ++this.i;
    }
    rewind() {
        this.i = 0;
    }
    valid() {
        return this.i == 0;
    }
}
exports.Reference = Reference;

},{}],8:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Literal_1 = require("./Literal");
const Option_1 = require("./Option");
const Stack_1 = require("./Stack");
function Repetition(data, min, max) {
    if (max === 0) {
        return new Literal_1.Literal(['']);
    }
    let stack = [];
    for (let i = 0; i < min; ++i) {
        stack.push(data.clone());
    }
    if (max > min) {
        stack.push(new Option_1.Option([new Literal_1.Literal([]), Repetition(data, 1, max - min)]));
    }
    return new Stack_1.Stack(stack);
}
exports.Repetition = Repetition;

},{"./Literal":5,"./Option":6,"./Stack":9}],9:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Literal_1 = require("./Literal");
class Stack {
    constructor(data) {
        if (data.length === 0) {
            data = [new Literal_1.Literal([''])];
        }
        this.data = data;
    }
    *[Symbol.iterator]() {
        for (this.rewind(); this.valid() === true; this.next()) {
            yield this.current();
        }
    }
    clone() {
        return new Stack(this.data.map((iterator) => iterator.clone()));
    }
    current() {
        let result = '';
        for (let value of this.data) {
            result += value.current();
        }
        return result;
    }
    next() {
        if (this.valid() === true) {
            let i = this.data.length;
            while ((this.data[--i].next(), i > 0 && this.data[i].valid() !== true)) {
                this.data[i].rewind();
            }
        }
    }
    rewind() {
        for (let value of this.data) {
            value.rewind();
        }
    }
    valid() {
        return this.data.length > 0 && this.data[0].valid();
    }
}
exports.Stack = Stack;

},{"./Literal":5}],10:[function(require,module,exports){
const util      = require('./util');
const types     = require('./types');
const sets      = require('./sets');
const positions = require('./positions');


module.exports = (regexpStr) => {
  var i = 0, l, c,
    start = { type: types.ROOT, stack: []},

    // Keep track of last clause/group and stack.
    lastGroup = start,
    last = start.stack,
    groupStack = [];


  var repeatErr = (i) => {
    util.error(regexpStr, `Nothing to repeat at column ${i - 1}`);
  };

  // Decode a few escaped characters.
  var str = util.strToChars(regexpStr);
  l = str.length;

  // Iterate through each character in string.
  while (i < l) {
    c = str[i++];

    switch (c) {
      // Handle escaped characters, inclues a few sets.
      case '\\':
        c = str[i++];

        switch (c) {
          case 'b':
            last.push(positions.wordBoundary());
            break;

          case 'B':
            last.push(positions.nonWordBoundary());
            break;

          case 'w':
            last.push(sets.words());
            break;

          case 'W':
            last.push(sets.notWords());
            break;

          case 'd':
            last.push(sets.ints());
            break;

          case 'D':
            last.push(sets.notInts());
            break;

          case 's':
            last.push(sets.whitespace());
            break;

          case 'S':
            last.push(sets.notWhitespace());
            break;

          default:
            // Check if c is integer.
            // In which case it's a reference.
            if (/\d/.test(c)) {
              last.push({ type: types.REFERENCE, value: parseInt(c, 10) });

            // Escaped character.
            } else {
              last.push({ type: types.CHAR, value: c.charCodeAt(0) });
            }
        }

        break;


      // Positionals.
      case '^':
        last.push(positions.begin());
        break;

      case '$':
        last.push(positions.end());
        break;


      // Handle custom sets.
      case '[':
        // Check if this class is 'anti' i.e. [^abc].
        var not;
        if (str[i] === '^') {
          not = true;
          i++;
        } else {
          not = false;
        }

        // Get all the characters in class.
        var classTokens = util.tokenizeClass(str.slice(i), regexpStr);

        // Increase index by length of class.
        i += classTokens[1];
        last.push({
          type: types.SET,
          set: classTokens[0],
          not,
        });

        break;


      // Class of any character except \n.
      case '.':
        last.push(sets.anyChar());
        break;


      // Push group onto stack.
      case '(':
        // Create group.
        var group = {
          type: types.GROUP,
          stack: [],
          remember: true,
        };

        c = str[i];

        // If if this is a special kind of group.
        if (c === '?') {
          c = str[i + 1];
          i += 2;

          // Match if followed by.
          if (c === '=') {
            group.followedBy = true;

          // Match if not followed by.
          } else if (c === '!') {
            group.notFollowedBy = true;

          } else if (c !== ':') {
            util.error(regexpStr,
              `Invalid group, character '${c}'` +
              ` after '?' at column ${i - 1}`);
          }

          group.remember = false;
        }

        // Insert subgroup into current group stack.
        last.push(group);

        // Remember the current group for when the group closes.
        groupStack.push(lastGroup);

        // Make this new group the current group.
        lastGroup = group;
        last = group.stack;
        break;


      // Pop group out of stack.
      case ')':
        if (groupStack.length === 0) {
          util.error(regexpStr, `Unmatched ) at column ${i - 1}`);
        }
        lastGroup = groupStack.pop();

        // Check if this group has a PIPE.
        // To get back the correct last stack.
        last = lastGroup.options ?
          lastGroup.options[lastGroup.options.length - 1] : lastGroup.stack;
        break;


      // Use pipe character to give more choices.
      case '|':
        // Create array where options are if this is the first PIPE
        // in this clause.
        if (!lastGroup.options) {
          lastGroup.options = [lastGroup.stack];
          delete lastGroup.stack;
        }

        // Create a new stack and add to options for rest of clause.
        var stack = [];
        lastGroup.options.push(stack);
        last = stack;
        break;


      // Repetition.
      // For every repetition, remove last element from last stack
      // then insert back a RANGE object.
      // This design is chosen because there could be more than
      // one repetition symbols in a regex i.e. `a?+{2,3}`.
      case '{':
        var rs = /^(\d+)(,(\d+)?)?\}/.exec(str.slice(i)), min, max;
        if (rs !== null) {
          if (last.length === 0) {
            repeatErr(i);
          }
          min = parseInt(rs[1], 10);
          max = rs[2] ? rs[3] ? parseInt(rs[3], 10) : Infinity : min;
          i += rs[0].length;

          last.push({
            type: types.REPETITION,
            min,
            max,
            value: last.pop(),
          });
        } else {
          last.push({
            type: types.CHAR,
            value: 123,
          });
        }
        break;

      case '?':
        if (last.length === 0) {
          repeatErr(i);
        }
        last.push({
          type: types.REPETITION,
          min: 0,
          max: 1,
          value: last.pop(),
        });
        break;

      case '+':
        if (last.length === 0) {
          repeatErr(i);
        }
        last.push({
          type: types.REPETITION,
          min: 1,
          max: Infinity,
          value: last.pop(),
        });
        break;

      case '*':
        if (last.length === 0) {
          repeatErr(i);
        }
        last.push({
          type: types.REPETITION,
          min: 0,
          max: Infinity,
          value: last.pop(),
        });
        break;


      // Default is a character that is not `\[](){}?+*^$`.
      default:
        last.push({
          type: types.CHAR,
          value: c.charCodeAt(0),
        });
    }

  }

  // Check if any groups have not been closed.
  if (groupStack.length !== 0) {
    util.error(regexpStr, 'Unterminated group');
  }

  return start;
};

module.exports.types = types;

},{"./positions":11,"./sets":12,"./types":13,"./util":14}],11:[function(require,module,exports){
const types = require('./types');
exports.wordBoundary = () => ({ type: types.POSITION, value: 'b' });
exports.nonWordBoundary = () => ({ type: types.POSITION, value: 'B' });
exports.begin = () => ({ type: types.POSITION, value: '^' });
exports.end = () => ({ type: types.POSITION, value: '$' });

},{"./types":13}],12:[function(require,module,exports){
const types = require('./types');

const INTS = () => [{ type: types.RANGE , from: 48, to: 57 }];

const WORDS = () => {
  return [
    { type: types.CHAR, value: 95 },
    { type: types.RANGE, from: 97, to: 122 },
    { type: types.RANGE, from: 65, to: 90 }
  ].concat(INTS());
};

const WHITESPACE = () => {
  return [
    { type: types.CHAR, value: 9 },
    { type: types.CHAR, value: 10 },
    { type: types.CHAR, value: 11 },
    { type: types.CHAR, value: 12 },
    { type: types.CHAR, value: 13 },
    { type: types.CHAR, value: 32 },
    { type: types.CHAR, value: 160 },
    { type: types.CHAR, value: 5760 },
    { type: types.RANGE, from: 8192, to: 8202 },
    { type: types.CHAR, value: 8232 },
    { type: types.CHAR, value: 8233 },
    { type: types.CHAR, value: 8239 },
    { type: types.CHAR, value: 8287 },
    { type: types.CHAR, value: 12288 },
    { type: types.CHAR, value: 65279 }
  ];
};

const NOTANYCHAR = () => {
  return [
    { type: types.CHAR, value: 10 },
    { type: types.CHAR, value: 13 },
    { type: types.CHAR, value: 8232 },
    { type: types.CHAR, value: 8233 },
  ];
};

// Predefined class objects.
exports.words = () => ({ type: types.SET, set: WORDS(), not: false });
exports.notWords = () => ({ type: types.SET, set: WORDS(), not: true });
exports.ints = () => ({ type: types.SET, set: INTS(), not: false });
exports.notInts = () => ({ type: types.SET, set: INTS(), not: true });
exports.whitespace = () => ({ type: types.SET, set: WHITESPACE(), not: false });
exports.notWhitespace = () => ({ type: types.SET, set: WHITESPACE(), not: true });
exports.anyChar = () => ({ type: types.SET, set: NOTANYCHAR(), not: true });

},{"./types":13}],13:[function(require,module,exports){
module.exports = {
  ROOT       : 0,
  GROUP      : 1,
  POSITION   : 2,
  SET        : 3,
  RANGE      : 4,
  REPETITION : 5,
  REFERENCE  : 6,
  CHAR       : 7,
};

},{}],14:[function(require,module,exports){
const types = require('./types');
const sets  = require('./sets');


const CTRL = '@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^ ?';
const SLSH = { '0': 0, 't': 9, 'n': 10, 'v': 11, 'f': 12, 'r': 13 };

/**
 * Finds character representations in str and convert all to
 * their respective characters
 *
 * @param {String} str
 * @return {String}
 */
exports.strToChars = function(str) {
  /* jshint maxlen: false */
  var chars_regex = /(\[\\b\])|(\\)?\\(?:u([A-F0-9]{4})|x([A-F0-9]{2})|(0?[0-7]{2})|c([@A-Z[\\\]^?])|([0tnvfr]))/g;
  str = str.replace(chars_regex, function(s, b, lbs, a16, b16, c8, dctrl, eslsh) {
    if (lbs) {
      return s;
    }

    var code = b ? 8 :
      a16   ? parseInt(a16, 16) :
      b16   ? parseInt(b16, 16) :
      c8    ? parseInt(c8,   8) :
      dctrl ? CTRL.indexOf(dctrl) :
      SLSH[eslsh];

    var c = String.fromCharCode(code);

    // Escape special regex characters.
    if (/[[\]{}^$.|?*+()]/.test(c)) {
      c = '\\' + c;
    }

    return c;
  });

  return str;
};


/**
 * turns class into tokens
 * reads str until it encounters a ] not preceeded by a \
 *
 * @param {String} str
 * @param {String} regexpStr
 * @return {Array.<Array.<Object>, Number>}
 */
exports.tokenizeClass = (str, regexpStr) => {
  /* jshint maxlen: false */
  var tokens = [];
  var regexp = /\\(?:(w)|(d)|(s)|(W)|(D)|(S))|((?:(?:\\)(.)|([^\]\\]))-(?:\\)?([^\]]))|(\])|(?:\\)?([^])/g;
  var rs, c;


  while ((rs = regexp.exec(str)) != null) {
    if (rs[1]) {
      tokens.push(sets.words());

    } else if (rs[2]) {
      tokens.push(sets.ints());

    } else if (rs[3]) {
      tokens.push(sets.whitespace());

    } else if (rs[4]) {
      tokens.push(sets.notWords());

    } else if (rs[5]) {
      tokens.push(sets.notInts());

    } else if (rs[6]) {
      tokens.push(sets.notWhitespace());

    } else if (rs[7]) {
      tokens.push({
        type: types.RANGE,
        from: (rs[8] || rs[9]).charCodeAt(0),
        to: rs[10].charCodeAt(0),
      });

    } else if ((c = rs[12])) {
      tokens.push({
        type: types.CHAR,
        value: c.charCodeAt(0),
      });

    } else {
      return [tokens, regexp.lastIndex];
    }
  }

  exports.error(regexpStr, 'Unterminated character class');
};


/**
 * Shortcut to throw errors.
 *
 * @param {String} regexp
 * @param {String} msg
 */
exports.error = (regexp, msg) => {
  throw new SyntaxError('Invalid regular expression: /' + regexp + '/: ' + msg);
};

},{"./sets":12,"./types":13}]},{},[4]);
