// get current file URL
var scripts = document.getElementsByTagName("script");
var src     = scripts[scripts.length-1].src;
var listUrl = src.split('/');
listUrl.pop();
listUrl.push("");
var scriptSelectStepViewDir = listUrl.join("/");

getSelectStepViewComponent = async function() {
// ------------------------------------------------------------------------

// get template for component
var templSelectStepView;
await $.asyncGet(scriptSelectStepViewDir + "SelectStepView.html", function(data){
    templSelectStepView = data;
}.bind(this));

var SelectStepView = {
  template: templSelectStepView,
  props: {
  	// algorithm input
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
    // algorithm input/output
  	cached_range_list: {
      type    : Array,
      required: true
    },    
    // algorithm output
    selected_range: {
      type    : Array,
      required: true
    },
    uniform_time: {
      type    : Array,
      required: true
    },
    uniform_input: {
      type    : Array,
      required: true
    },
    uniform_output: {
      type    : Array,
      required: true
    },
  },
  data() {
    return {
      ranges           : [],   // show only one range at a time in charts
      using_list_range : true, // whether a range form the list is being used
      max_chart_len    : 300,
      range_list       : []
    }
  },
  mounted: async function() {
	this.range_list = await this.computeRangeList();
  },
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
	setRange(range) {
		// [ALT] : range arg is normal
		//         this.selected_range is also normal
		//         this.ranges is downsampled
		// set selected range for list and display
		this.using_list_range = true;
		// early exit
		if(range.isEqual(this.selected_range)) {
			return;
		}
		// do it the vue way
		this.selected_range.splice(0, 2);
		this.selected_range.push(range[0]);
		this.selected_range.push(range[1]);
	},	
	isRangeEq(range, selected_range) {
		return range.isEqual(selected_range);
	},
	async computeRangeList() {
		// update or cache
		var steps_arr = [];
		if(this.cached_range_list.length <= 0) {
			// update in worker, check error
			var result = await PidWorker.computeRangeList({
				time   : this.time  ,
				input  : this.input ,
				output : this.output
			});
			// check if error
			if(result.error) {
				// show error dialog
				this.$nextTick( () => {
					$(this.$refs.dialog).modal('show');
				});
				return steps_arr;
			}
			// copy results
			this.uniform_time  .splice(0, this.uniform_time.length  );
            this.uniform_input .splice(0, this.uniform_input.length );
            this.uniform_output.splice(0, this.uniform_output.length);
            this.uniform_time  .copyFrom(result.uniform_t);
            this.uniform_input .copyFrom(result.uniform_u);
            this.uniform_output.copyFrom(result.uniform_y);
			steps_arr.copyFrom(result.steps_arr);
            // save in cache
            this.cached_range_list.copyFrom(steps_arr);
		}
		else {
			// use cache
			steps_arr.copyFrom(this.cached_range_list);
		}
		// set first range
        this.$nextTick(function() {
			this.setRange( this.selected_range.length <= 0 ? steps_arr[0] : this.selected_range.clone() ); 
			// emit step loaded
    		this.$emit('stepLoaded');        
        });
		// return
		return steps_arr;
	}
  }, // methods
  watch: {
	ranges: function(){
		if (!this.rangedChangedThrottle) {
			var rangedChanged = () => {
				var row_start = this.ranges.length > 0 ? this.ranges[0][1] : -1;
				var row_end   = this.ranges.length > 0 ? this.ranges[0][2] : -1;
				// transform to upsampled
				row_start = row_start * this.step_data + this.left_row_start;
				row_end   = row_end   * this.step_data + this.left_row_end;
				// limit 
				if(row_start >= this.uniform_time.length) {
					row_start = this.uniform_time.length - 1;
				}
				if(row_end >= this.uniform_time.length) {
					row_end = this.uniform_time.length - 1;
				}
				
				// early exit
				if(isNaN(row_start) || isNaN(row_end)) {
					return;
				}
				if(this.selected_range[0] == row_start && this.selected_range[1] == row_end) {
					return;
				}
				// set selected range for list and display
				this.using_list_range = false;
				// do it the vue way
				this.selected_range.splice(0, 2);
				this.selected_range.push(row_start);
				this.selected_range.push(row_end);
			};
			this.rangedChangedThrottle = throttle(rangedChanged, 200);
		}
		// call throttle func
		this.rangedChangedThrottle();
	},
	selected_range: function(){
		// transform to downsampled
		this.left_row_start = this.selected_range[0] % this.step_data;
		this.left_row_end   = this.selected_range[1] % this.step_data;
		var row_start = Math.floor(this.selected_range[0] / this.step_data);
		var row_end   = Math.floor(this.selected_range[1] / this.step_data);
		// roundup
    	if(Math.abs(this.selected_range[0] - this.uniform_time.length) < this.step_data) {
			row_start = this.length_data-1;
    	}
	  	if(Math.abs(this.selected_range[1] - this.uniform_time.length) < this.step_data) {
			row_end = this.length_data-1;
    	}
    	// early exit
    	if(isNaN(row_start) || isNaN(row_end)) {
    		return;
    	}
    	// TODO : round down?
		// set as selected range for chart
		this.ranges.splice(0, 1, [0, row_start, row_end]);
		// as soon as any range is selected, we can continue
		this.$emit('enableNext');
	},
  }, // watch
};

// ------------------------------------------------------------------------
return SelectStepView;
}