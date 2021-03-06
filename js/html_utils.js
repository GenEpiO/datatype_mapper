
// This is called only from index.html inputs.
function convert_formfield() {

  let messageDom = document.getElementById('conversion');

  let target_field = get_field_type('spec_field_type_1');
  if (!target_field) {
        messageDom.innerHTML = 'Specification field type needs to be selected';
    return false;
  }

  let target_dom = document.getElementById('spec_field_input_1');

  let fields = [];

  for (ptr = 1; ptr < 4; ptr ++) {
    let source_field = get_field_type('user_field_type_' + ptr);
    if (!source_field && ptr ==1) { // Just check first user input field
      messageDom.innerHTML = `Input field type needs to be selected or is invalid`;
      return false;
    }
    if (source_field) {
      let source_value = document.getElementById('user_field_input_' + ptr).value;
      fields.push({field: source_field.id, value: source_value});
    }
  }
  //true = show messages.
  target_dom.value = convert(fields, target_field.id, true); 

}

function flip_formfield () {

  let source_input = document.getElementById('user_field_input_1');
  let source_select = document.getElementById('user_field_type_1');
  let target_select = document.getElementById('spec_field_type_1');
  let target_input = document.getElementById('spec_field_input_1');
  // Flips both sets of values.
  [source_select.value, target_select.value] = [target_select.value, source_select.value];
  [source_input.value, target_input.value] = [target_input.value, source_input.value];
  source_select.onchange();
}

function get_field_type(select_domId) {
  let select = document.getElementById(select_domId);
  let option = select.value //[select.selectedIndex];
  if (select.selectedIndex != -1 && select.value in field_index)
    return field_index[select.value];

  return false
}


/* Populate a select input displaying groups of field type
  :param str domId: id of dom HTML select input
*/
function render_field_type(domId) {

  let select = document.getElementById(domId);

  for (let [section_name, section] of Object.entries(lang)) { 
    let group = document.createElement("optgroup");
    group.label = section_name; 
    select.appendChild(group);
    for (let [field_name, field] of Object.entries(section)) { 
      let opt = document.createElement("option");
      opt.value = field_name; // only saves string.
      opt.innerHTML = field.label; // whatever property it has
      group.appendChild(opt);
    }
  }
}

/* Populate unit menu displaying groups of units
  :param str domId: id of dom HTML select input
*/
function render_field_unit(domId) {

  let select = document.getElementById(domId);
  let option = document.createElement('optgroup');
  option.label = 'Select a unit ...';
  select.appendChild(option);

  for (let [section_uri, section] of Object.entries(unit)) {
    if (section.children) {
      option = document.createElement('optgroup');
      option.label = section.label;
      select.appendChild(option);
      render_unit_item(option, section)
    }
    else
      render_unit_item(select, section)
  }
}

// ISSUE: HTML optgroup spec is broken. Only 1 level deep allowed.
function render_unit_item(group, item, depth=0) {
  if (item.children) {
    if (depth > 0) {
      let option = make_option(group, item, depth)
      option.disabled = "disabled";
    }
    for (let [item2_uri, item2] of Object.entries(item.children)) { 
      render_unit_item(group, item2, depth + 1)
    }
  }
  else 
    make_option(group, item, depth)
}


function make_option(group, item, depth=0) {
  let option = document.createElement('option');
  option.value = item.label;  // or item.iri
  option.innerHTML = ' &nbsp;&nbsp; '.repeat(depth > 1 ? depth-1:0) + item.label;
  group.appendChild(option);
  return option;
}


// Enable regular expressions with named groups to be displayed nicely in HTML.
function escapeHTML(s) { 
    return String(s).replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
}

function select_update(field_id) {
  let control = document.getElementById('user_field_type_1');
  control.value = field_id;
  control.onchange();
}


/* List regular expressions that match given field content
Link matching field type to user field type select list so users can switch to it.
  :param str input_source: either 'user' or 'spec'

*/
function recognize(input_source) {
  let input_field = document.getElementById(input_source + '_field_input_1')
  var text = '';
  for (let [section_name, section] of Object.entries(lang)) { 
    for (let [field_name, field] of Object.entries(section)) { 
      let result = input_field.value.match(field.parse)
      if (result)
        text += `<span class="field_type recognize" onclick="javascript:select_update('${field.id}')">${field.label}</span> ${escapeHTML(field.parse)}<br/>`

    }
  }

  document.getElementById("message").innerHTML = text;

}

/* Validate a user or spec input field against its stated field type.

  :param str input_source: either 'user' or 'spec'
  :return whole matched regular expression
  :rtype str
*/
function validate_wrapper(input_source) {

  let field_id = document.getElementById(input_source + '_field_type_1').value;
  let field_type = field_index[field_id];
  let message = 'Select a field type to validate by it';

  if (field_id) {
    let text = null;
    let input_field = document.getElementById(input_source + '_field_input_1');
    let result = false //validate (field_id, input_field.value);

    if (result) {
      let params = [];
      for (let [name, value] of Object.entries(result.groups))
        params.push(`${name}: ${value}`);
      text = params.join(', ');
    }
    else {

      text = `<span class="field_error">${escapeHTML(field_type.parse)}</span><br/>`;
    }

    message = `<span class="field_type">${field_type.label}</span><br/>` + text;

  }

  document.getElementById(input_source + "_validation").innerHTML = message;
}


