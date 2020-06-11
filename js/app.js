/* Enables {squiggly} variable key in a string to be replaced by corresponding dictionary key value, just like in python.

PROTOTYPE extension has to come before functions in script file.
*/
String.prototype.supplant = function (dict) {
    return this.replace(/{([^{}]*)}/g,
        function (a, b) {
            var r = dict[b];
            return typeof r === 'string' || typeof r === 'number' ? r : a;
        }
    );
};

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
        // [integer] group gets all fields - an integer can map to any of them to at least some extent
        field_equivalence['integer'][field_id] = null;

        // If this field has a map, add field to map index by parent group
        if (!field_equivalence[field.group])
          field_equivalence[field.group] = {};
        field_equivalence[field.group][field_id] = field.decompose || null; //field.decompose can be undefined
      }
      if (!field.synth) {
        field.synth = ['{' + field_id + '}'];
      }
      field_index[field_id] = field;
      field_parse_index[field_id] = field.parse;
    }

  }

  // Every field_equivalence set has "int" as member since generally int can
  // be used as an input index on any of them to fetch a value.
  for (let [group, equivalence_dict] of Object.entries(field_equivalence)) {
    equivalence_dict['int'] = null;
    // Add flag to field to indicate whether mapping should be 'int' or 'natural'?
    equivalence_dict['natural'] = null;
  }

  /* 2nd pass: For a field type that is missing a parse, or has a parse 
  temporarily set to a synth expression that can be decomposed further, do
  the decomposition of synth expression.
  Issue: e.g. 
    unix_date.synth = ['{signed_int}']
    signed_int.synth = ['{sign}{int}'] but this isn't always done in time!
  We have to run this a few times so field_type_parse gets populated with 
  signed_int.parse, then unix_date.synth dict lookup can work.

  To create parse, it ONLY decomposes FIRST synth[0]. OK?
  */
  for (let step = 0; step < 3; step++) {
    for (let [field_id, field] of Object.entries(field_index)) {
      if (!field.parse || (field.synth && field.parse == field.synth[0])) {
        var synth = field.synth[0]
        var tag = synth.substr(1,synth.length-2)
        console.log (field.parse, synth, tag)
        field.parse = synth.supplant(field_parse_index);
        // Situation year_duration.parse = '{int}' , int.parse = '(?<int>(0|[1-9]\\d*))'
        // We want resulting parse to take on name 'year_duration', i.e.
        // year_duration.parse = '(?<year_duration>(0|[1-9]\\d*))'
        if (tag.indexOf('}') == -1) // if only 1 {..} s&r
          field.parse = field.parse.replace('<' + tag + '>', '<' + field.id + '>')
        field_parse_index[field_id] = field.parse;
      }
    }
  }

  // 3rd pass: convert all parse fields to regex fields
  // NOTE: This works in Safari and Chrome. Firefox as of April 29 2020 does
  // not support named expressions.
  for (let [field_id, field] of Object.entries(field_index)) {
    field.parse = new RegExp('^' + field.parse + '$', 'i');
  } 

  console.log(field_parse_index)
}



/* Validate a user or spec input field against its stated field type.

  :param str field_id: key id of field type
  :return whole matched regular expression
  :rtype regular expression object including .groups
*/
function validate(field_id, value) {
  return value.match(field_index[field_id].parse);
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
  if (source == target) {
    // Need defaults at all? null differences?
    if (show) 
      messageDom.innerHTML = "Field match!";
    return source_value;
  }

  if (show)
    console.log("Field mismatch!");

  /* Default mapping assumes target field type will occur in source dict. This
  will be typical of mapping between fields in datasets defined by pure 
  ontology specs.
   e.g. mapping = {'{date_iso_8601}':'date_iso_8601':null }'}
   e.g. mapping = {'{M}/{D}/{YYYY}:'M':null,'D':null,'YYYY':null }'}
   e.g. target {'{signed_int}': {…}} issue this won't get accessed as unix_date????
  */
  let synth = '{' + target.id + '}';
  if (target.synth) {
    synth = target.synth[0];  // LATER EXPLORE MULTIPLE SYNTH POSSIBILITIES
  }

  let mapping = {[synth]: {} };
  let components = synth.match(/{([^{}]*)}/g);
  for (let ptr in components) {
    var item = components[ptr]
    var field_id = item.substr(1, item.length - 2); //strips off {} from e.g. {int}.
    mapping[synth][field_id] = null; // give it an empty mapping to start.

    // Q: is target a mapping of source?
    var field = field_index[field_id];

    // Here a field type has no map, but should have a key in source dict.
    if (source_dict[field_id]) {
      mapping[synth][field_id] = source_dict[field_id];
    }
    else {

      let map_set = field_equivalence[field.group];
      if (map_set && field.map) { // A field may be in a group but not have a map.
        for (let [mapped_id, map_val] of Object.entries(map_set)) { 
          if (mapped_id in source_dict) {
            // We found a mapping that is present in source parse.  Use it. 
            field_value = field_map(mapped_id, source_dict[mapped_id], field_id)
            mapping[synth][field_id] = field_value;
            //mapping[synth][field_id] = mapped_id;
            break; // Shouldn't need/have multiple mappings per group.
          }
        }
      }
    }
  }

  //console.log("source parse", source_dict)
  //console.log("Target-to-source mapping:", mapping)

  // Apply and render mapping to target's synth expression.
  if (show) {
    messageDom.innerHTML = JSON.stringify(mapping, undefined, 4); 
    console.log(synth, mapping[synth]) // i.e. the mapping key synth dictionary
  }
  return synth.supplant(mapping[synth])
}

function field_map(source_id, value, target_id) {
  // ANY TWO FIELDS SHOULD ALWAYS BE CONVERTED VIA INT mapping, not directly
  // value, M_D_YYYY: "2/1/1923", MM: "02", …}
  let source_index = get_map_index(field_index[source_id], value);
  return get_map_value(field_index[target_id], source_index);
}

// Get index of value in given field type map
function get_map_index(field_type, value) {
  if (Array.isArray(field_type.map))
    return field_type.map.indexOf(value);
  return field_type.map(value);
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

ISSUE: 3/1/1995 D/M/YYYY - british style

If get index called (the default)
:param string A date string in GB or US
:rtype integer

If lookup call performed
:rtype str 

*/
function date_time_map(param, lookup, language, format) {
  // e.g. linux time -> US M/D/YYYY date
  if (lookup) {
    let date = new Date(param*1000);
    let options = {timeZone:'UTC'}
    return new Intl.DateTimeFormat(language, options).format(date)
  }
  // e.g. US M/D/YYYY date -> linux time
  // Issue: new Date() can't handle GB formatted dates.
  if (language == 'en-GB') { //
    var synth = '{M}/{D}/{YYYY}';
  }
  else
    var synth = lang.date[format].synth[0];

  let dict = param.match(lang.date[format].parse).groups;
  var date = new Date(synth.supplant(dict)); 
  //Date above doesn't have timezone so created date ASSUMED to be local to computer
  return String((date.getTime() - date.getTimezoneOffset()*60*1000) / 1000); // 
}