// get current file URL
var scripts = document.getElementsByTagName("script");
var src     = scripts[scripts.length-1].src;
var listUrl = src.split('/');
listUrl.pop();
listUrl.push("");
var scriptTunePidViewDir = listUrl.join("/");

getTunePidViewComponent = async function() {
// ------------------------------------------------------------------------

await getLogChartViewComponent();

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
    margins: {
      type    : Array,
      required: true
    },
    bode_w: {
      type    : Array,
      required: true
    },
    bode_mag: {
      type    : Array,
      required: true
    },
    bode_pha: {
      type    : Array,
      required: true
    },
  },
  data() {
    return {
      r_time               : 0.01,
      d_time               : 0.51,
      // helpers
      slider_res           : 50, // slider native resolution to from -slider_res to +slider_res
      slider_gains_enabled : true,
      max_chart_len        : 300,
      tab_active           : 'time_step',
    }
  },
  mounted: async function() {
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
	// perform initial tuning
	if(this.pid_gains.length <= 0) {
		await this.tunePID();
	}
	// perform initial simulation
    if(this.pidsim_time.length <= 0) {	
		await this.makeSimulation();
    }
	// emit step loaded
    this.$emit('stepLoaded');
  },
  destroyed: function() {
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
	  		y : this.pidsim_dist[idx]
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
    mag_bode_data: function() {
	  // first create data
	  var mag_data      = [];
	  // if not yet defined
	  if(!this.bode_w) { return mag_data; }
	  // [ALT]
	  for(var i = 0; i < this.bode_w.length; i++) {
	  	mag_data.push({
	  		x : this.bode_w  [i],
	  		y : this.bode_mag[i]
	  	});
	  }
	  // create gain margin data
	  var mag_margin_data = [];
	  if(this.margins.length > 0) {
		  mag_margin_data.push({
			x : this.findMargin('GmF').val,
			y : - 20.0 * Math.log10(this.findMargin('Gm').val)
		  });
		  mag_margin_data.push({
			x : this.findMargin('GmF').val,
			y : 0,
		  });
	  }
	  // then datasets
	  var mag_datasets = [
	  	{
		  label          : 'Gain',
		  data           : mag_data,
		  borderColor    : '#2185D0',
		},
	  	{
	  	  label          : 'G.M.',
		  data           : mag_margin_data,
		  borderColor    : 'rgba(234, 109, 52, 1)',
		}
	  ];
	  // finally chart data
	  var mag_chart_data = {
         labels  : this.getLabels(mag_data),
         datasets: mag_datasets,
      };
      return mag_chart_data;
    }, // mag_bode_data
    pha_bode_data: function() {
	  // first create bode data
	  var pha_data      = [];
	  // if not yet defined
	  if(!this.bode_w) { return pha_data; }
	  // [ALT]
	  for(var i = 0; i < this.bode_w.length; i++) {
	  	pha_data.push({
	  		x : this.bode_w  [i],
	  		y : this.bode_pha[i]
	  	});
	  }
	  // create phase margin data
	  var pha_margin_data = [];
	  if(this.margins.length > 0) {
		  pha_margin_data.push({
			x : this.findMargin('PmF').val,
			y : -180.0
		  });
		  pha_margin_data.push({
			x : this.findMargin('PmF').val,
			y : -180.0 + this.findMargin('Pm').val,
		  });
	  }
	  // then datasets
	  var pha_datasets = [
	  	{
		  label          : 'Phase',
		  data           : pha_data,
		  borderColor    : '#2185D0',
		},
	  	{
	  	  label          : 'P.M.',
		  data           : pha_margin_data,
		  borderColor    : 'rgba(234, 109, 52, 1)',
		}
	  ];
	  // finally chart data
	  var pha_chart_data = {
         labels  : this.getLabels(pha_data),
         datasets: pha_datasets,
      };
      return pha_chart_data;
    }, // pha_bode_data
    gains_scale : function() {
    	// y = Math.pow(10, x) maps [-1, +1] to [0.1, 10]
    	// NOTE : minus sign, inverted in this case, because 0.1 will yield faster dynamics than 10
		return Math.pow(100, (-this.cached_gains_slider)/this.slider_res); // 100 => [0.01 - 100]
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
    bode_w_min : function() {
		if(this.bode_w) {
			return this.bode_w[0];
		}
		else {
			return 0;
		}
	},
	bode_w_max : function() {
		if(this.bode_w) {
			return this.bode_w[this.bode_w.length-1];
		}
		else {
			return 0;
		}
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
	async tunePID() {
		// tune in worker
		var result = await PidWorker.tunePID({
			uniform_time   : this.uniform_time,
			gains_scale    : this.gains_scale,
			selected_model : this.selected_model
		});
		// copy results
		var Kp      = result.gains[0];
		var Ti      = result.gains[1];
		var Td      = result.gains[2];
		var I       = result.gains[3];
		var D       = result.gains[4];
		var du_lim  = result.gains[5];
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
	async makeSimulation() {
		// get gains
		var Kp      = this.findGain('Kp'    ).val;
		var Ti      = this.findGain('Ti'    ).val;
		var Td      = this.findGain('Td'    ).val;
		var I       = this.findGain('I'     ).val;
		var D       = this.findGain('D'     ).val;
		var du_lim  = this.findGain('du_lim').val;
		// update in worker
		var result = await PidWorker.makeSimulation({
			Kp             : Kp    ,
			Ti             : Ti    ,
			Td             : Td    ,
			I              : I     ,
			D              : D     ,
			du_lim         : du_lim,
			uniform_time   : this.uniform_time,
			selected_model : this.selected_model,
			time_scale     : this.time_scale,
			pidsim_ref     : this.pidsim_ref,
			r_time         : this.r_time,
			cached_r_size  : this.cached_r_size,
			pidsim_dist    : this.pidsim_dist,
			d_time         : this.d_time,
			cached_d_size  : this.cached_d_size
		});
		// copy time simulation results
		this.pidsim_input .copyFrom(result.u_sim_r);
		this.pidsim_output.copyFrom(result.y_sim_r);
		this.pidsim_time  .splice(0, this.pidsim_time  .length);
		for(var i = 0; i < result.sim_length_r; i++) {
			this.pidsim_time.push(i * result.sim_ts_r);
		}
		// copy bode results
		this.bode_w  .copyFrom(result.w_r  );
		this.bode_mag.copyFrom(result.mag_r);
		this.bode_pha.copyFrom(result.pha_r);
		// copy margins results
		this.margins
			.copyFrom([{
					    name    : 'Gm',
					    val     : result.Gm_r  ,
					    units   : '[dB]',
					    descrip : 'Gain Margin',
					    editable: false
					   },
					   {
					    name    : 'GmF',
					    val     : result.Wcg_r,
					    units   : '[rad/s]',
					    descrip : 'G.M. Frequency',
					    editable: false
					   },
					   {
					    name    : 'Pm',
					    val     : result.Pm_r,
					    units   : '[deg]',
					    descrip : 'Phase Margin',
					    editable: false
					   },				   
					   {
					    name    : 'PmF',
					    val     : result.Wcp_r,
					    units   : '[rad/s]',
					    descrip : 'P.M. Frequency',
					    editable: false
					   }]);

	},
	async setOriginalGains() {
		// enable gains slider 
		this.slider_gains_enabled = true;
		// reset slider
		if(this.cached_gains_slider == 0) {
			// have to force manually here
			await this.tunePID();
			await this.makeSimulation();
		}
		else {
			this.$emit('updateGainsSlider', 0);
			$(this.$refs.slider_gains).range('set value', 0);			
		}
	},
	findGain(name) {
		return this.pid_gains.find((gain) => { return gain.name == name });
	},
	findMargin(name) {
		return this.margins.find((margin) => { return margin.name == name });
	},
	async updateGain(name, value) {
		if(typeof value == "string") {
			Vue.set(this.findGain(name), 'val', parseFloat(value));
		}
		else if(typeof value == "number") {
			Vue.set(this.findGain(name), 'val', value);
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
		await this.makeSimulation();		
	},
	updateRefSize() {
		this.$emit('update_cached_r_size', parseFloat( this.$refs.r_size.value ));
	},
	updateDistSize() {
		this.$emit('update_cached_d_size', parseFloat( this.$refs.d_size.value ));
	},
	isMarginOk(margin) {
		if (margin.name.includes('Gm')) {
			// 20.0 * Math.log10(this.findMargin('Gm').val) ?
			return this.findMargin('Gm').val >= 3.0;
		}
		else if (margin.name.includes('Pm')) {
			return this.findMargin('Pm').val >= 30;
		}
	}
  }, // methods
  watch: {
	gains_scale: function(){
		// create throttle func if not exists
		if(!this.throttle_gains_scale) {
			this.throttle_gains_scale = throttle(async () => {
				await this.tunePID();
				await this.makeSimulation();				
			}, 500, { leading : false });
		}
		// call throttle func
		this.throttle_gains_scale();
	},
	time_scale: function(){
		// create throttle func if not exists
		if(!this.throttle_time_scale) {
			this.throttle_time_scale = throttle(async () => {
				await this.makeSimulation();			
			}, 500, { leading : false });
		}
		// call throttle func
		this.throttle_time_scale();
	},
	cached_r_size: async function(){
		await this.makeSimulation();
	},
	cached_d_size: async function(){
		await this.makeSimulation();
	},
	cached_gains_slider: function(){
		$(this.$refs.slider_gains).range('set value', this.cached_gains_slider);
	},
	cached_time_slider: function(){
		$(this.$refs.slider_time).range('set value', this.cached_time_slider);
	},
	pid_gains: function(){
		// NOPE !
		// this.$forceUpdate();
	},
  }
};

// ------------------------------------------------------------------------
return TunePidView;
}