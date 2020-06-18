/* 
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

REGEX_FIELD_TYPE =/\(\?<(?<name>[A-Za-z0-9_]+)>/ig 

function init_field_type() {

  // Dictionary of field name -> regex parse.
  let field_parse_index = {}; 

  // Every field that has a mapping will be member of 'integer' group.
  field_equivalence['integer']={} 

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
        field_equivalence['integer'][field_id] = null;

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
  for (let step = 0; step < 4; step++) {
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
    // Note lazy search via "<content>.+?"
    var myre = /\((?<name>\?<[^>]+>)(?<content>.+?)\(\k<name>/
    var old_parse = field.parse

    // Could make this more sophisticated and actually preserve 2nd instance of
    // named group, with a counter suffix.
    field.parse = field.parse.replace(myre, "($<name>($<content>");
    while (old_parse != field.parse) {
      old_parse = field.parse;
      field.parse = field.parse.replace(myre, "($<name>($<content>");
    }

    //console.log(field.parse)

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
  if (field_index[field_id])
    return value.match(field_index[field_id].parse);

  console.log(`No field_index[] for field type "${field_id}"`)
  return false
}

/*

:param boolean show: display messages.
*/
function convert(source_id, source_value, target_id, show=false) {

  let source = field_index[source_id];
  let target = field_index[target_id];
  let messageDom = document.getElementById('conversion');
  let source_parse_result = null;

  if (!source || !target) {
    if (show)
      messageDom.innerHTML = 'Please ensure user data and specification field types have been selected';
    return false;
  }

  // We accept the granularity of source input components as present in source_dict

  source_parse_result = source_value.match(source.parse);
  if (source_parse_result) 
    source_dict = source_parse_result.groups;
  else {
    if (show)
      messageDom.innerHTML = 'Source is invalid';
    return false;
  }

  // TO DO: ALLOW MULTIPLE INPUT FIELDS TO CONTRIBUTE TO SOURCE_DICT

  // Allow target default components to be added to source component 
  // dictionary.  They are superceded by any source matched components.
  if (target.default)
    source_dict = {...target.default,...source_dict};

  // Ensure whole parse available by id too.
  // e.g. unix_date in source dict {sign:-,int:2342,...,unix_date:-2342}
  source_dict[source.id] = source_parse_result[0];

  // If a source field is in a mapping group, and one of that group's members
  // mentions field.detail = true, add its parse to the source field mapping 
  // so that target has more exposed source components to match. There is at
  // most one detail field per group.

  // This is a bit of a hack? Why not do this for every source component that 
  // could be decomposed too?
  if (source.map && (source.group in field_equivalence)) {
    //FIND field type in map set that has .detail == true: 
    for (let [detail_id, detail] of Object.entries(field_equivalence[source.group])) {
      if (detail == true) {
        // Add detail_id field's parse of source value to to source_dict
        mapped_value = field_map(source.id, source_dict[source.id], detail_id);
        detail_dict = mapped_value.match(field_index[detail_id].parse);
        if (detail_dict) {
          source_dict = {...source_dict,...detail_dict.groups};
        }
      }
    }
  }

  if (show)
    console.log('Parsed source:', source_dict);

  // The simple case:
  // NO: SHOULD TEST SELF - e.g. decimal 0 = decimal 0.0 ?
  if (source == target) {
    // Need defaults at all? null differences?
    if (show) 
      messageDom.innerHTML = "Field match!";
    return source_value;
  }

  if (show)
    console.log("Field type A to B!");

  /* Default mapping assumes target field type will occur in source dict. This
  will be typical of mapping between fields in datasets defined by pure 
  ontology specs.
   e.g. mapping = {'{date_iso_8601}':{'date_iso_8601':null }'}
   e.g. mapping = {'{M}/{D}/{YYYY}':{'M':null,'D':null,'YYYY':null }'}
   e.g. target {'{signed_int}': {…}} issue this won't get accessed as unix_date????

   TOP-DOWN - if we can match overall part, then dispense with matching component parts.
   
   (?<lat_long>{latitude} ?{longitude}) -> 
      ({lat_long}{latitude} ?{longitude})
      if no {lat_long}
       -> ({latitude} ?{longitude})
      if latitude in dictionary, use it
      otherwise replace it with regexp 
      (?<latitude>{xs_decimal}) -> 
          ({xs_decimal})
    
  */

  /* e.g. target parse 
    (?<DD>0[1-9]|[12][0-9]|30|31) -> {DD}
    (?<h12>[0-9]|10|11|12)[ ]?(?<a_p>a|p|am|pm) -> {h12}{a_p}

    (?<day_duration>{xs_integer}D) -> ({day_duration}{xs_integer}D)
    (?<day_duration_iso_8601>{day_duration}D)

TRY: EXPAND TARGET PARSE to determine parts and their order.

CREATE 2nd string out of parts (if any) {p1}{p2}{p4}
APPLY source_dict to that.
THEN APPLY TARGET PARSE TO THAT.
ISSUE IS IF TARGET PARSE HAS [s]{4} etc.

  */ 
  let mapping = {}

  // Easy case: source_dict already has exactly same field type as target.
  if (target.id in source_dict) {
    var synth = source_dict[target.id];
    mapping[target.id] = synth;

  }
  else {
    // See if there's a mapping from target.id to some other input in group.
    var [mapped_id, synth] = get_mapped_field(target, source_dict);
    if (mapped_id) {
      mapping[target.id] = synth;
      //console.log ("MAP RESULT", target.id, mapped_id, synth)
      //xs_decimal has mapping to nonNegativeInteger.  Probably shouldn't.
      if (!synth) {
        synth = '';
      }
      console.log("here at " , target.id )
    }
    else {
      // Assemble target from components.

      // Remove the first ?<name> part from field's string version of parse
      var synth = target.synth.replace(REGEX_FIELD_TYPE, '(');

      // Work on matching each component
      //e.g. ({day_duration}{xs_integer}D)
      // match day_duration
      field_types = synth.match(/{([^{}]*)}/g);

      console.log("ASSEMBLE ",target.id, field_types, source_dict)
      //var field_id = .substr(1, item.length - 2);
    }

  }

  // Apply and render mapping to target's synth expression.
  if (show) {
    messageDom.innerHTML = JSON.stringify(mapping, undefined, 4); 
    console.log(synth, mapping) // i.e. the mapping key synth dictionary

  }

  // String() just in case it is a number (in case where array values provided as numbers)
  return String(synth).supplant(mapping)

}

