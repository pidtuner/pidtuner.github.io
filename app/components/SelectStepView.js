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
      max_chart_len    : 300
    }
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
    range_list: function() {
		// update or cache
		var steps_arr = [];
		if(this.cached_range_list.length <= 0) {
			// copy
			var arma_time   = [];
			var arma_input  = [];
			var arma_output = [];
			for(var i = 0; i < this.time.length; i++) {
				arma_time  .push([[this.time  [i], 0]]);
				arma_input .push([[this.input [i], 0]]);
				arma_output.push([[this.output[i], 0]]);
			}
			// instantiate arma matrices
			var t = Arma.CxMat.from_array(arma_time  );
			var u = Arma.CxMat.from_array(arma_input );
			var y = Arma.CxMat.from_array(arma_output);
			// fix dimansions
			if(t.get_n_cols() != 1) {
				t = t.t();
			}
			if(u.get_n_cols() != 1) {
				u = u.t();
			}
			if(y.get_n_cols() != 1) {
				y = y.t();
			}
			// possible sample period
			var ts     = Arma.CxMat.zeros(1, 1);
			ts.set_at(0, 0, t.at(1, 0).rest(t.at(0, 0)));
			// handle possible non-uniform time vector
			if(!pid.ts_uniform(t)) {
				var t_new   = new Arma.cx_mat();
				var u_new   = new Arma.cx_mat();
				var y_new   = new Arma.cx_mat();
				var ts_real = pid.resample(t, u, y, -1.0, t_new, u_new, y_new);
				ts.set_at(0, 0, new Arma.cx_double(ts_real, 0.0));
				t = t_new;
				u = u_new;
				y = y_new;
			}
			// update uniform time, input and output
			this.uniform_time  .splice(0, this.uniform_time.length  );
			this.uniform_input .splice(0, this.uniform_input.length );
			this.uniform_output.splice(0, this.uniform_output.length);
			var uniform_t = t.real().to_array().map(arr => arr[0]);
			var uniform_u = u.real().to_array().map(arr => arr[0]);
			var uniform_y = y.real().to_array().map(arr => arr[0]);
			this.uniform_time  .copyFrom(uniform_t);
			this.uniform_input .copyFrom(uniform_u);
			this.uniform_output.copyFrom(uniform_y);
			// find steps
			var steps = new Arma.cx_mat();
			/* TODO
			BUGS when at least the first 5 samples of u are not the same, the find_steps algorithm fails
			*/
			pid.find_steps(t, u, y, steps);		
			// update cache
			steps_arr = steps.to_array();
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
	}, // range_list
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
	setRange(range) {
		// [ALT] : range arg is normal
		//         this.selected_range is also normal
		//         this.ranges is downsampled
		// set selected range for list and display
		this.using_list_range = true;
		// do it the vue way
		this.selected_range.splice(0, 2);
		this.selected_range.push(range[0]);
		this.selected_range.push(range[1]);
		// transform to downsampled
		this.left_row_start = range[0] % this.step_data;
		this.left_row_end   = range[1] % this.step_data;
		var row_start = Math.floor(range[0] / this.step_data);
		var row_end   = Math.floor(range[1] / this.step_data);
		// roundup
    	if(Math.abs(range[0] - this.uniform_time.length) < this.step_data) {
			row_start = this.length_data-1;
    	}
	  	if(Math.abs(range[1] - this.uniform_time.length) < this.step_data) {
			row_end = this.length_data-1;
    	}
    	// TODO : round down?
		// set as selected range for chart
		this.ranges.splice(0, 1, [0, row_start, row_end]);
		// as soon as any range is selected, we can continue
		this.$emit('enableNext');
	},	
	isRangeEq(range, selected_range) {
		return range.isEqual(selected_range);
	}
  },
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
				// set selected range for list and display
				if(this.selected_range[0] != row_start || this.selected_range[1] != row_end) {
					this.using_list_range = false;
					// do it the vue way
					this.selected_range.splice(0, 2);
					this.selected_range.push(row_start);
					this.selected_range.push(row_end);
				}
			};
			this.rangedChangedThrottle = throttle(rangedChanged, 200);
		}
		// call throttle func
		this.rangedChangedThrottle();
	},
  },
};

// ------------------------------------------------------------------------
return SelectStepView;
}