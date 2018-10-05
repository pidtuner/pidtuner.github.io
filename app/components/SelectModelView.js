// get current file URL
var scripts = document.getElementsByTagName("script");
var src     = scripts[scripts.length-1].src;
var listUrl = src.split('/');
listUrl.pop();
listUrl.push("");
var scriptSelectModelViewDir = listUrl.join("/");

getSelectModelViewComponent = async function() {
// ------------------------------------------------------------------------

// get template for component
var templSelectModelView;
await $.asyncGet(scriptSelectModelViewDir + "SelectModelView.html", function(data){
    templSelectModelView = data;
}.bind(this));

var SelectModelView = {
  template: templSelectModelView,
  props: {
    // algorithm input
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
    // algorithm input/output
	cached_model_list: {
      type    : Array,
      required: true
    },
    // algorithm output 
    selected_model: {
      type    : Object,
      required: true
    },
  },
  data() {
    return {
		max_chart_len    : 300,
    }
  },
  mounted: function() {
  	// if cache exists, enable next step
  	if(this.cached_model_list.length > 0) {
		// emit step loaded
		this.$emit('enableNext');
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
	  	if(idx >= this.uniform_time.length) {
	  		idx = this.uniform_time.length -1 ;
	  	}
	  	in_data.push({
	  		x : this.uniform_time [idx],
	  		y : this.uniform_input[idx]
	  	});
	  	if(idx == this.uniform_time.length-1) {
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
	  var out_data_selected = [];
      // [ALT]
	  var i = 0;	  
	  while(true) {
	  	var idx = i*this.step_data;
	  	if(idx >= this.uniform_time.length) {
	  		idx = this.uniform_time.length -1 ;
	  	}
	  	out_data.push({
	  		x : this.uniform_time [idx],
	  		y : this.uniform_output[idx]
	  	});
	  	out_data_selected.push({
	  		x : this.uniform_time [idx],
	  		y : this.internal_selected_model.y[idx]
	  	});
	  	if(idx == this.uniform_time.length-1) {
	  		break;
	  	}
	  	i++;
	  }	  
	  // then datasets
	  var out_datasets = [
        {
		  label          : 'Output (Model)',
		  data           : out_data_selected,
		  borderColor    : 'rgba(234, 109, 52, 1)',
		},
		{
		  label          : 'Output (Data)',
		  data           : out_data,
		  borderColor    : '#2185D0',
		},
		
	  ];
	  // finally chart data
	  var out_chart_data = {
         labels  : this.getLabels(out_data),
         datasets: out_datasets,
      };
      return out_chart_data;
    }, // output_chart_data
    model_list: function() {
      // update or cache
	  var model_list = [];
	  if(this.cached_model_list.length <= 0) {
		// copy
		var arma_time   = [];
		var arma_input  = [];
		var arma_output = [];
		for(var i = 0; i < this.uniform_time.length; i++) {
	      arma_time  .push([[this.uniform_time  [i], 0]]);
	      arma_input .push([[this.uniform_input [i], 0]]);
	      arma_output.push([[this.uniform_output[i], 0]]);
		}
		// instantiate arma matrices
		var t_uniform = Arma.CxMat.from_array(arma_time  );
		var u_uniform = Arma.CxMat.from_array(arma_input );
		var y_uniform = Arma.CxMat.from_array(arma_output);
		// get selected range
		var step_ini = this.selected_range[0];
		var step_end = this.selected_range[1];
		// get submat for selected range
		var t_step = t_uniform.submat(step_ini, 0, step_end, 0);
		var u_step = u_uniform.submat(step_ini, 0, step_end, 0);
		var y_step = y_uniform.submat(step_ini, 0, step_end, 0);
		// resample data to reduce problem size, if  necessary
		var max_size = 470;
		var t_step_ini = t_step.clone();
		t_step_ini.fill( t_step.submat(0, 0, 0, 0).as_scalar() );
		var u_step_ini = u_step.clone();
		u_step_ini.fill( u_step.submat(0, 0, 0, 0).as_scalar() );
		var y_step_ini = y_step.clone();
		y_step_ini.fill( y_step.submat(0, 0, 0, 0).as_scalar() );
		var t_id  = t_step.rest(t_step_ini);
		var u_id  = u_step.rest(u_step_ini);
		var y_id  = y_step.rest(y_step_ini);
		var ts_id_real = t_id.at(1, 0).rest(t_id.at(0, 0)).real();
		if(t_id.get_n_rows() > max_size) {
	      ts_id_real  = t_id.at(t_id.get_n_rows()-1, 0).real()/max_size;
	      var t_new   = new Arma.cx_mat();
	      var u_new   = new Arma.cx_mat();
	      var y_new   = new Arma.cx_mat();
	      ts_id_real  = pid.resample(t_id, u_id, y_id, ts_id_real, t_new, u_new, y_new);
	      t_id = t_new;
	      u_id = u_new;
	      y_id = y_new;
		}
		var ts_id = Arma.CxMat.zeros(1, 1);
		ts_id.set_at(0, 0, new Arma.cx_double(ts_id_real, 0.0));
		// remove offsets
		var u_id_ini = u_id.clone();
		u_id_ini.fill( u_id.submat(0, 0, 0, 0).as_scalar() );
		var y_id_ini = y_id.clone();
		y_id_ini.fill( y_id.submat(0, 0, 0, 0).as_scalar() );
		var u_id  = u_id.rest(u_id_ini);
		var y_id  = y_id.rest(y_id_ini);
		// add 5% of samples as zeros in the beginning
		var x_size = Math.ceil(0.05*t_id.get_n_rows());
		u_id = Arma.CxMat.zeros(x_size, 1).join_vert(u_id);
		y_id = Arma.CxMat.zeros(x_size, 1).join_vert(y_id);
		// identification
		if(!this.$parent.arma_models) {
			this.$parent.arma_models = [];
		}
		while(this.$parent.arma_models.length > 0) {
			this.$parent.arma_models.splice(0, 1)[0].destroy();
		}
		for(var i = 0; i < 5; i++) {
			this.$parent.arma_models.push(new Arma.pid_model());
		}
		pid.find_model(u_id, y_id, ts_id, this.$parent.arma_models[0], 
		                                  this.$parent.arma_models[1], 
		                                  this.$parent.arma_models[2], 
		                                  this.$parent.arma_models[3], 
		                                  this.$parent.arma_models[4]);
		// create output array
		var model_list = [];
		var j = 0;
		for(var i = 0; i < this.$parent.arma_models.length; i++) {
	      // create output sim
	      var type   = this.$parent.arma_models[i].get_type();
	      var params = this.$parent.arma_models[i].get_params();
	      var Voptim = this.$parent.arma_models[i].get_V().real().to_array()[0][0];
	      // check if should be added
	      if(i != 0 && !(this.$parent.arma_models[0].get_type() == '2ndord' && type == '1stord') && 
	         model_list[j-1].V < (1e-1)*Voptim) {
	      	continue;
	      }
	      // increase number of good models
	      j++;
	      // detrend
	      var y_detrend = new Arma.cx_mat();
	      params.resize(10, 1);
	      pid.detrend_sim(type, params, t_uniform, u_uniform, y_uniform, y_detrend);
	      // add to output array
	      model_list.push({
	        type  : type,
	        params: params.real().to_array().map(arr => arr[0]),
	        V     : Voptim,
	        y     : y_detrend.real().to_array().map(arr => arr[0])
	      });
		}
		// update cache
		this.cached_model_list.copyFrom(model_list);
	  }
	  else {
	  	// use cache
		model_list.copyFrom(this.cached_model_list);
	  }
	  // check if need to set model
	  if(!this.internal_selected_model.y) {
		  // set first model
		  this.setModel(model_list[0]);
	  }
      // emit step loaded
      this.$emit('stepLoaded');
      // return
      return model_list;
    }, // model_list
    internal_selected_model: {
        get: function() { 
            return {
              type  : this.selected_model.type  ,
              params: this.selected_model.params,
              V     : this.selected_model.V,
              y     : this.selected_model.y,
            }; 
        },
        set: function(model) {
          // do it the vue way
          Vue.set(this.selected_model, 'type'  , model.type  );
          Vue.set(this.selected_model, 'params', model.params);
          Vue.set(this.selected_model, 'V'     , model.V     );
          Vue.set(this.selected_model, 'y'     , model.y     );
        }    
    },
    internal_selected_model_params: function() {
      var strListParams = []; 
      if(this.selected_model.type == '1stord') {
      	var k     = this.selected_model.params[0];
        var tao   = this.selected_model.params[1];
        var theta = this.selected_model.params[2];
        //var y0    = this.selected_model.params[3];
        strListParams.push(`k = ${k}`  );
        strListParams.push(`τ = ${tao}`);
        strListParams.push(`θ = ${theta}`);
      }
      else if(this.selected_model.type == '2ndord') {
      	var a1    = this.selected_model.params[0];
        var a2    = this.selected_model.params[1];
        var b     = this.selected_model.params[2];
        var theta = this.selected_model.params[3];
        //var y0    = this.selected_model.params[4];
        // frequency and damping
        var w     = Math.sqrt(-a1);
        var gi    = -a2/(2*w);
        var k     = -b/a1;
        strListParams.push(`k = ${k}` );
        strListParams.push(`ω = ${w}` );
        strListParams.push(`ξ = ${gi}`);
        strListParams.push(`θ = ${theta}`);
      }
      else if(this.selected_model.type == 'integ') {
      	var k     = this.selected_model.params[0];
        var theta = this.selected_model.params[1];
        //var y0    = this.selected_model.params[2];
        strListParams.push(`k = ${k}` );
        strListParams.push(`θ = ${theta}`);
      }
      else if(this.selected_model.type == 'integlag') {
      	var k     = this.selected_model.params[0];
        var tao   = this.selected_model.params[1];
        var theta = this.selected_model.params[2];
        //var y0    = this.selected_model.params[3];
        strListParams.push(`k = ${k}`  );
        strListParams.push(`τ = ${tao}`);
        strListParams.push(`θ = ${theta}`);
      }
      else if(this.selected_model.type == 'integdouble') {
        var k     = this.selected_model.params[0];
        var theta = this.selected_model.params[1];
        //var y0    = this.selected_model.params[2];
        strListParams.push(`k = ${k}` );
        strListParams.push(`θ = ${theta}`);
      }
      else {
          strListParams.push('Unknown Model');
      }
      // return array
      return strListParams;
    },
    step_data : function() {
    	// [ALT]
    	return Math.ceil(this.uniform_time.length/this.max_chart_len);
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
		if(!value) {
			return '';
		}
		return value.toFixed(2);
	},
	setModel(model) {
        // set using computed to avoid vue error
        // NOTE : also sets as selected model for chart
		this.internal_selected_model = {
          type  : model.type  ,
          params: model.params,
          V     : model.V,
          y     : model.y
        }
		// as soon as any range is selected, we can continue
		this.$emit('enableNext');
	},
	getModelName(type) {
      if(type == '1stord') {
        return '1st Order';
      }
      else if(type == '2ndord') {
        return '2nd Order';
      }
      else if(type == 'integ') {
        return 'Integrator';
      }
      else if(type == 'integlag') {
        return 'Integrator with Lag';
      }
      else if(type == 'integdouble') {
        return 'Double Integrator';
      }
      else {
          return 'Unknown Model'
      }
	},
	getModelImgUrl(type) {
	  if(type == '1stord') {
        return './assets/models/1stord.svg';
      }
      else if(type == '2ndord') {
        return './assets/models/2ndord.svg';
      }
      else if(type == 'integ') {
        return './assets/models/integ.svg';
      }
      else if(type == 'integlag') {
        return './assets/models/integlag.svg';
      }
      else if(type == 'integdouble') {
        return './assets/models/integdouble.svg';
      }
      else {
          return 'Unknown Model'
      }
	},
	getModelEquation(type) {
	  var eq;
	  if(type == '1stord') {
        eq = '$$\\frac{y(s)}{u(s)} = \\frac{k e^{-\\theta s}}{\\tau s+1}$$';
      }
      else if(type == '2ndord') {
        eq = '$$\\frac{y(s)}{u(s)} = \\frac{k {\\omega}^2 e^{-\\theta s}}{s^2 + 2 \\xi \\omega s + {\\omega}^2}$$';
      }
      else if(type == 'integ') {
        eq = '$$\\frac{y(s)}{u(s)} = \\frac{k e^{-\\theta s}}{s}$$';
      }
      else if(type == 'integlag') {
        eq = '$$\\frac{y(s)}{u(s)} = \\frac{k e^{-\\theta s}}{s(\\tau s + 1)}$$';
      }
      else if(type == 'integdouble') {
        eq = '$$\\frac{y(s)}{u(s)} = \\frac{k e^{-\\theta s}}{s^2}$$';
      }
      else {
        eq = 'Unknown Model'
      }
      // NOTE : need to bind using v-html and the lines below
      this.$nextTick(function() {
	    MathJax.Hub.Queue(["Typeset", MathJax.Hub]);
	  });
      return eq;
	},
	getModelParams(type) {

	},
  }, // methods
};

// ------------------------------------------------------------------------
return SelectModelView;
}