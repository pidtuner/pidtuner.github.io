// get current file URL
var scripts = document.getElementsByTagName("script");
var src     = scripts[scripts.length-1].src;
var listUrl = src.split('/');
listUrl.pop();
listUrl.push("");
var scriptTunePidViewDir = listUrl.join("/");

getTunePidViewComponent = async function() {
// ------------------------------------------------------------------------

// get template for component
var templTunePidView;
await $.asyncGet(scriptTunePidViewDir + "TunePidView.html", function(data){
    templTunePidView = data;
}.bind(this));

var TunePidView = {
  template: templTunePidView,
  props: {
  	// algorithm input 
  	uniform_time: {
      type    : Array,
      required: true
    },
    selected_model: {
      type    : Object,
      required: true
    },
    // algorithm input/output 
    cached_gains_slider: {
      type    : Number,
      required: true
    },
    cached_time_slider: {
      type    : Number,
      required: true
    },
    cached_r_size: {
      type    : Number,
      required: true
    },
    cached_d_size: {
      type    : Number,
      required: true
    },
    // algorithm output 
    pid_gains: {
      type    : Array,
      required: true
    },
    pidsim_time: {
      type    : Array,
      required: true
    },
    pidsim_input: {
      type    : Array,
      required: true
    },
    pidsim_output: {
      type    : Array,
      required: true
    },
    pidsim_ref: {
      type    : Array,
      required: true
    },
    pidsim_dist: {
      type    : Array,
      required: true
    },
  },
  data() {
    return {
      r_time        : 0.01,
      d_time        : 0.51,
      // helpers
      slider_res           : 50, // slider native resolution to from -slider_res to +slider_res
      slider_gains_enabled : true,
      max_chart_len        : 300,
    }
  },
  mounted: function() {
	// setup sliders
	$(this.$refs.slider_gains).range({
		min   : -this.slider_res,
		max   : +this.slider_res,
		start : this.cached_gains_slider,
		onChange: (value, meta) => {
			if(meta.triggeredByUser) {
				//this.cached_gains_slider = value;
				this.$emit('updateGainsSlider', value);
			}
		}
    });
    $(this.$refs.slider_time).range({
		min   : -this.slider_res,
		max   : +this.slider_res,
		start : this.cached_time_slider,
		onChange: (value, meta) => {
			if(meta.triggeredByUser) {
				//this.cached_time_slider = value;
				this.$emit('updateTimeSlider', value);
			}
		}
    });
	// slider fix on window resize
    this.resizeHandler = throttle(() => {
    	$(this.$refs.slider_gains).range('set value', this.cached_gains_slider);
    	$(this.$refs.slider_time ).range('set value', this.cached_time_slider );
	}, 200);
    $(window).on('resize', this.resizeHandler);
    // check if necessary to compute stuff for first time
    if(this.pid_gains.length <= 0) {
		// perform initial tuning
		this.tunePID();
    }
    else {
    	// create arma_gains from pid_gains
    	this.createArmaGains();
    }
    if(this.pidsim_time.length <= 0) {
		// perform initial simulation
		this.makeSimulation();
    }
	// emit step loaded
    this.$emit('stepLoaded');
  },
  destroyed: function() {
  	this.arma_gains.destroy();
	$(window).off('resize', this.resizeHandler);
  },
  computed: {
    input_chart_data: function() {
	  // first create data
	  var in_data      = [];
	  var in_data_dist = [];
	  // [ALT]
	  var i = 0;	  
	  while(true) {
	  	var idx = i*this.step_data;
	  	if(idx >= this.pidsim_time.length) {
	  		idx = this.pidsim_time.length -1 ;
	  	}
	  	in_data.push({
	  		x : this.pidsim_time [idx],
	  		y : this.pidsim_input[idx]
	  	});
	  	in_data_dist.push({
	  		x : this.pidsim_time [idx],
	  		y : /*this.pidsim_input[idx] +*/ this.pidsim_dist[idx]
	  	});
	  	if(idx == this.pidsim_time.length-1) {
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
		},
	  	{
		  label          : 'Disturbance',
		  data           : in_data_dist,
		  borderColor    : 'rgba(234, 109, 52, 1)',
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
	  var out_data     = [];
	  var out_data_ref = [];
	  // [ALT]
	  var i = 0;	  
	  while(true) {
	  	var idx = i*this.step_data;
	  	if(idx >= this.pidsim_time.length) {
	  		idx = this.pidsim_time.length -1 ;
	  	}
	  	out_data.push({
	  		x : this.pidsim_time  [idx],
	  		y : this.pidsim_output[idx]
	  	});
	  	out_data_ref.push({
	  		x : this.pidsim_time  [idx],
	  		y : this.pidsim_ref   [idx]
	  	});
	  	if(idx == this.pidsim_time.length-1) {
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
		},
	  	{
		  label          : 'Reference',
		  data           : out_data_ref,
		  borderColor    : 'rgba(234, 109, 52, 1)',
		}
	  ];
	  // finally chart data
	  var out_chart_data = {
         labels  : this.getLabels(out_data),
         datasets: out_datasets,
      };
      return out_chart_data;
    }, // output_chart_data
    gains_scale : function() {
    	// y = Math.pow(10, x) maps [-1, +1] to [0.1, 10]
    	// NOTE : minus sign, inverted in this case, because 0.1 will yield faster dynamics than 10
		return Math.pow(10, (-this.cached_gains_slider)/this.slider_res);
    },
    time_scale : function() {
    	// at most 5x the simulation length
		return Math.pow(5, this.cached_time_slider/this.slider_res);
    },
    step_data : function() {
    	// [ALT]
    	return Math.ceil(this.pidsim_time.length/this.max_chart_len);
    },
    length_data : function() {
    	// [ALT]
    	return this.output_chart_data.datasets[0].data.length;
    },
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
	tunePID() {
		// get shallow copy of array to reorder
		var models = [];
		for(var i = 0; i < this.$parent.arma_models.length; i++) {
			models.push(this.$parent.arma_models[i]);
		}
		// reorder with selected model first
		while(models[0].get_type() != this.selected_model.type) {
			var model = models.pop();
			models.unshift(model);
		}
		// get ts
		var ts_real = this.uniform_time[1] - this.uniform_time[0];
		var ts      = Arma.CxMat.zeros(1, 1);
		ts.set_at(0, 0, new Arma.cx_double(ts_real, 0.0));
		// PID tuning
		if(!this.arma_gains) {
			this.createArmaGains();
		}
		var k_tune = Arma.CxMat.zeros(1, 1);
		k_tune.set_at(0, 0, new Arma.cx_double(this.gains_scale, 0));
		pid.tune_pid(models[0], models[1], models[2], models[3], models[4],
					 ts, k_tune, true, this.arma_gains);	
		// get gains
		var gains_r = this.arma_gains.real().to_array().map(arr => arr[0]);
		var Kp      = gains_r[0];
		var Ti      = gains_r[1];
		var Td      = gains_r[2];
		var I       = gains_r[3];
		var D       = gains_r[4];
		var du_lim  = gains_r[5];
		// create array if empty
		if(this.pid_gains.length <= 0) {
			this.pid_gains
			.copyFrom([{
					    name    : 'Kp',
					    val     : 0.0 ,
					    units   : '[-]',
					    descrip : 'Proportional Gain',
					    editable: true
					   },
					   {
					    name    : 'Ti',
					    val     : 0.0 ,
					    units   : '[sec]',
					    descrip : 'Integral Time',
					    editable: true
					   },
					   {
					    name    : 'Td',
					    val     : 0.0 ,
					    units   : '[sec]',
					    descrip : 'Derivative Time',
					    editable: true
					   },
					   {
					    name    : 'I',
					    val     : 0.0,
					    units   : '[-]',
					    descrip : 'Integral Gain',
					    editable: false
					   },
					   {
					    name    : 'D',
					    val     : 0.0,
					    units   : '[-]',
					    descrip : 'Derivative Gain',
					    editable: false
					   },
					   {
					    name    : 'du_lim',
					    val     : 0.0,
					    units   : '[-]',
					    descrip : 'Input Rate Limit',
					    editable: true
					   }]);
		}		
		// update gains in vue
		Vue.set(this.findGain('Kp'), 'val', Kp);
		Vue.set(this.findGain('Ti'), 'val', Ti);
		Vue.set(this.findGain('Td'), 'val', Td);	
		Vue.set(this.findGain('I') , 'val', I );	
		Vue.set(this.findGain('D') , 'val', D );	
		Vue.set(this.findGain('du_lim'), 'val', du_lim);	
	},
	makeSimulation() {
		// get ts
		var ts_real = this.uniform_time[1] - this.uniform_time[0];
		var ts      = Arma.CxMat.zeros(1, 1);
		ts.set_at(0, 0, new Arma.cx_double(ts_real, 0.0));
		// get gains
		var gains_r = this.arma_gains.real().to_array().map(arr => arr[0]);
		var Kp      = gains_r[0];
		var Ti      = gains_r[1];
		var Td      = gains_r[2];
		var I       = gains_r[3];
		var D       = gains_r[4];
		var du_lim  = gains_r[5];
		// define PID limits
		var limits = Arma.CxMat.zeros(4, 1);
		limits.set_at(0, 0, new Arma.cx_double(-Infinity, 0.0));
		limits.set_at(1, 0, new Arma.cx_double(+Infinity, 0.0));
		limits.set_at(2, 0, new Arma.cx_double(-du_lim  , 0.0));
		limits.set_at(3, 0, new Arma.cx_double(+du_lim  , 0.0));

		// get simulation time
		var model = this.$parent.arma_models.find((model) => { return model.get_type() == this.selected_model.type });
		var theta = Arma.CxMat.zeros(1, 1);
		pid.get_theta(model.get_type(), model.get_params(), theta);
		theta = theta.real().to_array()[0][0];
		var ts_r         = ts.real().to_array()[0][0];
		var stime        = 160.0*Math.max(theta, ts_r);
		var sim_length_r = Math.ceil(this.time_scale * Math.ceil(stime/ts_r));

		
		// NOTE : limit simulation resolution to N samples to avoid ui feeze
		//        cannot be too small or oscillations appear in the simulation
		var N        = 1200;
		var sim_ts   = {};
		var sim_ts_r = 0;
		if(sim_length_r > N) {
			var new_stime = ts_r * sim_length_r;
			sim_ts_r = new_stime/N;
			sim_ts = Arma.CxMat.zeros(1, 1);
			sim_ts.set_at(0, 0, new Arma.cx_double(sim_ts_r, 0.0));
			sim_length_r = N;
		}
		else {
			sim_ts   = ts;
			sim_ts_r = ts_r;
		}

		// arma vars for simulation
		var sim_length   = Arma.CxMat.zeros(1, 1);
		sim_length.set_at(0, 0, new Arma.cx_double(sim_length_r, 0.0));

		// Create Reference
		this.pidsim_ref.splice(0, this.pidsim_ref.length);
		var r_sim = Arma.CxMat.zeros(sim_length_r, 1);
		for(var i = 0; i < sim_length_r; i++) {
			// ref value
			var r_value = i > Math.ceil(this.r_time*sim_length_r) ? this.cached_r_size : 0.0;
			// for chart
			this.pidsim_ref.push(r_value);
			// for simulation
			 r_sim.set_at(i, 0, new Arma.cx_double(r_value, 0)); 
		}
		// Create Input Disturbance
		/*
		// TODO : [BUG] dstep = cached_d_size = -Infinity when theta == 0 ?
		var dstep = new Arma.cx_mat();
		pid.dist_step(model.get_type(), model.get_params(), dstep);
		this.cached_d_size = dstep.at(0, 0).real();
		if(this.cached_d_size == Infinity || this.cached_d_size == -Infinity) {
			this.cached_d_size = 0.0;
		}
		*/
		this.pidsim_dist.splice(0, this.pidsim_dist.length);
		var d_sim = Arma.CxMat.zeros(sim_length_r, 1);
		for(var i = 0; i < sim_length_r; i++) {
			// ref value
			var d_value = i > Math.ceil(this.d_time*sim_length_r) ? this.cached_d_size : 0.0;
			// for chart
			this.pidsim_dist.push(d_value);
			// for simulation
			 d_sim.set_at(i, 0, new Arma.cx_double(d_value, 0)); 
		}

		// make simulation
		var u_sim = new Arma.cx_mat();
		var y_sim = new Arma.cx_mat();
		pid.sim_pid(model.get_type(), model.get_params(), this.arma_gains, limits, sim_ts, sim_length, r_sim, d_sim, u_sim, y_sim);

		this.pidsim_time  .splice(0, this.pidsim_time  .length);
		this.pidsim_input .splice(0, this.pidsim_input .length);
		this.pidsim_output.splice(0, this.pidsim_output.length);

		var u_sim_r = u_sim.real().to_array().map(arr => arr[0]);
		var y_sim_r = y_sim.real().to_array().map(arr => arr[0]);

		this.pidsim_input .copyFrom(u_sim_r);
		this.pidsim_output.copyFrom(y_sim_r);
		for(var i = 0; i < sim_length_r; i++) {
			this.pidsim_time.push(i * sim_ts_r);
		}
	},
	setOriginalGains() {
		// enable gains slider 
		this.slider_gains_enabled = true;
		// reset slider
		if(this.cached_gains_slider == 0) {
			// have to force manually here
			this.tunePID();
			this.makeSimulation();
		}
		else {
			this.$emit('updateGainsSlider', 0);
			$(this.$refs.slider_gains).range('set value', 0);			
		}
	},
	findGain(name) {
		return this.pid_gains.find((gain) => { return gain.name == name });
	},
	createArmaGains() {
		if(!this.arma_gains) {
			this.arma_gains = Arma.CxMat.zeros(6, 1);
			this.arma_gains.persist();
		}
		if(this.pid_gains.length > 0) {
			this.loadArmaGains();
		}
	},
	loadArmaGains() {
		var Kp      = this.findGain('Kp'    ).val;
		var Ti      = this.findGain('Ti'    ).val;
		var Td      = this.findGain('Td'    ).val;
		var I       = this.findGain('I'     ).val;
		var D       = this.findGain('D'     ).val;
		var du_lim  = this.findGain('du_lim').val;
		// set values
		this.arma_gains.set_at(0, 0, new Arma.cx_double(Kp    , 0.0));
		this.arma_gains.set_at(1, 0, new Arma.cx_double(Ti    , 0.0));
		this.arma_gains.set_at(2, 0, new Arma.cx_double(Td    , 0.0));
		this.arma_gains.set_at(3, 0, new Arma.cx_double(I     , 0.0));
		this.arma_gains.set_at(4, 0, new Arma.cx_double(D     , 0.0));
		this.arma_gains.set_at(5, 0, new Arma.cx_double(du_lim, 0.0));
	},
	updateGain(name) {
		if(typeof this.findGain(name).val == "string") {
			Vue.set(this.findGain(name), 'val', parseFloat(this.findGain(name).val));
		}
		// check if needed to update other gains
		if(name == 'Kp' || name == 'Ti' || name == 'Td') {
			var Kp = this.findGain('Kp').val;
			var Ti = this.findGain('Ti').val;
			var Td = this.findGain('Td').val;
			var I  = Kp / Ti;
       		var D  = Kp * Td;
       		Vue.set(this.findGain('I') , 'val', I );	
			Vue.set(this.findGain('D') , 'val', D );			
		}	
		// disable gains slider 
		this.slider_gains_enabled = false;
		// update simulation
		this.loadArmaGains();
		this.makeSimulation();		
	},
	updateRefSize() {
		this.$emit('update_cached_r_size', parseFloat( this.$refs.r_size.value ));
	},
	updateDistSize() {
		this.$emit('update_cached_d_size', parseFloat( this.$refs.d_size.value ));
	},
  }, // methods
  watch: {
	gains_scale: function(){
		// create throttle func if not exists
		if(!this.throttle_gains_scale) {
			this.throttle_gains_scale = throttle(() => {
				this.tunePID();
				this.makeSimulation();				
			}, 500, { leading : false });
		}
		// call throttle func
		this.throttle_gains_scale();
	},
	time_scale: function(){
		// create throttle func if not exists
		if(!this.throttle_time_scale) {
			this.throttle_time_scale = throttle(() => {
				this.makeSimulation();			
			}, 500, { leading : false });
		}
		// call throttle func
		this.throttle_time_scale();
	},
	cached_r_size: function(){
		this.makeSimulation();
	},
	cached_d_size: function(){
		this.makeSimulation();
	},
  }
};

// ------------------------------------------------------------------------
return TunePidView;
}