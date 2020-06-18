
/* Good testing resource: https://regex101.com/
// Good regex named group reference: https://2ality.com/2017/05/regexp-named-capture-groups.html

Parse definitions have a syntax that weaves in both regular expression content
and {part_name} references. parse operates on a single input field, splitting
it up into one or more named matching expressions.  Examples:

      parse: '(?<xs_nonNegativeInteger>(0|[1-9]\\d*))',
      parse: '(?<unix_date>{xs_integer})',
      parse: '(?<date_iso_8601>{YYYY}-{MM}-{DD})',
      parse: '(?<duration>P{year_duration}?{month_duration}?{week_duration}?{day_duration}?)'],

A PARSING method first does a python dictionary lookup (coming from this lang
data structure) to swap in component regular expressions to generate a single
regular expression that matches a single string, start to finish. 

One issue is that regular expressions don't allow duplicate named groups. This
poses a problem for a lat_long having <latitude> and <longitude> referencing 
the same <xs_integer> as a part. SOLUTION: duplicate occurrances of 
<part_name> (generally?) aren't needed as they are low-level artifacts, so
remove the <part_name> (or make them unique by autoincrementing suffix). The
generated dictionary of terms will just have higher level named things like
latitude: ... and longitude: ... .

Another issue is that named regex's are very particular about the characters
allowed in a name. <name> can't contain anything besides alphanumeric and 
underscore. To work with this, reference to XML schema datatypes is done with
"xs_" prefix.

As a SYNTHESIS method - to see if all the parts are available during a parsing
effort to create a given field type - we try to construct the field type from
all the parts provided in a dictionary that has been generated of parse parts.
To synthesize, each {part_name} value has to be wrapped in brackets and its 
textual content must be escaped so it can be taken as a string literal. A twist
on this is that the elements making up the single output may actually be from
different input fields, e.g. YYYY, MM, DD input as separate fields, not one
string.

The actual parsing is a two step process:
1) replace parse {} with their dictionary regexpressions
*/
lang = {
  day: {// day of month
    D: {
      label: "day of month",
      parse: '(?<D>[1-9]|[12][0-9]|30|31)',
      map: [...Array(31).keys()].map(x => (x + 1).toString())
    },
    DD: {
      label: "day - 2 digit",
      parse: '(?<DD>0[1-9]|[12][0-9]|30|31)',
      // map has leading zeros, so string index:
      map: ['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31']
    }
    // case: 2.5 days?
  },
  weekday: { // day of week
    weekday_int: {
      label: "weekday - integer",
      parse: '(?<weekday_int>[1-7])',
      map: ['1','2','3','4','5','6','7']
    },
    weekday_abbr: {
      label: "weekday - abbr",
      parse: '(?<weekday_abbr>(mon|tue|wed|thu|fri|sat|sun))',
      map: ['mon','tue','wed','thu','fri','sat','sun']
    },
    weekday_word: {
      label: "weekday - word",
      parse: '(?<weekday_word>(monday|tuesday|wednesday|thursday|friday|saturday|sunday))',
      map: ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
    },
  },
  month: { // month of year
    M: {
      label: "month - integer",
      parse: '(?<M>[1-9]|10|11|12)',
      unit: 'UO:0000035',
      map: [1,2,3,4,5,6,7,8,9,10,11,12] // numeric values allow bidirectional lookup
    },
    MM: {
      label: "month - 2 digit",
      parse: '(?<MM>0[1-9]|10|11|12)',
      unit: 'UO:0000035',
      map: ['01','02','03','04','05','06','07','08','09','10','11','12']
    },
    month_abbr: {
      label: "month - abbr",
      parse: '(?<month_abbr>(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))',
      unit: 'UO:0000035',
      map: ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
    },
    month_word : {
      label: "month - word",
      parse: '(?<month_word>(january|february|march|april|may|june|july|august|september|october|november|december))',
      unit: 'UO:0000035',
      map: ['january','february','march','april','may','june','july','august','september','october','november','december']
    }
  },
  calendar_year : { // Gregorian year
    YYYY: {
      label: 'year - 4 digit',
      parse: '(?<YYYY>\\d{4})',
      unit: 'UO:0000036',
      map: function (param){
        return map_integer(param, 0, 9999, true)}
    },
    // If historically we don't know what millenia this is in, and it doesn't matter for analysis, we can just "pass it through".  Synth dict should report non-deterministic mappings. 
    YY: {
      label: 'year - 2 digit',
      parse: '(?<YY>\\d\\d)',
      unit:'UO:0000036',
      map: function (param){
        return map_integer(param, 0, 99, true)}
      //YY is ambiguous re. Gregorian calendar, so map only to integer directly.
    },
    c19YY: {
      label: 'YY of 19YY',
      parse: '(?<c19YY>\\d\\d)',
      //synth: ['{YY}'], // if you do this then YY's map is used, bad!
      unit:'UO:0000036',
      map: function (param, lookup){
        if (lookup) {
          // 1900 -> 0, 1901 -> 1 etc.
          return map_integer(param-1900, 0, 99, true) // padded to 2 digits
        }
        // 0 -> 1900, 1 -> 1901
        return map_integer(1900+parseInt(param), 1900, 1999) // conversion to YYYY index
      }
    },
    c20YY: {
      label: "YY of 20YY",
      parse: '(?<c20YY>\\d\\d)',
      //synth: ['{YY}'], // 
      unit:'UO:0000036',
      map: function (param, lookup){
        if (lookup)
          return map_integer(param-2000, 0, 99, true)
        return map_integer(2000+parseInt(param), 2000, 2099) // conversion to YYYY index
      }
    }
  },
  time: {

    /* 
    P is the duration designator (for period) placed at the start of the duration representation.

    Y is the year designator that follows the value for the number of years.
    M is the month designator that follows the value for the number of months.
    W is the week designator that follows the value for the number of weeks.
    D is the day designator that follows the value for the number of days.

    T is the time designator that precedes the time components of the representation.

    H is the hour designator that follows the value for the number of hours.
    M is the minute designator that follows the value for the number of minutes.
    S is the second designator that follows the value for the number of seconds.
    */
    duration: {
      label: 'duration - ISO 8601',
      parse: '(?<duration>P{year_duration}?{month_duration}?{week_duration}?{day_duration}?)',
      // Mapping is a bit complicated.
    },
    year_duration_iso_8601: {
      label: 'year - duration iso 8601',
      parse: '(?<year_duration_iso_8601>{year_duration}Y)',
      unit: 'UO:0000036'
    },
    year_duration: {
      label: 'year - duration',
      parse: '(?<year_duration>{xs_integer})',
      unit: 'UO:0000036'
    },
    month_duration_iso_8601: {
      label: 'month - duration iso 8601',
      parse: '(?<month_duration_iso_8601>{month_duration}M)',
      unit: 'UO:0000035'
    },
    month_duration: {
      label: 'month - duration',
      parse: '(?<month_duration>{xs_integer})',
      unit: 'UO:0000035'
    },
    week_duration_iso_8601: {
      label: 'week - duration iso 8601',
      parse: '(?<week_duration_iso_8601>{week_duration}W)',
      unit: 'UO:0000034'
    },
    week_duration: {
      label: 'week - duration',
      parse: '(?<week_duration>{xs_integer})',
      unit: 'UO:0000034'
    },
    day_duration_iso_8601: {
      label: 'day - duration iso 8601',
      parse: '(?<day_duration_iso_8601>{day_duration}D)',
      unit: 'UO:0000033'
    },
    day_duration: {
      label: 'day - duration',
      parse: '(?<day_duration>{xs_integer})',
      unit: 'UO:0000033'
    }
  },
  'hour': {
    hh: {
      label: 'hour - 24 hh',
      group: 'hour',
      parse: '(?<hh>[01][0-9]|20|21|22|23)',
      unit: 'UO:0000032',
      map: function (param){return map_integer(param, 0, 23, true)},
    },
    h: {
      label: 'hour - 24 h',
      group: 'hour',
      parse: '(?<h>[0-9]|1[0-9]|20|21|22|23)',
      unit: 'UO:0000032',
      map: function (param){return map_integer(param, 0, 23)},
    },
    h12ap: {
      label: 'hour - 12 a/p',
      group: 'hour',
      parse: '(?<h12>[0-9]|10|11|12)[ ]?{am_pm}', //case insensitive
      unit: 'UO:0000032',
      map: function (param, lookup){
        // SADLY - param isn't dictionary - it doesn't include <a_p>. Fix in future?
        // 0-23 -> x a/p
        if (lookup) {
          param = parseInt(param);
          return (param < 12) ? param + 'a' : (param-12) +'p';
        }
        // x a/p -> 0-23
        param_int = parseInt(param)

        if (param.indexOf('p')>0 || param.indexOf('P')>0) // CASE SENSITIVE!
          return map_integer(param_int+12, 12, 23)
        return map_integer(param_int, 0, 11)
      }
    }
  },
  string: {
    am_pm: {
      label: 'am_pm',
      parse: '(?<am_pm>a|p|am|pm)',
    },
    a_p: {
      label: 'a_p',
      parse: '(?<a_p>a|p|am|pm)',
    }
  },
  minute: {
    m_int: {
      label: 'minute integer',
      parse: '(?<m_int>{xs_integer})',
      unit: 'UO:0000031',
      group: 'minute',
      map: function (param){return map_integer(param, 0, null)},
    },
    mm: {
      label: 'minute - mm',
      parse: '(?<mm>[0-5]\\d)',
      unit: 'UO:0000031',
      group: 'minute',
      map: function (param){return map_integer(param, 0, 59, true)},
    },
    s_int: {
      label: 'second integer',
      parse: '(?<s_int>{xs_integer})',
      unit: 'UO:0000010',
      group: 'second',
      map: function (param){ // NEVER ACCESSED BECAUSE {xs_integer} TAKES OVER!
        //console.log('second integer', param, map_integer(param, 0, null))
        return map_integer(param, 0, null)},
    },
    ss: {
      label: 'second - ss',
      parse: '(?<ss>[0-5]\\d)',
      unit: 'UO:0000010',
      group: 'second',
      map: function (param){
        return map_integer(param, 0, 59, true)},
    },
    ms_int: {
      label: 'millisecond integer',
      parse: '(?<ms_int>{xs_integer})',
      unit: 'UO:0000028', // millisecond
      group: 'millisecond',
      map: function (param){return map_integer(param, 0, null)},
    },
    ms_fraction: {
      label: 'millisecond as fraction',
      //group: 'fraction',
      parse: '(?<ms_fraction>\\.\\d\\d\\d)',
      //synth: ['{fraction}'],        // ISSUE: If you add this, then its mapping function is used.
      unit: 'UO:0000010', // second
      group: 'millisecond',
      map: function (param, lookup){
        if (lookup) {
          //console.log("ms_fraction map", param)
          // 0 -> .000 , 1 -> .001 etc.
          return (parseInt(param) / 1000).toFixed(3).substr(1); // trims off leading 0
        }

        // .000 -> index = 0; .001 -> index = 1 etc.
        return map_integer('0' + param * 1000, 0, 999, true);
      },
    },
  },
  timezone: {
    TZD: {
      label: 'ISO TZD',
      parse: '(?<TZD>Z|(\\+|-)[0-5][0-9]:[0-5][0-9])' // Z stands for UTC
    }
  },
  date: {
    unix_date: {
      label: 'date - unix',
      parse: '(?<unix_date>{xs_integer})',
      map: function (param){return param}
    },
    date_iso_8601: {
      label: 'date (ISO 8601)',
      parse: '(?<date_iso_8601>{YYYY}-{MM}-{DD})',
      map: function(param, lookup) { 
        // unix time map -> ISO
        if (lookup) {
          let date = new Date(param*1000);
          return date.toISOString().split('T')[0];
        }
        // ISO -> unix time map
        return String(Date.parse(param)/1000)
      }
    },
    time_iso_8601: {
      label: 'time (ISO 8601)',
      parse: '(?<time_iso_8601>{hh}((?<delim>:?){mm}(\\k<delim>{ss}{ms_fraction}?)?)?)',
      map: null // PROBABLY THE SAME AS FOR datetime_iso_8601
    },
    // https://en.wikipedia.org/wiki/ISO_8601
    datetime_iso_8601: { // Like above, but NO SPLIT ON T.
      label: 'datetime (ISO 8601)',
      parse: '(?<datetime_iso_8601>{date_iso_8601}T{time_iso_8601}{TZD})',
      // "decompose" flag indicates source dictionary should include this decomposition
      // if a mapping is requested.
      decompose:true, 
      map: function(param, lookup) {
        // unix time -> ISO Full date
        if (lookup) {  // from int to string
          if (isNaN(param))
            return param;
          let date = new Date(param*1000);
          return date.toISOString();      
        }
        // ISO Full date -> unix time
      
       // console.log("ISO -> unix", param/1000, String(Date.parse(param/1000) ));
        return String(Date.parse(param)/1000) 
      }
    },
    M_D_YYYY: {
      label: 'M/D/YYYY (US format)',
      parse: '(?<M_D_YYYY>{M}/{D}/{YYYY})',
      map: function(param, lookup) {
        // Failing on 1/1/1970
        //console.log("try M_D_YYYY map on", param)
        return date_map(param, lookup, 'en-US','M_D_YYYY')}
    },
    D_M_YYYY: {
      label: 'D/M/YYYY (GB format)',
      parse: '(?<D_M_YYYY>{D}/{M}/{YYYY})',
      map: function(param, lookup) {
        return date_map(param, lookup, 'en-GB','D_M_YYYY')}
    }
  },
  sign: {
    sign: {
      label: 'sign', // +/-
      parse: '(?<sign>-|\\+?)' // plus sign is optional in positive #
    }
  },
  integer: {
    xs_nonNegativeInteger: {
      label: 'xs_nonNegativeInteger', // unsigned
      parse: '(?<xs_nonNegativeInteger>(0|[1-9]\\d*))',
      // Special mapping function accomodates ANY integer range > 0.
      map: function (param){return map_integer(param, 0, null)}
    },
    xs_integer: {
      label: 'xs_integer',
      parse: '(?<xs_integer>{sign}{xs_nonNegativeInteger})',
      // Synthesis is:
      // ({sign}{xs_nonNegativeInteger})
      // Issue: only works if run on a single field.
      default: {'sign':''}, // provides default component values
      // Note, map doesn't accept negative values.  Starts with origin = 0
      map: function (param){return map_integer(param, 0, null)}
    },
    natural: {
      label: 'natural',
      parse: '(?<natural>[1-9]\\d*)',
      // Special mapping function accomodates ANY integer range > 0.
      map: function (param, lookup){
        if (lookup)
          return map_integer(parseInt(param) + 1, 1, null);
        return map_integer(parseInt(param) -1, 0, null);
      }
    },
  },
  decimal: {
    'xs_decimal': {
      label: 'xs_decimal',
      parse: '(?<xs_decimal>{xs_integer}{fractional}?)',
      map: function (param){return param}
    }
  },
  fraction: {
    fraction: { // includes leading 0
      label: 'fraction',
      parse: '(?<fraction>0\\.\\d+)', 
      map: function (param){return param}
    },
    fractional: { // doesn't include 0 before .
      label: 'fractional',
      parse: '(?<fractional>\\.\\d+)',
      map: function (param){return param}
    }, 
  },
  boolean: {
    boolean_10: {
      label: "boolean 1/0",
      parse: '(?<boolean_10>[01])',
      map: ['0','1']
    },
    y_n: {
      label: "boolean y/n",
      parse: '(?<y_n>[yn])',
      map: ['n','y']
    },
    yes_no: {
      label: "boolean yes/no",
      parse: '(?<yes_no>yes|no)',
      map: ['no','yes']
    },
    true_false: {
      label: "boolean true/false",
      parse: '(?<true_false>true|false)',
      map: ['false','true']
    }
  },
  metadata: {
    n_a: {
      label: "not applicable",
      parse: '(?<n_a>n\/a)'
    },
    missing: {
      label: 'missing',
      parse: '(?<missing>missing)'
    }
  },
  geospatial: {
    lat_long: {
      label: 'lat/long - decimal',
      parse: '(?<lat_long>{latitude} ?{longitude})'
    },
    latitude: {
      label: 'latitude - decimal',
      parse: '(?<latitude>{xs_decimal})',
      'xs_minInclusive': -90,
      'xs_maxInclusive': 90
    },
    longitude: {
      label: 'longitude - decimal',
      parse: '(?<longitude>{xs_decimal})',
      'xs_minInclusive': -180,
      'xs_maxInclusive': 180
    }
  }
}
/*
MUST HANDLE TEXT CAPS / UCASE / LCASE transforms
Dates with different delimiters or no delimiter
YYYY-MM

*/

/*

https://www.gs1.org/voc/NonbinaryLogicCode

FALSE False gs1:NonbinaryLogicCode-FALSE
NOT_APPLICABLE  Not Applicable  gs1:NonbinaryLogicCode-NOT_APPLICABLE
TRUE  True  gs1:NonbinaryLogicCode-TRUE
UNSPECIFIED Unspecified gs1:NonbinaryLogicCode-UNSPECIFIED

*/
