/* DataMapper app.js

Code for parsing formatted fields into component parts, and then building
them up into other formats.

FUTURE: See https://customformats.com/ and https://github.com/sheetjs/ssf for standard formatting codes.  SHOULD CONVERT this to use those formats.
*/

/* String.supplant(dictionary)

Enables {squiggly} variable key in a string to be replaced by corresponding
dictionary key value, just like in python.

This PROTOTYPE extension must come before functions in script file.

@param string: string containing set bracket names to be replaced by matching
                keys in dictionary
@param dict: dict containing key-values.

*/
String.prototype.supplant = function (dict) {
    return this.replace(/{([^{}]*)}/g,
        function (a, b) {
            var r = dict[b];
            return typeof r === 'string' || typeof r === 'number' ? r : a;
        }
    );
};


REGEX_FIELD_TYPE =/\(\?<(?<name>[A-Za-z0-9_]+)>/g 
REGEX_FIELD_PARSE_CONTENT = /^\(\?<[A-Za-z0-9_]+>(?<content>.+)\)$/
REGEX_DUPLICATE_NAME = /\((?<name>\?<[^>]+>)(?<content>.+?)\(\k<name>/

function init_field_type() {

  // Dictionary of field name -> regex parse.
  // Global // let field_parse_index = {}; 

  // Every field that has a mapping will be member of 'integer' group.
  field_equivalence['xs_nonNegativeInteger']={} 

  // 1st pass: make an index, and set parent for each field type.
  for (let [section_id, section] of Object.entries(lang)) {
    for (let [field_id, field] of Object.entries(section)) {
      // Some fields are in sections but have a separate mapping group, e.g.
      // hour types that are under time section.
      if (!field.group)
        field.group = section_id;
      field.id = field_id;
      if (field.map) {
        // [integer] group gets all fields - an integer can map to any of them
        // to at least some extent
        field_equivalence['xs_nonNegativeInteger'][field_id] = null;

        // If this field has a map, add field to map index by parent group
        if (!field_equivalence[field.group])
          field_equivalence[field.group] = {};
        // field.decompose can be undefined
        field_equivalence[field.group][field_id] = field.decompose || null; 
      }
      field.synth = field.parse; // keeps string version.
      field_index[field_id] = field;
      field_parse_index[field_id] = field.parse;
    }

  }

  // Every field_equivalence set has "int" as member since generally int can
  // be used as an input index on any of them to fetch a value.
  for (let [group, equivalence_dict] of Object.entries(field_equivalence)) {
    if (group != 'decimal')
      equivalence_dict['xs_nonNegativeInteger'] = null;
    // Add flag to field to indicate whether mapping should be 'int' or 'natural'?
    equivalence_dict['natural'] = null;
  }

  /* 2nd pass: Lookup all {named_part} of parse regular expressions, e.g.
    parse: '(?<date_iso_8601>{YYYY}-{MM}-{DD})',
  */
  for (let step = 0; step < 5; step++) {
    for (let [field_id, field] of Object.entries(field_index)) {
      if (field.parse.indexOf('{') !== -1) { // possibility of "{named_part}"
        // Do a search and replace.  This may still require more S&R, but
        // sometimes a "{" exists in parse itself so can't just loop until
        // it is gone. Hence 3 iterations.
        field.parse = field.parse.supplant(field_parse_index);
        field_parse_index[field_id] = field.parse;
      }
    }
  }

  // 3rd pass: convert all parse fields to regex fields
  // NOTE: This works in Safari and Chrome. 
  // Firefox v78 (june 2020 beta) supports named expressions.
  for (let [field_id, field] of Object.entries(field_index)) {
    // Must eliminate duplicate instances of any name in field.parse or a 
    // regex parse error will be thrown.
    // Note lazy search via "<content>.+?" searches for nearest occurance of name.

    var old_parse = field.parse

    // FUTURE: Could make this more sophisticated and actually preserve 2nd instance of
    // named group, with a counter suffix.
    field.parse = field.parse.replace(REGEX_DUPLICATE_NAME, "($<name>$<content>(");
    while (old_parse != field.parse) {
      old_parse = field.parse;
      field.parse = field.parse.replace(REGEX_DUPLICATE_NAME, "($<name>$<content>(");
    }

    // Now convert parse string into live regular expression
    field.parse = new RegExp('^' + field.parse + '$', 'i');
  } 
}


/* Validate a user or spec input field against its stated field type.

  :param str field_id: key id of field type
  :return whole matched regular expression
  :rtype regular expression object including .groups
*/
function validate(field_id, value) {
  let field_type = field_index[field_id];
  if (field_type) {
    let parsed_value = value.match(field_type.parse);
    // ISSUE {latitude} {longitude} --> parsing.  If one of the two is wrong, needs to be validated
    if (parsed_value !== null && (field_type.xs_minInclusive || field_type.xs_maxInclusive)) {
      if (field_type.xs_minInclusive && (field_type.xs_minInclusive > parsed_value.groups[field_id]))
        return false
      if (field_type.xs_maxInclusive && (field_type.xs_maxInclusive < parsed_value.groups[field_id]))
        return false
    }
    return parsed_value
  }

  console.log(`No field_index[] for field type "${field_id}"`)
  return false
}

/*
:param boolean show: display messages.
*/
function convert(fields, target_type, show) {

  let messageDom = document.getElementById('conversion');
  let target_field = field_index[target_type];

  // source_dict collects all parsed parts of field inputs.
  // Allow target default components to be added to source component 
  // dictionary.  They are superceded by any source matched components.
  let source_dict = target_field.default ? target_field.default : {};

  source_dict = parse_inputs(fields, source_dict, show);

  console.log('Parsed source:', source_dict);

  /*
  // The simple case:
  if (source_field == target_field) {
    if (show) 
      messageDom.innerHTML = "Field match!";
    return source_value;
  }
  */

  // SYNTHESIS: Usually target field type components will occur in source dict.
  // TOP-DOWN - if we can match overall part, then dispense with matching component parts.
  let mapping = {};
  let synth = '';

  // Easy case: source_dict already has exactly same field type as target.
  // e.g. in (?<latitude>{xs_decimal}) , "latitude" is a source_dict key too.
  if (target_type in source_dict) {
    synth = source_dict[target_type];
    mapping[target_type] = synth;
    synth_value = synth;
  }
  else {
    // See if there's a mapping from target.id to some other input in group.
    // Would there ever be more than one mapping?
    [mapped_id, synth] = get_mapped_field(target_field, source_dict);
    if (mapped_id) {
      mapping[target_type] = synth;
      //console.log ("MAP RESULT", target.id, mapped_id, synth)
      //xs_decimal has mapping to nonNegativeInteger.  Probably shouldn't.
      if (!synth) {
        synth = '';
      }
      synth_value = synth //.supplant(mapping)

    }
    else {
      // Assemble target from components spread across one or more fields.
      synth_value = synthesize(target_field, source_dict);

    }

  }

  // Show mapping used in conversion.
  if (show) {
    messageDom.innerHTML = JSON.stringify(mapping, undefined, 4); 
  }

  // String() just in case it is a number (in case where array values provided as numbers)
  return String(synth_value)

}


function parse_inputs(fields, source_dict, show) {
  
  let found = false;
  for(let field of fields){

    let source_type = field.field;
    let source_value = field.value;

    let source_field = field_index[source_type];

    let source_parse_result = source_value.match(source_field.parse);
    //source_parse_result = validate(source_id, source_value) 
    if (source_parse_result) {
      //console.log(source_dict)
      source_dict = {...source_parse_result.groups,...source_dict};
    }
    else {
      if (show)
        messageDom.innerHTML = `Input field ${source_type} value is invalid`;
    }


    // If a source field is in a mapping group, and one of that group's members
    // mentions field.detail = true, add its parse to the source field mapping 
    // so that target has more exposed source components to match. There is at
    // most one detail field per group.

    // This is a bit of a hack? Why not do this for every source component that 
    // could be decomposed too?


    // WHY is DATE FIELD SoURCE ID M_D_YYYY undefined datetime_iso_8601
    // HAVING NO group 
    /*
    if (source_field.map && (source_field.group in field_equivalence)) {
      //FIND field type in map set that has .detail == true: 
      for (let [detail_id, detail] of Object.entries(field_equivalence[source_field.group])) {
        if (detail == true) {
          // Add detail_id field's parse of source value to source_dict
          if (!source_dict[source_field.id])
            console.log("Field ${source_field.id} has group ${source_field.group} but no source_dict entry for that ")
          console.log("SoURCE ID", source_field.id, source_dict[source_field.id], detail_id)
          let mapped_value = field_map(source_field.id, source_dict[source_field.id], detail_id);
          let detail_dict = mapped_value.match(field_index[detail_id].parse);
          if (detail_dict) {
            source_dict = {...source_dict,...detail_dict.groups};
          }
        }
      }
    }
    */

    // Ensure whole parse available by id too.
    // e.g. unix_date in source dict {sign:-,int:2342,...,unix_date:-2342}
    //source_dict[source.id] = source_parse_result[0];

  }

  return source_dict;
}


/* Assemble target from components spread across one or more fields.
  This is not highly efficient. 
  FUTURE: provide a compiled transform based on the following inputs
  and outputs.

  EXTRACT string of matchable parts (if any) {p1}{p2}?{p3}...

  e.g. target parse 
  (?<latitude>{xs_decimal}) -> {xs_decimal}
  (?<day_duration_iso_8601>{day_duration}D) -> {day_duration}D
*/
function synthesize(target_field, source_dict) {

  //synth = target.synth.match(REGEX_FIELD_PARSE_CONTENT).groups['content'];

  // If a decimal number is returned the "." part of the number may dissappear as it
  // is being used in a regular expression below.  Need to escape it. Same with "+".
  Object.keys(source_dict).forEach(function(key) {
    if (key in source_dict && source_dict[key]) {
      // ISSUE: EACH NUMERIC COMPONENT NEEDS xs_minIncluding and xs_maxIncluding tests.
      source_dict[key] = source_dict[key].replace(/(?<escape>[\.\+])/,'\\$<escape>')
    }
  });

  //Copy known values in from source_dict
  synth = target_field.synth.supplant(source_dict);

  // Replace remaining {fielt_type} with regex components from lang, if any.
  synth = synth.supplant(field_parse_index);

  // Remove the wrapper "(?<name>" ... ")" parts from field's string version of parse
  // since RandExp() can't handle named groups
  synth = synth.replace(REGEX_FIELD_TYPE, '(') //.groups['content'];

  // Using https://github.com/fent/randexp.js to generate regex for 
  // alternative parts like numeric +/- and space between latitude 
  // longitude.
  var randexp = new RandExp(synth);
  randexp.max = 1; // limit on optional repeating elements
  // This is critical to enabling all ? and (a|b|c) choices to always
  // prioritize empty choice or first item in list.
  randexp.randInt = function (a,b) {return a}
  synth_value = randexp.gen();

  console.log("ASSEMBLE ", target_field.id, synth, synth_value, source_dict)

  // ISSUE: ADD BETTER MAPPING EXPLANATION.

  // If {named_part} still left in regular expression then Search and
  // replace was not successful, some missing input part.
  return synth_value;
}

/* 
  FUTURE: multiple combinations of mappings possible?
*/ 
function get_mapped_field(field, source_dict) {
  let map_set = field_equivalence[field.group];
  if (map_set && field.map) { // A field may be in a group but not have a map.
    for (let [mapped_id, map_val] of Object.entries(map_set)) { 
      if (mapped_id in source_dict) {
        // We found a mapping that is present in source parse.  Use it. 
        let source_value = source_dict[mapped_id]
        field_value = field_map(mapped_id, source_value, field.id)
        return [mapped_id, field_value]
      }
    }
  }
  return [null, null]
}

/* Create a hierarchy array out of well-balanced nested parenthetic structure
function parse_tree(str) {
  var cnt=0;  // keep count of opened brackets
  return Array.prototype.reduce.call(str,function(prev,curr){
    if (curr==='(' && cnt++===0) prev.push('');
    if (cnt>0) prev[prev.length-1]+=curr;
    if (curr===')') cnt--;
    return prev;
  },[]);
}
*/

/* Take source field's parsed value, 
get source field's index for that value
then get target field's lookup for that index.
*/
function field_map(source_id, value, target_id) {
  // ANY TWO FIELDS SHOULD ALWAYS BE CONVERTED VIA INT mapping, not directly
  // value, M_D_YYYY: "2/1/1923", MM: "02", …}
  let source_index = get_map_index(field_index[source_id], value);

  if (isNaN(source_index)) {
    console.log ("ERROR: In field_map(), ", source_id, "did not return index for value:", value)
  }
  return get_map_value(field_index[target_id], source_index);
}

// Get index of value in given field type map
// ISSUE: lookup controls whether fetching output by index or index by value
function get_map_index(field_type, value) {
  //console.log("get_map_index() on", field_type.id, value)
  if (Array.isArray(field_type.map)) {
    return field_type.map.indexOf(value);
  }

  // Otherwise return index of value mapped via .map() function
  return field_type.map(value, false); 
}

// Get map value by field type map index
function get_map_value(field_type, index) {
  if (Array.isArray(field_type.map))
    return field_type.map[index];
  return field_type.map(index, true); // true = get value at index
}

/* This is a simple "identity" mapping function that allows a field type to
return given "param" (an integer as a string) as an integer rather than having
to spell out an array map: [0,1,2,... n].  It also provides int field types 
with an easy mapping with upper and lower bounds if necessary. Default 
behavour is that integers range from 0 to infinity. 

  :param str param: An integer in string form
  :param int lower: null or some negative limit
  :param int upper: null or some positive limit
  :param boolean padding: whether to pad number according to upper range digits
  :return: Validated string conversion of integer
  :rtype: str
*/
function map_integer(param, lowerlim = 0, upper = null, padding = false) {

  let value = parseInt(param);
  if (lowerlim !== null) {
    if (value < lowerlim) {
      return false;
    }
    if (lowerlim === 0)
      value = Math.abs(value); // drops leading "+" if any
  }
  if (upper !== null)
    if (value > upper)
      return false;

  value = String(value);
  if (padding && upper) {
    value = value.padStart(String(upper).length, '0');
  }
  return value;
}

/* Bi-direction date field conversion according to various formats, e.g. 
en-US and en-UK.

Avoiding new Intl.DateTimeFormat() because there seems to be a bug in BRITISH
en-GB language display of D/M/YYYY in that it ALWAYS publishes date with 
leading 0 DD MM even if one tries to provide option of {month: 'numeric', 
day: 'numeric'} etc. Not sure if that is just Chrome ...

Called in js/fields.js by D_M_YYYY (en-GB) and M_D_YYYY (en-US)

For javascript date time formats, see: https://www.ecma-international.org/publications/files/ECMA-ST/ECMA-402.pdf

If get index called (i.e. lookup = false, the default)
:param string A date string in GB or US or other format.
:rtype integer

If lookup call performed, then integer is supplied as key for date, 
:param int An integer (or string coerced into one).
:rtype str A date string is returned

*/
function date_map(param, lookup, field_label) {
 
  // linux time -> e.g. US M/D/YYYY date
  if (lookup) { // Adding timezone offset
    let date = new Date(param*1000);
    date.setHours(date.getHours() + date.getTimezoneOffset()/60); // for UTC
    date_dict = {
      'YYYY': date.getFullYear(),
      'M': date.getMonth() +1,
      'D': date.getDate()
    }
    var date_synth = lang.date[field_label].synth;
    var date_format = date_synth.match(REGEX_FIELD_PARSE_CONTENT).groups['content'];
    return date_format.supplant(date_dict);
  }

  // Generate linux time from given string date
  // new Date() can't handle '{D}/{M}/{YYYY}' GB formatted dates, and
  // maybe others, so rebuild date using 'M_D_YYYY' US format
  // A dictionary composed of all the date parts. depends on named parts
  let dict = param.match(lang.date[field_label].parse).groups; 

  var date = new Date('{M}/{D}/{YYYY}'.supplant(dict)); 
  //Date above doesn't have timezone so created date ASSUMED to be local to computer
  return String((date.getTime() - date.getTimezoneOffset()*60*1000) / 1000); 
}