//Runs tests given in #test_suite table
function render_test_suite() {
  let table = document.getElementById('test_suite');
  // Each tbody is a test on one field type to another and back.
  let clickable = ' onclick="javascript:load_test(this)"';

  test_suite.forEach(test =>  { 
    let tbody = document.createElement('tbody');
    test.user.error = [];
    test.user.class = [];
    if (!test.spec) 
      test.spec = {field:'', unit:'', values:[]};
    test.spec.error = [];
    test.spec.class = [];

    if (!test.round)
      test.round = {values:[]};
    test.round.class = [];

    for (i = 0; i <4; i++) { // test1, test2, test3, test4 columns.
      test.user.error[i] = '';
      test.user.class[i] = '';
      test.spec.error[i] = '';
      test.spec.class[i] = '';
      if (!test.round.values[i])
        test.round.values[i] = '';
      test.round.class[i] = '';

      if (test.user.values[i]) {
        value = test.user.values[i];

        // Validate user field parse
        validation = validate(test.user.field, value);
        test.user.class[i] = (validation && validation.groups[test.user.field]) ? 'ok' : 'invalid';

        // Try user -> spec conversion
        if (test.spec.values[i] && test.spec.field) {
          let output = convert([{field: test.user.field, value: value}], test.spec.field);
          //let spec_value = test.spec.values[i];
          // if the spec field value matches converted field's value, good!
          if (test.spec.values[i].localeCompare(output) == 0) {
            test.spec.class[i] = "ok";

            // Try spec -> user conversion
            if (output !== false && (test.round.values[i] != 'n/a' )) {
              let round = convert([{field: test.spec.field, value: output}], test.user.field);
              // We don't test against original value, but rather against what
              // user field type is. Allows for extra + , .0 fraction etc.
              if (value.localeCompare(round) == 0) {
                //console.log (validation2)
              //validation2 = validate(test.user.field, round);
              //if (validation2 && validation2.groups[test.user.field]) {
                test.round.class[i] = "ok";
                test.round.values[i] = '&#10004;'; // checkmark
              }
              else {
                test.round.class[i] = "error";
                test.round.values[i] = round;
              }
            }
          }
          else {
            // Error by intention, so 
            if (test.spec.values && test.spec.values[i] == 'false') {
              test.spec.class[i] = 'ok';
              test.spec.error[i] = `<br/><span class="invalid">${output}</span>`;
            }
            else
              test.spec.error[i] = `<br/><span class="error">${output}</span>`;
          }
        }
      }

    };

    var html = ` 
      <tr>
        <td>user</td> 
        <td>${test.user.field}</td>
        <td class="clickable ${test.user.class[0]}" onclick="javascript:load_test('${test.user.field}','${test.user.values[0]}','${test.spec.field}')">
          ${test.user.values[0]}${test.user.error[0]}</td>
        <td class="clickable ${test.user.class[1]}" onclick="javascript:load_test('${test.user.field}','${test.user.values[1]}','${test.spec.field}')">
          ${test.user.values[1]}${test.user.error[1]}</td>
        <td class="clickable ${test.user.class[2]}" onclick="javascript:load_test('${test.user.field}','${test.user.values[2]}','${test.spec.field}')">
          ${test.user.values[2]}${test.user.error[2]}</td>
        <td class="clickable ${test.user.class[3]}"  onclick="javascript:load_test('${test.user.field}','${test.user.values[3]}','${test.spec.field}')">
          ${test.user.values[3]}${test.user.error[3]}</td>
        <td>${test.user.unit}</td>
      </tr>`;
    if (test.spec.values.length>0) 
      html += ` 
      <tr>
        <td>spec</td>
        <td>${test.spec.field}</td>
        <td class="${test.spec.class[0]}">${test.spec.values[0]}${test.spec.error[0]}</td>
        <td class="${test.spec.class[1]}">${test.spec.values[1]}${test.spec.error[1]}</td>
        <td class="${test.spec.class[2]}">${test.spec.values[2]}${test.spec.error[2]}</td>
        <td class="${test.spec.class[3]}">${test.spec.values[3]}${test.spec.error[3]}</td>
        <td>${test.spec.unit}</td>
      </tr>
      <tr>
        <td>round</td>
        <td></td>
        <td class="${test.round.class[0]}">${test.round.values[0]}</td>
        <td class="${test.round.class[1]}">${test.round.values[1]}</td>
        <td class="${test.round.class[2]}">${test.round.values[2]}</td>
        <td class="${test.round.class[3]}">${test.round.values[3]}</td>
        <td></td>        
      </tr>
    `;

    tbody.innerHTML = html;
    table.appendChild(tbody);
  })
}

// Puts given parameters into HTML form and triggers conversion.
function load_test(source_id, value, target_id) {
  let messageDom = document.getElementById('conversion');
  let source = document.getElementById('user_field_type_1');
  source.value = source_id;
  if (source.selectedIndex == -1)
    messageDom.innerHTML = 'ERROR: Test suite requested unavailable field type: ' + source_id;
  let source_input = document.getElementById('user_field_input_1');
  source_input.value = value;
  let target = document.getElementById('spec_field_type_1');
  target.value = target_id;
  if (target.selectedIndex == -1)
    messageDom.innerHTML = 'ERROR: Test suite requested unavailable field type: ' + target_id;
  source.onchange();

}