/* Given a
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

// Create a hierarchy array out of well-balanced nested parenthetic structure
function parse_tree(str) {
  var cnt=0;  // keep count of opened brackets
  return Array.prototype.reduce.call(str,function(prev,curr){
    if (curr==='(' && cnt++===0) prev.push('');
    if (cnt>0) prev[prev.length-1]+=curr;
    if (curr===')') cnt--;
    return prev;
  },[]);
}

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

Called in js/fields.js by D_M_YYYY (en-GB) and M_D_YYYY (en-US)

If get index called (the default)
:param string A date string in GB or US
:rtype integer

If lookup call performed
:rtype str 

*/
function date_map(param, lookup, language, format) {
 
  // e.g. linux time -> US M/D/YYYY date
  if (lookup) {
    let date = new Date(param*1000);
    let options = {timeZone:'UTC'}
    return new Intl.DateTimeFormat(language, options).format(date)
  }

  // new Date() can't handle '{D}/{M}/{YYYY}' GB formatted dates, and
  // maybe others, so rebuild date using 'M_D_YYYY' US format
  let synth = '{M}/{D}/{YYYY}'; 
  // A dictionary composed of all the date parts
  let dict = param.match(lang.date[format].parse).groups;

  var date = new Date(synth.supplant(dict)); 
  //Date above doesn't have timezone so created date ASSUMED to be local to computer
  return String((date.getTime() - date.getTimezoneOffset()*60*1000) / 1000); // 
}