// get current file URL
var scripts = document.getElementsByTagName("script");
var src     = scripts[scripts.length-1].src;
var listUrl = src.split('/');
listUrl.pop();
listUrl.push("");
var scriptImportDataViewDir = listUrl.join("/");

getImportDataViewComponent = async function() {
// ------------------------------------------------------------------------

// get template for component
var templImportDataView;
await $.asyncGet(scriptImportDataViewDir + "ImportDataView.html", function(data){
    templImportDataView = data;
}.bind(this));


await getLineChartViewComponent();

var ImportDataView = {
  template: templImportDataView,
  props: {
  	// algorithm output
    time: {
      type    : Array,
      required: true
    },
    input: {
      type    : Array,
      required: true
    },
    output: {
      type    : Array,
      required: true
    },
  },
  data() {
    return {
	  hot_display  : false, // Fixed hot rendering issue
      hot_data     : [['','','']],
      hot_settings : {
          copyPaste: true,
          colHeaders           : true ,
          rowHeaders           : true ,
          stretchH             : 'all',
          outsideClickDeselects: false,
          afterChange : (info) => {
            if(!info) {
              return;
            }
            // update data
            this.hot_data.copyFrom(this.table.getData());
            // update charts
            this.on_afterChange();
            // left menu
            this.$emit('latestStep');
          },
          afterSelection : (row_start, col_start, row_end, col_end) => {
          	// fix, after empty arrays
          	if(this.time.length <= 0) {
          		return;
          	}
          	this.on_afterSelection(row_start, row_end);
          },
          beforePaste: function(data) {
          	if(data.length <= 0) {
          		return;
          	}
          	if(data[0].length == 1) {
				var results = Papa.parse(data.flat(1).join('\n'));
      			if(results.data[0].length <= 1) {
      				return;
      			}
				else {
					data.copyFrom(results.data); 					
				}      		
          	}
          },
      },
      hot_headers   : ['Time','Input','Output'],
      ranges_enabled: true,
      ranges        : [],
      show_error    : false,
      error_class   : 'negative',
      error_title   : 'Invalid Data',
      error_message : 'Unknown Error',
      max_chart_len : 300    
    }
  },
  beforeDestroy: function() {
  	// hide hot (fix for render issue)
	this.hot_display = false;
  },
  mounted: function() {
  	// show hot (fix for render issue)
  	this.hot_display = true;
  	// if already have values, load them, else test data
  	this.hot_data = [];
  	if(this.time.length > 0) {  
		// NOTE : need to clone data or it wont work in vue
		for(var i = 0; i < this.time.length; i++) {
			this.hot_data.push([this.time[i], this.input[i], this.output[i]]);
		}
  	}
  	else {
  		// use test data
  		this.hot_data.copyFrom(test_data);
  	}
    // init time, input, output
    this.on_afterChange();
    // copy hot instance
    this.table = this.$refs.hot.table;
    // add context menu
    this.table.updateSettings({
      // NOTE : need to modify this.hot_data directly
      contextMenu: {
        items: {
		  "copy_inside": {
            name: 'Copy Selection',
            callback: () => { 
				var plugin = this.table.getPlugin('CopyPaste');
				// NOTE : need to re-select for this to work
				this.table.selectCell(this.table.getSelected()[0][0], this.table.getSelected()[0][1], this.table.getSelected()[0][2], this.table.getSelected()[0][3]);
				plugin.setCopyableText();
    			plugin.copy(true);
            }
          },
          "paste": {
            name: 'Paste : Use Ctrl-V',
            disabled: function() {
			  return true;
			},
			// NOTE : https://docs.handsontable.com/6.0.1/demo-copy-paste.html
			//        programmatic copy-paste only works between hots
          },
          "insert_rows" : {
          	name    : "Insert",
          	submenu : {
          		items : [
          		  {
                    key     : "insert_rows:10_above", // NOTE : need to set full object-path in key
                    name    : 'Insert 10 rows above',
                    callback: (key, options) => { this.tableInsertRows(this.table.getSelected()[0][0]-1, 10); }
          		  },
          		  {
                    key     : "insert_rows:5_above", 
                    name    : 'Insert 5 rows above',
                    callback: (key, options) => { this.tableInsertRows(this.table.getSelected()[0][0]-1, 5); }
          		  },
          		  {
                    key     : "insert_rows:1_above", 
                    name    : 'Insert 1 row above',
                    callback: (key, options) => { this.tableInsertRows(this.table.getSelected()[0][0]-1, 1); }
          		  },
          		  {
                    key     : "insert_rows:1_below",
                    name    : 'Insert 1 row below',
                    callback: (key, options) => { this.tableInsertRows(this.table.getSelected()[0][2]+1, 1); }
          		  },
          		  {
                    key     : "insert_rows:5_below",
                    name    : 'Insert 5 rows below',
                    callback: (key, options) => { this.tableInsertRows(this.table.getSelected()[0][2]+1, 5); }
          		  },
          		  {
                    key     : "insert_rows:10_below",
                    name    : 'Insert 10 rows below',
                    callback: (key, options) => { this.tableInsertRows(this.table.getSelected()[0][2]+1, 10); }
          		  },
          		]
          	}
          },
          "remove_inside": {
            name: 'Remove Selection',
            callback: (key, options) => { this.tableRemoveRows(this.table.getSelected()[0][0], this.table.getSelected()[0][2]); }
          },
          "remove_outside": {
            name: 'Remove Outside Selection',
            callback: (key, options) => { 
            	var start = this.table.getSelected()[0][0]-1;
            	var end   = this.table.getSelected()[0][2]+1;
            	if(start >= 0) {
            		this.tableRemoveRows(0, start); 
            		end = end - start - 1; // NOTE : not sure about -1, but works so far
            	}
            	if(end <= this.hot_data.length) {
            		this.tableRemoveRows(end, this.hot_data.length); 
            	}
			}
          },
          "clear": {
            name: 'Clear Table',
            callback: (key, options) => {
              this.hot_data = [['','','']];
              this.on_afterChange();
            }
          }
        }   // items
      }   // contextMenu
    }); // updateSettings
    // emit step loaded
    this.$emit('stepLoaded');
  }, // mounted
  computed: {
  	input_chart_data: function() {
	  // first create data
	  var in_data = [];
	  // [ALT]	  
	  var i = 0;	  
	  while(true) {
	  	var idx = i*this.step_data;
	  	if(idx >= this.time.length) {
	  		idx = this.time.length -1 ;
	  	}
	  	in_data.push({
	  		x : this.time [idx],
	  		y : this.input[idx]
	  	});
	  	if(idx == this.time.length-1) {
	  		break;
	  	}
	  	i++;
	  }
	  // then datasets
	  var in_datasets = [
		{
		  label          : 'Input',
		  data           : in_data,
		  borderColor    : '#2185D0',
		}
	  ];
	  // finally chart data
	  var in_chart_data = {
         labels  : this.getLabels(in_data),
         datasets: in_datasets,
      };
      return in_chart_data;
    }, // input_chart_data
    output_chart_data: function() {
	  // first create data
	  var out_data = [];
	  // [ALT]	  
	  var i = 0;	  
	  while(true) {
	  	var idx = i*this.step_data;
	  	if(idx >= this.time.length) {
	  		idx = this.time.length -1 ;
	  	}
	  	out_data.push({
	  		x : this.time  [idx],
	  		y : this.output[idx]
	  	});
	  	if(idx == this.time.length-1) {
	  		break;
	  	}
	  	i++;
	  }
	  // then datasets
	  var out_datasets = [
		{
		  label          : 'Output',
		  data           : out_data,
		  borderColor    : '#2185D0',
		}
	  ];
	  // finally chart data
	  var out_chart_data = {
         labels  : this.getLabels(out_data),
         datasets: out_datasets,
      };
      return out_chart_data;
    }, // output_chart_data
    step_data : function() {
    	// [ALT]
    	return Math.ceil(this.time.length/this.max_chart_len);
    },
    length_data : function() {
    	// [ALT]
    	return this.output_chart_data.datasets[0].data.length;
    }
  },
  methods: {
  	getLabels(data) {
		var out_labels = [];
		for(var i = 0; i < data.length; i++) {
			out_labels.push(this.getLabel(data[i].x));
		}
		return out_labels;
	},
	getLabel(value) {
		if(typeof value != "number") {
			return '';
		}
		return value.toFixed(2);
	},
    on_afterChange() {
      // clear old vectors
      this.time  .splice(0, this.time  .length);
	  this.input .splice(0, this.input .length);
	  this.output.splice(0, this.output.length);
      // update manually (computed props did not work)
      var tmp_time   = this.getColData(this.hot_data, 0);
      var tmp_input  = this.getColData(this.hot_data, 1);
      var tmp_output = this.getColData(this.hot_data, 2);
	  // clean
	  var i = 0;
	  var invalid_sample = -1;
	  while(i < tmp_time.length) {
	  	if(!isNaN(tmp_time[i])    && !isNaN(tmp_input[i])    && !isNaN(tmp_output[i]    ) &&
	  	    isFinite(tmp_time[i]) &&  isFinite(tmp_input[i]) &&  isFinite(tmp_output[i])) {
	  		// accepted
			i++;
	  	}
	  	else{
	  		// save first invalid sample
	  		if(invalid_sample < 0) {
	  			invalid_sample = i;
	  		}
	  		// rejected
	  		tmp_time  .splice(i, 1);
	  		tmp_input .splice(i, 1);
	  		tmp_output.splice(i, 1);
	  	}
	  }
	  // disable ranges if invalid samples found
	  if(invalid_sample >= 0) {
	  	this.ranges_enabled = false;	
	  	this.ranges         = [];
		// error message
	  	this.show_error    = true;  
	  	this.error_class   = 'negative';
	  	this.error_title   = 'Invalid Data';
        this.error_message = `Inalid numeric value found at sample ${invalid_sample+1}.`;
	  	this.$emit('disableNext');
	  	return;  	
	  }
	  else {
	  	this.ranges_enabled = true;
	  }
	  // validate minimum length
	  if(tmp_time.length < 50) {
	  	// error message
	  	this.show_error    = true;  
	  	this.error_class   = 'negative';
	  	this.error_title   = 'Invalid Data';
        this.error_message = `Not enough samples. At least 50 valid samples are required.`;
	  	this.$emit('disableNext');
	  	return;
	  }
	  // validate time order
	  for(i = 1; i < this.time.length; i++) {
	  	if(tmp_time[i] <= tmp_time[i-1]) {
	  		// error message
	  		this.show_error    = true;  
	  		this.error_class   = 'negative';
	  		this.error_title   = 'Invalid Data';
            this.error_message = `Time is not in order. Time sample ${i+1} (value ${tmp_time[i]}) is smaller than sample ${i-1+1} (value ${tmp_time[i-1]})`;
	  	    this.$emit('disableNext');
	  	    return;
	  	}
	  }
	  // set nnew vectors for charts
	  this.time  .copyFrom(tmp_time  );
	  this.input .copyFrom(tmp_input );
	  this.output.copyFrom(tmp_output);
	  // success
	  this.ranges_enabled = true;
	  this.show_error     = true;  
      this.error_class    = 'success';
      this.error_title    = 'Valid Data';
      this.error_message  = `The data is correct. Click on the green 'Next' botton to continue.`;
      setTimeout(() => {
      	// autoclose if still valid
      	if(this.error_class == 'success') {
      		this.show_error = false;
      	}
      }, 5000);
      // success if arrive here
      this.$emit('enableNext');
    },
    on_afterSelection(row_start, row_end) {  	
    	// switch if neccesary
    	if(row_start > row_end) {
    		var row_tmp = row_start;
    		row_start   = row_end  ;
    		row_end     = row_tmp  ;
    	}
    	// get memory
    	this.old_row_start = typeof this.old_row_start != 'undefined' ? this.old_row_start : -1;
    	this.old_row_end   = typeof this.old_row_end   != 'undefined' ? this.old_row_start : -1;
    	// check if changed
    	if(this.old_row_start == row_start && this.old_row_end == row_end) {
    		return;
    	}
    	// update
    	this.old_row_start = row_start;
    	this.old_row_end   = row_end;	
    	// [ALT]
    	// transform to downsampled
    	this.left_row_start = row_start % this.step_data;
		this.left_row_end   = row_end   % this.step_data;
    	row_start = Math.floor(row_start/this.step_data);
    	row_end   = Math.floor(row_end/this.step_data);
    	// roundup
    	if(Math.abs(this.old_row_start - this.time.length) < this.step_data) {
			row_start = this.length_data-1;
    	}
	  	if(Math.abs(this.old_row_end - this.time.length) < this.step_data) {
			row_end = this.length_data-1;
    	}
    	// TODO : round down?
    	// set to chart
    	this.ranges   = [[0, row_start, row_end]];
    },
    getHotColumns() {
      var retArr = [];
      for(var i = 0; i < 3; i++) {
        retArr.push({
          validator: (newVal, isOkCallback) => {
            // validator (NaN if not parsed correctly)
            isOkCallback(!isNaN(parseFloat(newVal)));   
          },
          // just mark as red if invalid
          allowInvalid : true
        });
      }
      return retArr;	  
    },
    getColData(source, col_num) {
      var arr = [];
      for(var i = 0; i < source.length; i++) {
        var row = source[i];
        var val = parseFloat(row[col_num]);
        //arr.push(isNaN(val) ? 0.0 : val); // TODO : allow NaN and clear elsewhere
        arr.push(val);
      }
      return arr;
    },
    tableInsertRows(start, num) {
    	if(start < 0) { start = 0; }
    	for(var i = 0; i < num; i++) {
			this.hot_data.splice(start, 0, ['', '', '']);    		
    	}
    	// manual update
    	this.on_afterChange();
    	// left menu
		this.$emit('latestStep');
    },
    tableRemoveRows(row_start, row_end) {
    	// switch if neccesary
    	if(row_start > row_end) {
    		var row_tmp = row_start;
    		row_start   = row_end  ;
    		row_end     = row_tmp  ;
    	}
    	this.hot_data.splice(row_start, row_end-row_start+1);
    	// manual update
    	this.on_afterChange();
    	// left menu
		this.$emit('latestStep');
    },
    clearTableClicked() {
    	this.hot_data = [['','','']]; 
    	this.on_afterChange();
    	this.$emit('latestStep');
    },
    loadTestData() {
    	// use test data
  		this.hot_data.copyFrom(test_data);
		// init time, input, output
		this.on_afterChange();
    },
  },
  watch: {
	ranges: function(){
		if (!this.rangedChangedThrottle) {
			var rangedChanged = () => {	
				// get downsampled values
				var new_row_start = this.ranges.length > 0 ? this.ranges[0][1] : -1;
				var new_row_end   = this.ranges.length > 0 ? this.ranges[0][2] : -1;
				// transform to upsampled
				new_row_start = new_row_start * this.step_data + (this.left_row_start ? this.left_row_start : 0);
				new_row_end   = new_row_end   * this.step_data + (this.left_row_end   ? this.left_row_end   : 0);
				// limit 
				if(new_row_start >= this.time.length) {
					new_row_start = this.time.length - 1;
				}
				if(new_row_end >= this.time.length) {
					new_row_end = this.time.length - 1;
				}
				// get old values
				var old_row_start = this.table.getSelected() ? this.table.getSelected()[0][0] : -1;
				var old_row_end   = this.table.getSelected() ? this.table.getSelected()[0][2] : -1;
				// switch if neccesary
				if(old_row_start > old_row_end) {
					var old_row_tmp = old_row_start;
					old_row_start   = old_row_end  ;
					old_row_end     = old_row_tmp  ;
				}
				// avoid infinite loop
				if(new_row_start != old_row_start) {
					old_row_end   = old_row_end   >= 0 ? old_row_end   : new_row_end  ; // fix
					this.table.selectCell(new_row_start, 0, old_row_end, 2, true, true);
				}
				if(new_row_end != old_row_end) {
					old_row_start = old_row_start >= 0 ? old_row_start : new_row_start; // fix
					this.table.selectCell(old_row_start, 0, new_row_end, 2, true, true);
				}	
			};
			this.rangedChangedThrottle = throttle(rangedChanged, 200, { leading : false });
		}
		// call throttle func
		this.rangedChangedThrottle();
	},
  },
  components: {
    'v-hot-table' : HotTable,
  }
};

// ------------------------------------------------------------------------
return ImportDataView;
}