importScripts("https://cdn.jsdelivr.net/npm/comlink@4.3.0/dist/umd/comlink.min.js");
importScripts("./pid_tuner.js");

// Helpers
var cxmatFromRealArray = (arr) => {
  var ret = Arma.CxMat.zeros(arr.length, 1);
  for(var k = 0; k < arr.length; k++) {
    ret.set_at(k, 0, new Arma.cx_double(arr[k], 0));  
  }
  return ret;
};

// Worker Methods
const PidWorker = {
    async await() {
        // Wait for module loaded
        await PidTuner.await();
        // Create singleton pid_tuner instance
        WorkerGlobalScope.pid = new Arma.pid_tuner();
    },
    computeRangeList(data) {
        var pid = WorkerGlobalScope.pid;      
        try {
            // copy
            var arma_time   = [];
            var arma_input  = [];
            var arma_output = [];
            for(var i = 0; i < data.time.length; i++) {
                arma_time  .push([[data.time  [i], 0]]);
                arma_input .push([[data.input [i], 0]]);
                arma_output.push([[data.output[i], 0]]);
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
            var uniform_t = t.real().to_array().map(arr => arr[0]);
            var uniform_u = u.real().to_array().map(arr => arr[0]);
            var uniform_y = y.real().to_array().map(arr => arr[0]);
            // find steps
            var steps = new Arma.cx_mat();
            pid.find_steps(t, u, y, steps);		
            // update cache
            steps_arr = steps.to_array();
            // fix to always have same start and limit to max 8 steps
            if(steps_arr.length > 8) {
                steps_arr.splice(8, steps_arr.length  );
            }
            for(var i = 1; i < steps_arr.length; i++) {
                steps_arr[i][0] = steps_arr[0][0];
            }
            // return output data
            return {
                uniform_t : uniform_t,
                uniform_u : uniform_u,
                uniform_y : uniform_y,
                steps_arr : steps_arr
            };            
        }
        catch(err) {            
            // return error
            return {
                error : err
            };
        }
    }, // computeRangeList

    getModelList(data) {
        var pid = WorkerGlobalScope.pid;   
        // copy
		var arma_time   = [];
		var arma_input  = [];
		var arma_output = [];
		for(var i = 0; i < data.uniform_time.length; i++) {
	      arma_time  .push([[data.uniform_time  [i], 0]]);
	      arma_input .push([[data.uniform_input [i], 0]]);
	      arma_output.push([[data.uniform_output[i], 0]]);
		}
		// instantiate arma matrices
		var t_uniform = Arma.CxMat.from_array(arma_time  );
		var u_uniform = Arma.CxMat.from_array(arma_input );
		var y_uniform = Arma.CxMat.from_array(arma_output);
		// get selected range
		var step_ini = data.selected_range[0];
		var step_end = data.selected_range[1];
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
		var arma_models = [];
		for(var i = 0; i < 5; i++) {
			arma_models.push(new Arma.pid_model());
		}
		pid.find_model(u_id, y_id, ts_id, arma_models[0], 
		                                  arma_models[1], 
		                                  arma_models[2], 
		                                  arma_models[3], 
		                                  arma_models[4]);
		// create output array
		var model_list = [];
		var j = 0;
		for(var i = 0; i < arma_models.length; i++) {
	      // create output sim
	      var type   = arma_models[i].get_type();
	      var params = arma_models[i].get_params();
	      var Voptim = arma_models[i].get_V().real().to_array()[0][0];
	      // check if should be added
	      if(i != 0 && !(arma_models[0].get_type() == '2ndord' && type == '1stord') && 
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
		// clean up 
		while(arma_models.length > 0) {
			arma_models.splice(0, 1)[0].destroy();
		}
		// return
		return  {
		    model_list : model_list,
		};
    }, // getModelList

    tunePID(data) {      
        var pid = WorkerGlobalScope.pid;   
        // get ts
		var ts_real = data.uniform_time[1] - data.uniform_time[0];
		var ts      = Arma.CxMat.zeros(1, 1);
		ts.set_at(0, 0, new Arma.cx_double(ts_real, 0.0));
		// check if necessary to compute stuff for first time
		var arma_gains = Arma.CxMat.zeros(6, 1);
		// PID tuning
		var k_tune = Arma.CxMat.zeros(1, 1);
		k_tune.set_at(0, 0, new Arma.cx_double(data.gains_scale, 0));
		pid.tune_pid(data.selected_model.type , cxmatFromRealArray(data.selected_model.params),
					 ts, k_tune, arma_gains);	
		// get gains
		var gains = arma_gains.real().to_array().map(arr => arr[0]);
        // return
		return  {
		    gains : gains,
		};
    }, // tunePID

    makeSimulation(data) {
        var pid = WorkerGlobalScope.pid;   
        // set values
		var arma_gains = Arma.CxMat.zeros(6, 1);
		arma_gains.set_at(0, 0, new Arma.cx_double(data.Kp    , 0.0));
		arma_gains.set_at(1, 0, new Arma.cx_double(data.Ti    , 0.0));
		arma_gains.set_at(2, 0, new Arma.cx_double(data.Td    , 0.0));
		arma_gains.set_at(3, 0, new Arma.cx_double(data.I     , 0.0));
		arma_gains.set_at(4, 0, new Arma.cx_double(data.D     , 0.0));
		// get ts
		var ts_real = data.uniform_time[1] - data.uniform_time[0];
		var ts      = Arma.CxMat.zeros(1, 1);
		ts.set_at(0, 0, new Arma.cx_double(ts_real, 0.0));
		// define PID limits
		var limits = Arma.CxMat.zeros(4, 1);
		limits.set_at(0, 0, new Arma.cx_double(-Infinity, 0.0));
		limits.set_at(1, 0, new Arma.cx_double(+Infinity, 0.0));
		// get simulation time
		var theta = Arma.CxMat.zeros(1, 1);
		pid.get_theta(data.selected_model.type , cxmatFromRealArray(data.selected_model.params), theta);
		theta = theta.real().to_array()[0][0];
		var ts_r         = ts.real().to_array()[0][0];
		var stime        = 160.0*Math.max(theta, ts_r);
		var sim_length_r = Math.ceil(data.time_scale * Math.ceil(stime/ts_r));
		// NOTE : limit simulation resolution to N samples to avoid ui feeze
		//        cannot be too small or oscillations appear in the simulation
		var N        = 1000;
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
		var r_sim = Arma.CxMat.zeros(sim_length_r, 1);
		for(var i = 0; i < sim_length_r; i++) {
			// ref value
			var r_value = i > Math.ceil(data.r_time*sim_length_r) ? data.cached_r_size : 0.0;
			// for simulation (and chart)
			 r_sim.set_at(i, 0, new Arma.cx_double(r_value, 0)); 
		}
		// Create Input Disturbance
		var d_sim = Arma.CxMat.zeros(sim_length_r, 1);
		for(var i = 0; i < sim_length_r; i++) {
			// ref value
			var d_value = i > Math.ceil(data.d_time*sim_length_r) ? data.cached_d_size : 0.0;
			// for simulation (and chart)
			 d_sim.set_at(i, 0, new Arma.cx_double(d_value, 0)); 
		}
		// make time simulation
		var u_sim = new Arma.cx_mat();
		var y_sim = new Arma.cx_mat();
		pid.sim_pid(data.selected_model.type , cxmatFromRealArray(data.selected_model.params), arma_gains, limits, sim_ts, sim_length, r_sim, d_sim, u_sim, y_sim);
		// outputs (also sim_length_r, sim_ts_r)
		var u_sim_r = u_sim.real().to_array().map(arr => arr[0]);
		var y_sim_r = y_sim.real().to_array().map(arr => arr[0]);
		var r_sim_r = r_sim.real().to_array().map(arr => arr[0]);
		var d_sim_r = d_sim.real().to_array().map(arr => arr[0]);
		// make bode plot
		var model = new Arma.pid_model();
		model.set_type  (data.selected_model.type);
		model.set_params(cxmatFromRealArray(data.selected_model.params));
		model.set_gains (arma_gains);
		var samples = Arma.CxMat.zeros(1, 1);
    	samples.set_at(0, 0, new Arma.cx_double(100, 0.0));
    	var w   = new Arma.cx_mat();
		var mag = new Arma.cx_mat();
		var pha = new Arma.cx_mat();
		model.get_bode(samples, w, mag, pha);
		// outputs
		var w_r   = w  .real().to_array().map(arr => arr[0]);
		var mag_r = mag.real().to_array().map(arr => arr[0]);
		var pha_r = pha.real().to_array().map(arr => arr[0]);	
		// compute margins
		var Gm  = new Arma.cx_mat();
		var Pm  = new Arma.cx_mat();
		var Wcg = new Arma.cx_mat();
		var Wcp = new Arma.cx_mat();
		model.get_margins(Gm, Pm, Wcg, Wcp);
		// outputs
		var Gm_r  = Gm .real().to_array()[0][0]; 
		var Pm_r  = Pm .real().to_array()[0][0];
		var Wcg_r = Wcg.real().to_array()[0][0];
		var Wcp_r = Wcp.real().to_array()[0][0];
        // return
		return  {
		    sim_length_r : sim_length_r,
		    sim_ts_r     : sim_ts_r,
		    u_sim_r      : u_sim_r,
            y_sim_r      : y_sim_r,
            r_sim_r      : r_sim_r,
            d_sim_r      : d_sim_r,
            w_r          : w_r  ,
            mag_r        : mag_r,
            pha_r        : pha_r,
            Gm_r         : Gm_r ,
            Pm_r         : Pm_r ,
            Wcg_r        : Wcg_r,
            Wcp_r        : Wcp_r,
        };
    }, // makeSimulation

};

Comlink.expose(PidWorker, self);