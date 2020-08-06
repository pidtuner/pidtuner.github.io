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
          copyPaste            : true ,
          colHeaders           : ['Time','Input','Output'],
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
            this.ranges.splice(0, this.ranges.length);
	        this.table.selection.deselect();
            // left menu
            this.$emit('latestStep');
          },
          afterSelection : (row_start, col_start, row_end, col_end) => {
          	// fix, after empty arrays
          	if(this.time.length <= 0 || Math.abs(col_end-col_start) != 2) {
          		this.ranges.splice(0, this.ranges.length);
          		return;
          	}
          	this.on_afterSelection(row_start, row_end);
          },
          beforePaste: (data) => {
          	this.ranges.splice(0, this.ranges.length);
          	if(data.length <= 0) {
          		return;
          	}
          	// use papa parse only if hot failed to parse
          	if(data[0].length == 1) {
				var results = Papa.parse(data.flat(1).join('\n'), {
					keepEmptyRows: false,
                    skipEmptyLines: true
				});
      			if(results.data[0].length <= 1) {
      				return;
      			}
				else {
					data.copyFrom(results.data); 					
				}      		
          	}
          },
      },
      hot_columns   : [
          {              
			  validator: 'numeric',
			  allowInvalid : true // mark as red if invalid     
          },
          {
              validator: 'numeric',
			  allowInvalid : true             	
          },
          {
              validator: 'numeric',
			  allowInvalid : true            	
          }
      ],
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
  	this.hot_data.splice(0, this.hot_data.length);
  	if(this.time.length > 0) {  
		// NOTE : need to clone data or it wont work in vue
		this.updateHotData();
  	}
  	else {
  		// use test data
  		this.hot_data.copyFrom(test_data);
  	}
    // copy hot instance
    this.table = this.$refs.hot.hotInstance;
    // init time, input, output
    this.on_afterChange();
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
              this.clearTableClicked();
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
  }, // computed
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
	  	this.ranges.splice(0, this.ranges.length);
		// error message
	  	this.show_error    = true;  
	  	this.error_class   = 'negative';
	  	this.error_title   = 'Invalid Data';
        this.error_message = `Invalid numeric value found at sample ${invalid_sample+1}.`;
	  	this.$emit('disableNext');
	  	return;  	
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
	  for(i = 1; i < tmp_time.length; i++) {
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
	  // set new vectors for charts
	  var any_change = false;
	  if(!this.time  .isEqual(tmp_time  )) { this.time  .copyFrom(tmp_time  ); any_change = true; }
	  if(!this.input .isEqual(tmp_input )) { this.input .copyFrom(tmp_input ); any_change = true; }
	  if(!this.output.isEqual(tmp_output)) { this.output.copyFrom(tmp_output); any_change = true; }
	  if(any_change) { 
	      // force hot cell validation because getColData might have changed the text	      
	      this.updateHotData(); 
	      this.table.validateCells(); 	      
	  }
	  // success
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
    	var down_row_start = Math.floor(row_start/this.step_data);
    	var down_row_end   = Math.floor(row_end/this.step_data);
    	// roundup
    	if(Math.abs(this.old_row_start - this.time.length) < this.step_data) {
			down_row_start = this.length_data-1;
    	}
	  	if(Math.abs(this.old_row_end - this.time.length) < this.step_data) {
			down_row_end = this.length_data-1;
    	}
    	// set to chart
    	this.ranges.copyFrom([[0, down_row_start, down_row_end]]);
    },
    getColData(source, col_num) {
      var arr = [];
      for(var i = 0; i < source.length; i++) {
        var row = source[i];
        var val = row[col_num];
        if(typeof val === "string")
        {
			var num_commas = val.split(',').length - 1;
			var num_points = val.split('.').length - 1;
			if(num_commas > 0)
			{
				// assume commma is decimal separator if is the only existing separator
				// else find right-most separator and use that one, cleaning the rest
				if(num_commas == 1 && num_points != 1)
				{
					val = val.replace(',', '.')
				}       	
				else
				{
					var comma_last_pos = val.lastIndexOf(",");
					var point_last_pos = val.lastIndexOf(".");
					var separator_pos = comma_last_pos > point_last_pos ? comma_last_pos : point_last_pos;
					val = val.replace(',', '');
					val = val.replace('.', '');
					val = [val.slice(0, separator_pos), '.', val.slice(separator_pos)].join('');
				}
			}
			val = parseFloat(val);
        }
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
    	this.ranges.splice(0, this.ranges.length);
    	this.time  .splice(0, this.time  .length);
    	this.input .splice(0, this.input .length);
    	this.output.splice(0, this.output.length);
    	// fix : leave at least two rows after clearing to make easier import
    	this.hot_data.copyFrom([['0.0','0.0','0.0'],['0.1','0.0','0.0']]); 
    	this.time  .splice(0, 0, [0.1]);
    	this.input .splice(0, 0, [0.0]);
    	this.output.splice(0, 0, [0.0]);
    	this.time  .splice(0, 0, [0.0]);
    	this.input .splice(0, 0, [0.0]);
    	this.output.splice(0, 0, [0.0]);
    	this.on_afterChange();
    	this.$emit('latestStep');
    	this.table.validateCells(); 
    	this.table.selection.deselect();
    	this.table.scrollViewportTo(0, 0);
    },
    loadTestData() {
    	// use test data
  		this.hot_data.copyFrom(test_data);
		// init time, input, output
		this.on_afterChange();
    },
    updateHotData() {
    	this.hot_data.splice(0, this.hot_data.length);
    	for(var i = 0; i < this.time.length; i++) {
			this.hot_data.push([this.time[i], this.input[i], this.output[i]]);
		}
    },
    throttle_updateHotData() {
    	// create throttle func if not exists
  		if(!this.throttle_updateHotDataInternal) {
			this.throttle_updateHotDataInternal = throttle(() => {
				this.updateHotData();
				this.on_afterChange();
			}, 200, { leading : false });
  		}
  		// call 
  		this.throttle_updateHotDataInternal();
    },
  }, // methods
  watch: {
	ranges: function(){
		if (!this.rangedChangedThrottle) {
			var rangedChanged = () => {	
			    // ignore if no ranges
			    if(this.ranges.length <= 0) {			    	
			    	return;
			    }
				// get downsampled values
				var new_row_start = this.ranges[0][1];
				var new_row_end   = this.ranges[0][2];
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
				if(old_row_end && new_row_start != old_row_start) { // fix : test for old_row_end not null (happens when hot empty)
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
	time: function(){
	  var tmp_time = this.getColData(this.hot_data, 0);
	  if(this.time.isEqual(tmp_time  )) { return; }
      this.throttle_updateHotData();
    },
    input: function(){
      var tmp_input  = this.getColData(this.hot_data, 1);
      if(this.input.isEqual(tmp_input )) { return; }
      this.throttle_updateHotData();
    },
    output: function(){
      var tmp_output = this.getColData(this.hot_data, 2);
      if(this.output.isEqual(tmp_output)) { return; }
      this.throttle_updateHotData();
    },
  }, // watch
  components: {
    'v-hot-table' : Handsontable.vue.HotTable,
  }
};

// ------------------------------------------------------------------------
return ImportDataView;
}